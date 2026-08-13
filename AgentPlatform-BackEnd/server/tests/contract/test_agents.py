"""Ported from server/tests/agents.test.js.

Every assertion here is transcribed from
docs/superpowers/references/express-contract-reference.md §6. This file is the
parity guardrail for Agent Management: Express is deleted, so if this suite is
wrong there is nothing left to diff against.
"""


def test_lists_the_four_seeded_agents(client):
    res = client.get("/api/agents")
    assert res.status_code == 200
    assert len(res.json()) == 4


def test_the_seeded_set_covers_the_ui_render_states(client):
    agents = client.get("/api/agents").json()
    assert any(len(a["toolIds"]) > 2 for a in agents)
    assert any(len(a["toolIds"]) == 1 for a in agents)
    assert any(not a["toolIds"] and a["status"] == "draft" for a in agents)
    assert any(len(a["name"]) > 24 for a in agents)


def test_agents_are_serialised_as_camel_case(client):
    """The single most likely way for this contract to break silently: the
    frontend reads undefined and renders an empty field with no error."""
    agent = client.get("/api/agents").json()[0]
    assert set(agent) == {
        "id",
        "name",
        "icon",
        "description",
        "model",
        "systemPrompt",
        "toolIds",
        "status",
        "createdAt",
        "updatedAt",
    }


def test_get_returns_a_single_agent(client):
    res = client.get("/api/agents/agent_support")
    assert res.status_code == 200
    assert res.json()["id"] == "agent_support"


def test_get_returns_404_for_an_unknown_agent(client):
    res = client.get("/api/agents/agent_missing")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_create_applies_the_documented_defaults(client):
    res = client.post("/api/agents", json={})
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "New agent"
    assert body["status"] == "draft"
    assert body["model"] == "gemini-3.1-flash-lite"
    assert body["toolIds"] == []
    assert body["id"].startswith("agent_")


