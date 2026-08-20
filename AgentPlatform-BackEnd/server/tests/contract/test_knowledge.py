"""The document library's REST surface.

Wire spelling is asserted directly: a snake_case key reaches the frontend as
undefined, with no error anywhere to catch it.
"""

SEED_COUNT = 4


def create_document(client, **overrides):
    payload = {"title": "Shipping policy", "body": "Orders ship within two days."}
    payload.update(overrides)
    return client.post("/api/knowledge/documents", json=payload)


def test_a_fresh_workspace_lists_the_seeded_documents(client):
    response = client.get("/api/knowledge/documents")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == SEED_COUNT
    assert {d["id"] for d in body} == {
        "doc_refunds",
        "doc_proration",
        "doc_usage",
        "doc_status",
    }


def test_the_list_returns_summaries_not_bodies(client):
    row = client.get("/api/knowledge/documents").json()[0]
    assert "body" not in row
    assert "preview" in row
    assert "sizeBytes" in row
    assert isinstance(row["sizeBytes"], int)


def test_the_list_is_camelcase(client):
    row = client.get("/api/knowledge/documents").json()[0]
    assert "createdAt" in row
    assert "created_at" not in row


def test_the_list_honours_the_limit(client):
    assert len(client.get("/api/knowledge/documents?limit=2").json()) == 2


def test_a_limit_of_zero_is_rejected(client):
    response = client.get("/api/knowledge/documents?limit=0")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"


def test_creating_a_document_returns_201_and_the_body(client):
    response = create_document(client)
    assert response.status_code == 201
    body = response.json()
    assert body["id"].startswith("doc_")
    assert body["title"] == "Shipping policy"
    assert body["body"] == "Orders ship within two days."
    assert body["source"] == "typed"


def test_an_upload_records_its_source(client):
    assert create_document(client, source="upload").json()["source"] == "upload"


def test_a_created_document_appears_first_in_the_list(client):
    created = create_document(client).json()
    assert client.get("/api/knowledge/documents").json()[0]["id"] == created["id"]


def test_a_create_without_a_title_is_rejected(client):
    response = client.post("/api/knowledge/documents", json={"body": "text"})
    assert response.status_code == 400
    assert response.json() == {
        "error": {"code": "bad_request", "message": "title is required."}
    }


def test_a_create_with_an_oversized_body_is_rejected(client):
    response = create_document(client, body="b" * 100_001)
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "body must be at most 100000 bytes."


def test_server_owned_keys_are_dropped_rather_than_rejected(client):
    response = create_document(client, id="doc_injected")
    assert response.status_code == 201
    assert response.json()["id"] != "doc_injected"


def test_fetching_one_document_returns_its_body(client):
    created = create_document(client).json()
    response = client.get(f"/api/knowledge/documents/{created['id']}")
    assert response.status_code == 200
    assert response.json()["body"] == "Orders ship within two days."


def test_fetching_an_unknown_document_is_404(client):
    response = client.get("/api/knowledge/documents/doc_missing")
    assert response.status_code == 404
    assert response.json() == {
        "error": {"code": "not_found", "message": 'No document with id "doc_missing".'}
    }


def test_patching_a_title_leaves_the_body_alone(client):
    created = create_document(client).json()
    response = client.patch(
        f"/api/knowledge/documents/{created['id']}", json={"title": "Renamed"}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"
    assert response.json()["body"] == "Orders ship within two days."


def test_patching_the_source_is_ignored(client):
    created = create_document(client).json()
    response = client.patch(
        f"/api/knowledge/documents/{created['id']}", json={"source": "seed"}
    )
    assert response.status_code == 200
    assert response.json()["source"] == "typed"


def test_patching_an_unknown_document_is_404(client):
    response = client.patch("/api/knowledge/documents/doc_missing", json={"title": "x"})
    assert response.status_code == 404


def test_deleting_a_document_returns_204_and_removes_it(client):
    created = create_document(client).json()
    assert client.delete(f"/api/knowledge/documents/{created['id']}").status_code == 204
    assert client.get(f"/api/knowledge/documents/{created['id']}").status_code == 404


def test_deleting_an_unknown_document_is_404(client):
    assert client.delete("/api/knowledge/documents/doc_missing").status_code == 404


def test_a_seeded_document_can_be_deleted(client):
    assert client.delete("/api/knowledge/documents/doc_refunds").status_code == 204
    assert len(client.get("/api/knowledge/documents").json()) == SEED_COUNT - 1
