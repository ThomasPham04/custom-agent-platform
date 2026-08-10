"""Ported from server/tests/tools.test.js.

The payload must match the schemas in this task byte for byte — the frontend's tool
picker renders these labels and params directly.
"""


def test_lists_the_four_tools(client):
    res = client.get("/api/tools")
    assert res.status_code == 200
    body = res.json()
    assert [t["id"] for t in body] == [
        "current_time",
        "http_request",
        "calculator",
        "knowledge_search",
    ]


def test_tool_shape_matches_the_express_fixture(client):
    body = client.get("/api/tools").json()
    assert body[0] == {
        "id": "current_time",
        "label": "Current time",
        "description": "Reads the current time in a given timezone.",
        "params": [
            {
                "name": "timezone",
                "type": "string",
                "required": False,
                "description": "IANA timezone name. Defaults to UTC.",
            }
        ],
    }
