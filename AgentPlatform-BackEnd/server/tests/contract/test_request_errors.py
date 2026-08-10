"""Ported from server/tests/health.test.js (unknown routes) and
server/tests/request-errors.test.js (oversized body).

Message strings are copied verbatim from Express. The parity gate depends on them.
"""


def test_unknown_route_returns_the_standard_envelope(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    body = res.json()
    assert body["error"]["code"] == "not_found"
    assert isinstance(body["error"]["message"], str)


def test_oversized_body_returns_payload_too_large(client):
    res = client.post(
        "/api/agents",
        json={"systemPrompt": "x" * (300 * 1024)},
    )
    assert res.status_code == 413
    assert res.json() == {
        "error": {"code": "payload_too_large", "message": "Request body is too large."}
    }


def test_malformed_json_returns_bad_request(client):
    """Ported from server/tests/request-errors.test.js. Message is verbatim."""
    res = client.post(
        "/api/agents",
        content='{"name":',
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    assert res.json() == {
        "error": {"code": "bad_request", "message": "Malformed JSON body."}
    }


def test_validation_failure_is_remapped_from_422_to_400(client):
    """FastAPI's default is 422 with its own body. Express returned 400."""
    res = client.post("/api/agents", json={"name": 123})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "bad_request"


def test_unmatched_method_returns_404_like_express(client):
    """Express registers app.get('/api/health'), so POST falls through to its
    404 middleware. Starlette raises 405 instead, which must be normalised."""
    res = client.post("/api/health", json={})
    assert res.status_code == 404
    assert res.json() == {
        "error": {"code": "not_found", "message": "No route for POST /api/health"}
    }


def test_unknown_route_message_names_the_method_and_path(client):
    res = client.get("/api/nope")
    assert res.json()["error"]["message"] == "No route for GET /api/nope"


def test_streamed_body_without_content_length_is_still_limited(client):
    """express.json({limit:'256kb'}) enforces while reading the stream. A chunked
    request carries no Content-Length, so a header-only check would let it through."""

    def chunks():
        for _ in range(40):
            yield b"x" * (16 * 1024)

    res = client.post(
        "/api/agents",
        content=chunks(),
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "payload_too_large"


def test_cors_headers_survive_a_middleware_rejection(client):
    """Express ran cors() before the body parser, so a 413 still carried
    Access-Control-Allow-Origin. The frontend needs that when VITE_API_HOST is set."""
    res = client.post(
        "/api/agents",
        json={"systemPrompt": "x" * (300 * 1024)},
        headers={"Origin": "http://localhost:5173"},
    )
    assert res.status_code == 413
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
