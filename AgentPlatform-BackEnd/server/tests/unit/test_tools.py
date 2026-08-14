"""Every tool returns ToolResult rather than raising.

A tool failure is data the trace renders, not an HTTP error (spec §8), so an
exception escaping execute() would become a 500 and lose the trace entirely.
"""

import asyncio
import json
import socket
import time
from datetime import UTC, datetime

import pytest

from app.core.clock import set_clock
from app.modules.tools.impls import http_request as http_request_module
from app.modules.tools.impls.calculator import CalculatorTool
from app.modules.tools.impls.current_time import CurrentTimeTool
from app.modules.tools.impls.http_request import HttpRequestTool
from app.modules.tools.impls.knowledge_search import KnowledgeSearchTool


async def test_current_time_defaults_to_utc():
    set_clock(lambda: datetime(2026, 8, 12, 9, 30, 0, tzinfo=UTC))
    try:
        result = await CurrentTimeTool().execute()
    finally:
        set_clock(None)
    assert result.ok is True
    assert result.value == "2026-08-12T09:30:00+00:00"


async def test_current_time_converts_to_the_requested_zone():
    set_clock(lambda: datetime(2026, 8, 12, 9, 30, 0, tzinfo=UTC))
    try:
        result = await CurrentTimeTool().execute(timezone="Asia/Tokyo")
    finally:
        set_clock(None)
    assert result.value == "2026-08-12T18:30:00+09:00"


async def test_current_time_reports_an_unknown_zone_without_raising():
    result = await CurrentTimeTool().execute(timezone="Mars/Olympus")
    assert result.ok is False
    assert "Mars/Olympus" in result.error


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("2 + 2", 4),
        ("(184320 / 1024) * 0.87", 156.6),
        ("10 - 3 * 2", 4),
        ("-5 + 1", -4),
        ("2 ** 8", 256),
        ("7 % 3", 1),
        ("7 // 2", 3),
    ],
)
async def test_calculator_evaluates_arithmetic(expression, expected):
    result = await CalculatorTool().execute(expression=expression)
    assert result.ok is True
    assert result.value == pytest.approx(expected)


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('echo hi')",
        "open('/etc/passwd').read()",
        "[].__class__",
        "x + 1",
        "print(1)",
    ],
)
async def test_calculator_refuses_anything_that_is_not_arithmetic(expression):
    """The expression comes from an LLM, so eval() would be remote code
    execution with extra steps. Only literals and operators are walked."""
    result = await CalculatorTool().execute(expression=expression)
    assert result.ok is False


async def test_calculator_refuses_an_exponent_large_enough_to_hang_the_process():
    """9**9**9 is a one-line denial of service."""
    result = await CalculatorTool().execute(expression="9 ** 9 ** 9")
    assert result.ok is False
    assert "too large" in result.error


async def test_calculator_reports_division_by_zero():
    result = await CalculatorTool().execute(expression="1 / 0")
    assert result.ok is False
    assert "zero" in result.error.lower()


async def test_knowledge_search_finds_a_relevant_entry():
    result = await KnowledgeSearchTool().execute(query="refund window")
    assert result.ok is True
    assert result.value[0]["title"].startswith("Refunds")
    assert 0 < result.value[0]["score"] <= 1


async def test_knowledge_search_honours_the_limit():
    result = await KnowledgeSearchTool().execute(query="policy", limit=1)
    assert len(result.value) <= 1


async def test_knowledge_search_returns_an_empty_list_when_nothing_matches():
    result = await KnowledgeSearchTool().execute(query="zzzznomatch")
    assert result.ok is True
    assert result.value == []


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:4000/api/agents",
        "http://127.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/",
        "http://192.168.1.1/",
        "http://[::1]/",
    ],
)
async def test_http_request_refuses_addresses_inside_the_network(url):
    """An LLM picks this URL from user text, so without this guard a prompt can
    read the service's own API and the cloud metadata endpoint."""
    result = await HttpRequestTool(timeout_ms=5000).execute(url=url)
    assert result.ok is False
    assert "not allowed" in result.error


@pytest.mark.parametrize(
    "url", ["file:///etc/passwd", "ftp://example.com/x", "gopher://x/", "notaurl"]
)
async def test_http_request_refuses_non_http_schemes(url):
    result = await HttpRequestTool(timeout_ms=5000).execute(url=url)
    assert result.ok is False


@pytest.mark.parametrize("method", ["DELETE", "TRACE", "CONNECT"])
async def test_http_request_refuses_methods_outside_the_safe_set(method):
    result = await HttpRequestTool(timeout_ms=5000).execute(
        url="https://example.com/", method=method
    )
    assert result.ok is False
    assert method in result.error


@pytest.mark.parametrize(
    "url",
    [
        # Carrier-grade NAT. Python reports is_private False *and* is_global
        # False for 100.64.0.0/10, so a flag-by-flag check lets it through
        # while Tailscale and CGNAT deployments route it to real hosts.
        "http://100.64.0.1/",
        "http://198.18.0.1/",
        "http://192.0.0.1/",
    ],
)
async def test_http_request_refuses_addresses_that_are_merely_non_global(url):
    result = await HttpRequestTool(timeout_ms=5000).execute(url=url)
    assert result.ok is False
    assert "not allowed" in result.error


async def _resolves_public(_host: str) -> bool:
    """Stand-in for the SSRF guard, which is now awaited."""
    return True


