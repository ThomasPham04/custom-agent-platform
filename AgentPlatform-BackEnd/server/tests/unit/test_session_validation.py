"""Messages are transcribed from the agents slice so the two surfaces read
identically to a client. Do not reword them."""

import pytest

from app.core.errors import BadRequestError
from app.modules.sessions.validation import validate_session_write


def test_a_valid_title_is_returned():
    assert validate_session_write({"title": "Billing"}) == {"title": "Billing"}


def test_a_title_is_trimmed():
    assert validate_session_write({"title": "  Billing  "}) == {"title": "Billing"}


def test_server_owned_keys_are_dropped_silently():
    """Matches agent writes: a client echoing a whole object back must not 400."""
    body = {"title": "Billing", "id": "sess_x", "agentId": "agent_y", "createdAt": "now"}
    assert validate_session_write(body) == {"title": "Billing"}


def test_a_non_object_body_is_rejected():
    with pytest.raises(BadRequestError) as exc:
        validate_session_write([])
    assert exc.value.message == "Request body must be a JSON object."


def test_a_non_string_title_is_rejected():
    with pytest.raises(BadRequestError) as exc:
        validate_session_write({"title": 7})
    assert exc.value.message == "title must be a string."


def test_an_over_long_title_is_rejected():
    with pytest.raises(BadRequestError) as exc:
        validate_session_write({"title": "x" * 121})
    assert exc.value.message == "title must be at most 120 characters."


def test_a_missing_title_is_rejected():
    with pytest.raises(BadRequestError) as exc:
        validate_session_write({})
    assert exc.value.message == "title is required."


def test_a_blank_title_is_rejected():
    with pytest.raises(BadRequestError) as exc:
        validate_session_write({"title": "   "})
    assert exc.value.message == "title is required."
