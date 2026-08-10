"""New endpoint — no Express equivalent. Spec §4.3, D2."""


def test_lists_models(client):
    res = client.get("/api/models")
    assert res.status_code == 200
    assert res.json() == [
        {"id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash"},
        {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro"},
        {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
    ]