def test_create_accepts_supplied_fields(client):
    res = client.post(
        "/api/agents",
        json={"name": "Custom", "toolIds": ["current_time"], "status": "active"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Custom"
    assert body["toolIds"] == ["current_time"]
    assert body["status"] == "active"


def test_created_agents_appear_in_the_list(client):
    client.post("/api/agents", json={"name": "Custom"})
    assert len(client.get("/api/agents").json()) == 5


def test_create_rejects_an_unknown_tool_id_and_names_it(client):
    res = client.post("/api/agents", json={"toolIds": ["nope"]})
    assert res.status_code == 400
    assert "nope" in res.json()["error"]["message"]


def test_create_rejects_a_json_array_body(client):
    res = client.post("/api/agents", json=[])
    assert res.status_code == 400
    assert res.json() == {
        "error": {
            "code": "bad_request",
            "message": "Request body must be a JSON object.",
        }
    }


def test_create_rejects_a_non_string_tool_id(client):
    res = client.post("/api/agents", json={"toolIds": ["current_time", None]})
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "toolIds must contain only strings."


def test_create_with_no_body_at_all_uses_the_defaults(client):
    """Contract §4: an absent body is treated as {} rather than an error."""
    res = client.post("/api/agents")
    assert res.status_code == 201
    assert res.json()["name"] == "New agent"


def test_create_ignores_a_body_sent_as_text_plain(client):
    """express.json() parses only application/json, so a text/plain body was
    never read and the agent got pure defaults.

    A text/plain POST is CORS-safelisted — it makes no preflight — so parsing
    one would let an origin outside CORS_ORIGIN write attacker-chosen fields.
    """
    res = client.post(
        "/api/agents",
        content='{"name":"CORS smuggled","status":"active"}',
        headers={"Content-Type": "text/plain"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "New agent"
    assert res.json()["status"] == "draft"


def test_create_ignores_a_structured_json_suffix_media_type(client):
    """type-is only honours a `+json` suffix when the expected type carries one,
    so express.json()'s default never parsed application/merge-patch+json."""
    res = client.post(
        "/api/agents",
        content='{"name":"Merge patched"}',
        headers={"Content-Type": "application/merge-patch+json"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "New agent"


def test_create_accepts_application_json_with_parameters(client):
    """`application/json; charset=utf-8` did match — parameters are dropped."""
    res = client.post(
        "/api/agents",
        content='{"name":"Charset set"}',
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    assert res.status_code == 201
    assert res.json()["name"] == "Charset set"


def test_create_rejects_a_whitespace_only_body(client):
    """body-parser's strict mode: the first non-whitespace byte must open an
    object or an array. Only a genuinely empty body means {}."""
    res = client.post(
        "/api/agents", content="   ", headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Malformed JSON body."


def test_create_rejects_a_literal_null_body(client):
    """`null` is valid JSON but fails strict mode, so it must not silently
    become {} and create a default agent."""
    res = client.post(
        "/api/agents", content="null", headers={"Content-Type": "application/json"}
    )
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Malformed JSON body."


def test_create_rejects_json_constants_javascript_does_not_have(client):
    """Python's json accepts NaN and Infinity; JSON.parse does not."""
    for body in ['{"name": NaN}', '{"name": Infinity}']:
        res = client.post(
            "/api/agents", content=body, headers={"Content-Type": "application/json"}
        )
        assert res.status_code == 400, body
        assert res.json()["error"]["message"] == "Malformed JSON body.", body


def test_create_rejects_a_lone_surrogate_instead_of_crashing(client):
    """A `\\ud800` escape parses into a lone surrogate that cannot be encoded as
    UTF-8, so serialising the stored agent would raise long after the write.
    Node replaced it with U+FFFD; we reject the body (recorded choice)."""
    res = client.post(
        "/api/agents",
        content=r'{"name":"\ud800"}',
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Malformed JSON body."


def test_a_lone_surrogate_is_rejected_wherever_it_hides(client):
    """The check walks the whole body, not just the six length-checked fields."""
    res = client.post(
        "/api/agents",
        content=r'{"toolIds":["\ud800"]}',
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["message"] == "Malformed JSON body."


def test_astral_characters_outside_the_surrogate_range_still_work(client):
    """Paired surrogates are ordinary text — only lone ones are rejected."""
    res = client.post("/api/agents", json={"name": "Deploy \U0001f680"})
    assert res.status_code == 201
    assert res.json()["name"] == "Deploy \U0001f680"


def test_the_published_write_schema_does_not_advertise_null(client):
    """The doc models type fields `str | None` to mark them optional, but the
    validator rejects an explicit null. /openapi.json must not disagree."""
    schema = client.get("/openapi.json").json()
    body = schema["paths"]["/api/agents"]["post"]["requestBody"]
    props = body["content"]["application/json"]["schema"]["properties"]

    assert props["name"] == {"type": "string", "maxLength": 120, "title": "Name"}
    for name, prop in props.items():
        assert "null" not in str(prop.get("anyOf", "")), name
    assert "name" not in schema["paths"]["/api/agents"]["post"].get("required", [])


def test_create_rejects_non_string_fields_with_the_exact_envelope(client):
    """The values are the ones the deleted suite drove (contract §6)."""
    for field, value in [
        ("name", None),
        ("icon", 7),
        ("description", False),
        ("model", None),
        ("systemPrompt", []),
        ("status", None),
    ]:
        res = client.post("/api/agents", json={field: value})
        assert res.status_code == 400, field
        assert res.json() == {
            "error": {"code": "bad_request", "message": f"{field} must be a string."}
        }, field


def test_create_rejects_overflow_at_exactly_one_over_the_limit(client):
    for field, limit in [
        ("name", 120),
        ("icon", 32),
        ("description", 2000),
        ("systemPrompt", 20000),
    ]:
        res = client.post("/api/agents", json={field: "x" * (limit + 1)})
        assert res.status_code == 400, field
        assert f"{field} must be at most" in res.json()["error"]["message"], field


def test_patch_applies_and_advances_updated_at(client):
    before = client.get("/api/agents/agent_support").json()
    res = client.patch("/api/agents/agent_support", json={"name": "Renamed"})
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "Renamed"
    assert body["updatedAt"] >= before["updatedAt"]


def test_patch_silently_ignores_a_server_owned_id(client):
    res = client.patch("/api/agents/agent_support", json={"id": "agent_hijack"})
    assert res.status_code == 200
    assert res.json()["id"] == "agent_support"


def test_patch_rejects_an_unknown_model(client):
    res = client.patch("/api/agents/agent_support", json={"model": "gpt-4"})
    assert res.status_code == 400
    assert res.json()["error"]["message"] == 'Unknown model "gpt-4".'


def test_patch_returns_404_for_an_unknown_agent(client):
    res = client.patch("/api/agents/agent_missing", json={"name": "Renamed"})
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_delete_returns_204_and_shortens_the_list(client):
    res = client.delete("/api/agents/agent_support")
    assert res.status_code == 204
    assert res.content == b""
    assert len(client.get("/api/agents").json()) == 3


def test_delete_returns_404_for_an_unknown_agent(client):
    res = client.delete("/api/agents/agent_missing")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "not_found"


def test_each_test_starts_from_the_four_seeds(client):
    """Guards the conftest reset. Without it the delete above leaks into this
    test and the count is 3 — exactly what Express's resetStore() prevented."""
    assert len(client.get("/api/agents").json()) == 4
