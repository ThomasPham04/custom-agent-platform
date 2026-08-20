import asyncio

import pytest

from app.core.errors import BodySizeLimitMiddleware

pytestmark = pytest.mark.anyio


async def test_replayed_request_waits_for_a_real_disconnect() -> None:
    """A slow StreamingResponse must not be cancelled after reading its body."""
    disconnected = asyncio.Event()
    receives = 0

    async def receive():
        nonlocal receives
        receives += 1
        if receives == 1:
            return {"type": "http.request", "body": b"{}", "more_body": False}
        await disconnected.wait()
        return {"type": "http.disconnect"}

    async def app(_scope, replay, _send) -> None:
        assert await replay() == {
            "type": "http.request",
            "body": b"{}",
            "more_body": False,
        }
        waiting = asyncio.create_task(replay())
        await asyncio.sleep(0)
        assert not waiting.done()
        disconnected.set()
        assert await waiting == {"type": "http.disconnect"}

    middleware = BodySizeLimitMiddleware(app, max_bytes=1024)
    await middleware({"type": "http", "headers": []}, receive, lambda _message: None)
