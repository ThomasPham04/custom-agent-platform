"""New endpoint — no Express equivalent. Spec §4.3, D2."""


def test_lists_models(client):
    res = client.get("/api/models")
    assert res.status_code == 200
    assert res.json() == [
        {"id": "gemini-3.1-flash-lite", "label": "Gemini 3.1 Flash Lite"},
    ]
