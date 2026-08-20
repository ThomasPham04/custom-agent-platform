"""Message-for-message transcription of the agent and session validators.

All three surfaces must read identically to a client, so these strings are
asserted character for character.
"""

import pytest

from app.core.errors import BadRequestError
from app.modules.knowledge.validation import validate_document_write

CAP = 100_000


def create(body):
    return validate_document_write(body, partial=False, max_body_bytes=CAP)


def patch(body):
    return validate_document_write(body, partial=True, max_body_bytes=CAP)


def message_of(excinfo) -> str:
    return excinfo.value.message


def test_a_non_object_body_is_rejected():
    with pytest.raises(BadRequestError) as excinfo:
        create([1, 2, 3])
    assert message_of(excinfo) == "Request body must be a JSON object."


def test_a_non_string_title_is_rejected():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": 7, "body": "text"})
    assert message_of(excinfo) == "title must be a string."


def test_an_overlong_title_is_rejected():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "t" * 201, "body": "text"})
    assert message_of(excinfo) == "title must be at most 200 characters."


def test_a_non_string_body_is_rejected():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "A title", "body": 7})
    assert message_of(excinfo) == "body must be a string."


def test_an_overlong_body_is_rejected_in_bytes():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "A title", "body": "b" * (CAP + 1)})
    assert message_of(excinfo) == "body must be at most 100000 bytes."


def test_the_body_cap_counts_utf8_bytes_not_characters():
    # 40_000 three-byte characters is 120_000 bytes: inside a character limit,
    # outside the byte limit the server actually enforces.
    with pytest.raises(BadRequestError):
        create({"title": "A title", "body": "日" * 40_000})


def test_an_unknown_source_is_rejected_on_create():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "A title", "body": "text", "source": "scanned"})
    assert message_of(excinfo) == 'Unknown source "scanned".'


def test_a_missing_title_is_required():
    with pytest.raises(BadRequestError) as excinfo:
        create({"body": "text"})
    assert message_of(excinfo) == "title is required."


def test_a_whitespace_only_title_is_required():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "   ", "body": "text"})
    assert message_of(excinfo) == "title is required."


def test_a_missing_body_is_required():
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": "A title"})
    assert message_of(excinfo) == "body is required."


def test_the_title_check_runs_before_the_body_check():
    # A body that breaks two rules must report the earlier one.
    with pytest.raises(BadRequestError) as excinfo:
        create({"title": 7, "body": 7})
    assert message_of(excinfo) == "title must be a string."


def test_a_create_trims_and_defaults_the_source():
    assert create({"title": "  A title  ", "body": "  text  "}) == {
        "title": "A title",
        "body": "text",
        "source": "typed",
    }


def test_a_create_keeps_an_explicit_source():
    assert (
        create({"title": "A title", "body": "text", "source": "upload"})["source"]
        == "upload"
    )


def test_server_owned_keys_are_dropped_silently():
    fields = create(
        {
            "title": "A title",
            "body": "text",
            "id": "doc_injected",
            "createdAt": "2020-01-01T00:00:00Z",
            "updatedAt": "2020-01-01T00:00:00Z",
        }
    )
    assert set(fields) == {"title", "body", "source"}


def test_a_patch_requires_nothing():
    assert patch({}) == {}


def test_a_patch_drops_source_rather_than_applying_it():
    # A document must not be relabelled as a seed, which would make the UI's
    # sample badge lie.
    assert patch({"source": "seed"}) == {}


def test_a_patch_accepts_a_lone_title():
    assert patch({"title": "New title"}) == {"title": "New title"}


def test_a_patch_still_enforces_the_length_rules():
    with pytest.raises(BadRequestError) as excinfo:
        patch({"title": "t" * 201})
    assert message_of(excinfo) == "title must be at most 200 characters."
