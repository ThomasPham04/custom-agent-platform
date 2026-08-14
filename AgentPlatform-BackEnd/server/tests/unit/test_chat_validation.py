"""Contract reference §5, "Chat request validation".

Two of these are cases pydantic gets actively wrong rather than merely phrases
differently, which is why this module exists instead of Field() constraints.
"""

import pytest

from app.core.errors import BadRequestError
from app.modules.execution.validation import validate_message_request


def message(body) -> str:
    with pytest.raises(BadRequestError) as exc:
        validate_message_request(body)
    return exc.value.message


def test_a_minimal_body_is_accepted():
    payload = validate_message_request({"content": "hello"})
    assert payload.content == "hello"
    assert payload.retry is False


def test_retry_is_read_when_supplied():
    assert validate_message_request({"content": "hi", "retry": True}).retry is True


def test_content_is_trimmed():
    """Express trimmed before storing, so the run records the trimmed message."""
    assert validate_message_request({"content": "  hello  "}).content == "hello"


@pytest.mark.parametrize("body", [[], "a string", 7, None])
def test_a_non_object_body_is_rejected(body):
    assert message(body) == "Request body must be a JSON object."


def test_a_missing_content_key_is_rejected():
    assert message({}) == "content must be a non-empty string."


@pytest.mark.parametrize("value", [None, 7, [], {}, True])
def test_non_string_content_is_rejected(value):
    assert message({"content": value}) == "content must be a non-empty string."


@pytest.mark.parametrize("value", ["", "   ", "\t\n "])
def test_blank_content_is_rejected(value):
    """pydantic's min_length=1 would accept '   ' — three characters is not
    empty. The contract wants a 400."""
    assert message({"content": value}) == "content must be a non-empty string."


def test_content_at_exactly_the_limit_is_accepted():
    assert validate_message_request({"content": "x" * 10_000}).content == "x" * 10_000


def test_content_one_over_the_limit_is_rejected():
    assert message({"content": "x" * 10_001}) == (
        "content must be at most 10000 characters."
    )


def test_the_limit_is_counted_in_utf16_code_units():
    """5001 rockets is 10002 JS units but only 5001 Python code points."""
    assert message({"content": "\U0001f680" * 5001}) == (
        "content must be at most 10000 characters."
    )


@pytest.mark.parametrize("value", ["yes", "true", 1, 0, None, []])
def test_non_boolean_retry_is_rejected(value):
    """pydantic coerces 'yes' and 1 to True in lax mode. The contract does not."""
    assert message({"content": "hi", "retry": value}) == "retry must be a boolean."


def test_the_content_checks_run_before_the_retry_check():
    """A body that breaks both reports content first (recorded choice)."""
    assert message({"content": "", "retry": "yes"}) == (
        "content must be a non-empty string."
    )


def test_the_blank_check_runs_before_the_length_check():
    assert message({"content": " " * 10_001}) == "content must be a non-empty string."


def test_unknown_keys_are_ignored():
    assert validate_message_request({"content": "hi", "nonsense": 1}).content == "hi"