class _BigBodyServer:
    """A local HTTP server that streams far more than the tool's body cap.

    The SSRF guard blocks loopback, so these tests stub _is_public. That is the
    only way to exercise the cap at all: any host the guard permits is one the
    test suite must not depend on reaching.
    """

    def __init__(self, total_bytes: int) -> None:
        self._total = total_bytes
        self._server: asyncio.Server | None = None
        self.port = 0
        # How much the server actually got onto the wire before the client hung
        # up. This is the number that separates streaming from buffering.
        self.sent = 0

    async def __aenter__(self) -> "_BigBodyServer":
        self._server = await asyncio.start_server(self._handle, "127.0.0.1", 0)
        self.port = self._server.sockets[0].getsockname()[1]
        return self

    async def __aexit__(self, *_exc) -> None:
        self._server.close()
        await self._server.wait_closed()

    async def _handle(self, reader, writer) -> None:
        while await reader.readline() not in (b"\r\n", b""):
            pass
        writer.write(
            b"HTTP/1.1 200 OK\r\n"
            b"Content-Type: text/plain\r\n"
            b"Content-Length: " + str(self._total).encode() + b"\r\n"
            b"Connection: close\r\n\r\n"
        )
        sent = 0
        try:
            while sent < self._total:
                chunk = b"x" * min(64 * 1024, self._total - sent)
                writer.write(chunk)
                await writer.drain()
                sent += len(chunk)
                self.sent = sent
        except (ConnectionResetError, BrokenPipeError):
            pass  # the tool hung up once it had enough — that is the point
        finally:
            writer.close()


async def test_http_request_stops_reading_once_the_body_cap_is_reached(monkeypatch):
    """A compression bomb or a very large file must not be buffered whole.

    The cap has to apply while reading, not as a slice afterwards — slicing a
    fully-buffered response has already spent the memory.
    """
    monkeypatch.setattr(http_request_module, "_is_public", _resolves_public)
    async with _BigBodyServer(total_bytes=8 * 1024 * 1024) as server:
        tool = HttpRequestTool(timeout_ms=10_000)
        result = await tool.execute(url=f"http://127.0.0.1:{server.port}/big")

    assert result.ok is True
    assert result.value["status"] == 200
    assert len(result.value["body"]) <= http_request_module._MAX_BODY_BYTES
    # Slicing a fully-buffered response would leave this at the full 8 MB: the
    # bytes were already read into the process before the cap was applied.
    assert server.sent < 1024 * 1024, (
        f"read {server.sent} bytes for a {http_request_module._MAX_BODY_BYTES}-byte cap"
    )


async def test_http_request_returns_a_small_body_intact(monkeypatch):
    monkeypatch.setattr(http_request_module, "_is_public", _resolves_public)
    async with _BigBodyServer(total_bytes=11) as server:
        tool = HttpRequestTool(timeout_ms=10_000)
        result = await tool.execute(url=f"http://127.0.0.1:{server.port}/small")

    assert result.value["body"] == "x" * 11
    assert result.value["latencyMs"] >= 0


@pytest.mark.parametrize("expression", ["1e309", "1e308 * 10", "-1e309", "1e400"])
async def test_calculator_refuses_values_that_overflow_to_infinity(expression):
    """`inf` is not representable in JSON. json.dumps writes the bare token
    `Infinity`, which breaks the chat response and the JSONB insert that stores
    the run — so an overflow has to fail here, as a legible tool error, rather
    than as a serialization crash two layers up.
    """
    result = await CalculatorTool().execute(expression=expression)
    assert result.ok is False
    assert "finite" in result.error.lower() or "too large" in result.error.lower()


async def test_calculator_refuses_a_nan_producing_expression():
    result = await CalculatorTool().execute(expression="1e309 - 1e309")
    assert result.ok is False


async def test_every_calculator_result_survives_json_encoding():
    """The guard exists to protect this property, so assert the property."""
    result = await CalculatorTool().execute(expression="(184320 / 1024) * 0.87")
    assert result.ok is True
    assert json.dumps(result.value) == "156.6"


async def test_http_request_dns_lookup_is_bounded_by_the_timeout(monkeypatch):
    """A model-chosen hostname with a black-holed resolver must not hang.

    getaddrinfo is synchronous; called directly it blocks the event loop, so a
    single chat request would stall unrelated requests — including the health
    check the container orchestrator uses.
    """

    def never_resolves(*_args, **_kwargs):
        time.sleep(30)
        raise AssertionError("should have been abandoned")

    monkeypatch.setattr(socket, "getaddrinfo", never_resolves)
    tool = HttpRequestTool(timeout_ms=200)
    started = time.perf_counter()
    result = await tool.execute(url="https://slow-dns.example/")
    elapsed = time.perf_counter() - started

    assert result.ok is False
    assert elapsed < 5, f"took {elapsed:.1f}s; the lookup was not bounded"


async def test_the_event_loop_keeps_running_during_a_dns_lookup(monkeypatch):
    """The point of moving resolution off the loop: other work still progresses."""

    def slow_resolve(*_args, **_kwargs):
        time.sleep(0.4)
        return []

    monkeypatch.setattr(socket, "getaddrinfo", slow_resolve)
    ticks = 0
    # Counted against the wall clock, not against a fixed number of iterations:
    # a ticker that simply runs to completion catches up after the block and
    # would pass either way.
    deadline = time.perf_counter() + 0.4

    async def ticker():
        nonlocal ticks
        while time.perf_counter() < deadline:
            await asyncio.sleep(0.02)
            ticks += 1

    tool = HttpRequestTool(timeout_ms=5000)
    await asyncio.gather(tool.execute(url="https://slow.example/"), ticker())

    assert ticks >= 5, f"only {ticks} ticks — the loop was blocked by the lookup"
