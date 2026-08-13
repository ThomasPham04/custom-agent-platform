"""Fetches a URL and returns the status and body.

The URL is chosen by a language model acting on user text, so this tool is
reachable by prompt injection. Without the guards below it would read the
service's own API on localhost, anything inside a private network, and the cloud
metadata endpoint at 169.254.169.254 — the classic SSRF target.

Residual limitation, recorded rather than hidden: the address is resolved and
checked, then httpx resolves it again to connect. A DNS record that changes
between the two could still slip through. Closing that needs connection-level
pinning, which is beyond this proof of concept; redirects are disabled so at
least the second hop cannot be redirected inward.
"""

import asyncio
import ipaddress
import socket
import time
from typing import Any, ClassVar
from urllib.parse import urlparse

import httpx

from app.modules.tools.base import ToolParam, ToolResult, ToolSchema

_ALLOWED_SCHEMES = ("http", "https")
_ALLOWED_METHODS = ("GET", "HEAD")
_MAX_BODY_BYTES = 64 * 1024


async def _is_public(host: str) -> bool:
    """True only if every address the host resolves to is publicly routable.

    `is_global` rather than a list of negative flags. Checking is_private /
    is_loopback / is_link_local one at a time leaves gaps: 100.64.0.0/10
    (carrier-grade NAT, and what Tailscale hands out) reports is_private False
    *and* is_global False, so a flag-by-flag guard waves it through to a real
    internal host. is_global is the single question worth asking.

    Resolved through the loop's executor rather than by calling getaddrinfo
    directly. The hostname comes from a model, so it can point at a black-holed
    resolver, and a synchronous lookup would block the whole event loop —
    stalling every other request, including the health check the orchestrator
    uses to decide the container is still alive.
    """
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if not address.is_global:
            return False
    return bool(infos)


class HttpRequestTool:
    schema: ClassVar[ToolSchema] = ToolSchema(
        id="http_request",
        label="HTTP request",
        description="Fetches a URL and returns the status and body.",
        params=[
            ToolParam(
                name="url",
                type="string",
                required=True,
                description="Absolute URL to request.",
            ),
            ToolParam(
                name="method",
                type="string",
                required=False,
                description="HTTP method. Defaults to GET.",
            ),
        ],
    )

    def __init__(self, timeout_ms: int = 5000) -> None:
        self._timeout_s = timeout_ms / 1000

    async def execute(self, **kwargs: Any) -> ToolResult:
        url = kwargs.get("url")
        if not isinstance(url, str) or not url.strip():
            return ToolResult(ok=False, error="url must be a non-empty string.")

        method = str(kwargs.get("method") or "GET").upper()
        if method not in _ALLOWED_METHODS:
            allowed = ", ".join(_ALLOWED_METHODS)
            return ToolResult(
                ok=False,
                error=f"{method} is not allowed. Use one of: {allowed}.",
            )

        parsed = urlparse(url)
        if parsed.scheme not in _ALLOWED_SCHEMES or not parsed.hostname:
            return ToolResult(
                ok=False, error=f'"{url}" is not an absolute http or https URL.'
            )
        started = time.perf_counter()
        try:
            # Bounded by the same timeout as the request: as far as the caller
            # is concerned, resolution is part of the call.
            resolvable = await asyncio.wait_for(
                _is_public(parsed.hostname), timeout=self._timeout_s
            )
        except TimeoutError:
            return ToolResult(
                ok=False, error=f'Timed out resolving "{parsed.hostname}".'
            )
        if not resolvable:
            return ToolResult(
                ok=False,
                error=(
                    f'"{parsed.hostname}" resolves inside the network, '
                    "which is not allowed."
                ),
            )

        try:
            async with httpx.AsyncClient(
                timeout=self._timeout_s, follow_redirects=False
            ) as client:
                # Streamed, not buffered. `await client.request(...)` reads and
                # decompresses the whole response first, so slicing afterwards
                # bounds the stored value but not the memory: a large file or a
                # compression bomb at an LLM-chosen URL is already in the
                # process by then. Reading chunk by chunk and hanging up at the
                # cap is what actually bounds it.
                async with client.stream(method, url) as response:
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        chunks.append(chunk)
                        total += len(chunk)
                        if total >= _MAX_BODY_BYTES:
                            break
                    status = response.status_code
        except httpx.TimeoutException:
            return ToolResult(
                ok=False, error=f"Timed out after {self._timeout_s:.0f}s."
            )
        except httpx.HTTPError as exc:
            return ToolResult(ok=False, error=f"Request failed: {exc}")

        elapsed_ms = int((time.perf_counter() - started) * 1000)
        body = b"".join(chunks)[:_MAX_BODY_BYTES].decode("utf-8", errors="replace")
        return ToolResult(
            ok=True,
            value={
                "status": status,
                # camelCase on purpose: this dict is opaque JSON in the trace, so
                # no alias generator runs over it (see the mock fixtures).
                # Timed here rather than read from response.elapsed, which is not
                # populated until a streamed response has been fully consumed.
                "latencyMs": elapsed_ms,
                "body": body,
            },
        )
