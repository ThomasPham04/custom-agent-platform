"""The backfill runs inside the lifespan, before the app can serve a single
request. A database hiccup or one malformed legacy row must never cost the
whole service its ability to boot — see the try/except around
backfill_sessions in app/main.py._lifespan."""

from fastapi.testclient import TestClient

import app.main as main_module
from app.main import create_app


async def _raise(*_args, **_kwargs):
    raise RuntimeError("boom")


def test_a_raising_backfill_does_not_stop_the_app_from_booting(monkeypatch):
    monkeypatch.setattr(main_module, "backfill_sessions", _raise)

    # Entering the context manager is what actually drives the lifespan;
    # a bare TestClient() never runs startup at all.
    with TestClient(create_app()) as client:
        res = client.get("/api/health")

    assert res.status_code == 200
