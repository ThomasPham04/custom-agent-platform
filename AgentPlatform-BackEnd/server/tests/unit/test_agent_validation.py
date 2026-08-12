"""Every message string here is asserted by the ported Express suite.

Contract reference §4. The strings are copied verbatim and the ordering rule at
the bottom of that section is asserted explicitly, because a validator that
produces the right messages in the wrong order still fails the contract.
"""

import pytest

from app.core.errors import BadRequestError
from app.modules.agents.validation import validate_agent_write

MODEL_IDS = {"gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"}
TOOL_IDS = {"current_time", "http_request", "calculator", "knowledge_search"}


def validate(body):
    return validate_agent_write(body, model_ids=MODEL_IDS, known_tool_ids=TOOL_IDS)


def message(body) -> str:
    with pytest.raises(BadRequestError) as exc:
        validate(body)
    return exc.value.message


def test_an_empty_body_is_valid_and_yields_nothing():
    assert validate({}) == {}


def test_an_absent_body_is_treated_as_empty():
    """Contract §4: an absent body is treated as {} rather than an error."""
    assert validate(None) == {}


def test_wire_names_are_returned_as_python_names():
    assert validate({"systemPrompt": "hi", "toolIds": ["calculator"]}) == {
        "system_prompt": "hi",
        "tool_ids": ["calculator"],
    }


def test_server_owned_keys_are_dropped_silently():
    """Contract §4: id, createdAt and updatedAt are dropped, not rejected."""
    assert validate({"id": "agent_hijack", "createdAt": "x", "name": "Kept"}) == {
        "name": "Kept"
    }


def test_unknown_keys_are_dropped_silently():
    assert validate({"nonsense": 1, "name": "Kept"}) == {"name": "Kept"}


@pytest.mark.parametrize(
    "body",
    [
        [],
        "a string",
        7,
        True,
    ],
)
def test_a_non_object_body_is_rejected(body):
    assert message(body) == "Request body must be a JSON object."


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", None),
        ("icon", 7),
        ("description", False),
        ("model", None),
        ("systemPrompt", []),
        ("status", None),
    ],
)
def test_non_string_fields_report_the_field_name(field, value):
    """The values are the ones the deleted suite drove (contract §6)."""
    assert message({field: value}) == f"{field} must be a string."


@pytest.mark.parametrize(
    ("field", "limit"),
    [
        ("name", 120),
        ("icon", 32),
        ("description", 2000),
        ("model", 64),
        ("systemPrompt", 20000),
        ("status", 16),
    ],
)
def test_overlong_fields_report_the_limit(field, limit):
    assert message({field: "x" * (limit + 1)}) == (
        f"{field} must be at most {limit} characters."
    )


@pytest.mark.parametrize(
    ("field", "limit"),
    [("name", 120), ("icon", 32), ("description", 2000), ("systemPrompt", 20000)],
)
def test_exactly_the_limit_is_accepted(field, limit):
    assert validate({field: "x" * limit})


def test_length_is_counted_in_utf16_code_units_like_javascript():
    """A non-BMP character costs 2 units in JS and 1 code point in Python.

    `icon` is the field this actually bites: it is always an emoji, so counting
    code points would let it exceed the documented 32 and disagree with the
    character counter the frontend renders.
    """
    assert validate({"icon": "\U0001f3a7" * 16}) == {"icon": "\U0001f3a7" * 16}
    assert message({"icon": "\U0001f3a7" * 17}) == "icon must be at most 32 characters."


def test_bmp_strings_are_unaffected_by_the_utf16_count():
    """Accented Latin and CJK are one code unit each, so nothing shifts."""
    assert validate({"name": "é" * 120})
    assert message({"name": "漢" * 121}) == "name must be at most 120 characters."


def test_unknown_model_is_quoted_in_the_message():
    assert message({"model": "gpt-4"}) == 'Unknown model "gpt-4".'


def test_unknown_status_is_quoted_in_the_message():
    assert message({"status": "retired"}) == 'Unknown status "retired".'


@pytest.mark.parametrize("status", ["active", "draft"])
def test_both_documented_statuses_are_accepted(status):
    assert validate({"status": status}) == {"status": status}


def test_tool_ids_must_be_an_array():
    assert message({"toolIds": "current_time"}) == "toolIds must be an array."


def test_tool_ids_must_contain_only_strings():
    assert message({"toolIds": ["current_time", None]}) == (
        "toolIds must contain only strings."
    )


def test_tool_ids_are_capped_at_the_number_of_registered_tools():
    assert message({"toolIds": ["current_time"] * 5}) == (
        "toolIds must contain at most 4 items."
    )


def test_tool_ids_must_not_repeat():
    assert message({"toolIds": ["current_time", "current_time"]}) == (
        "toolIds must not contain duplicates."
    )


def test_unknown_tool_ids_are_listed_in_the_message():
    assert message({"toolIds": ["current_time", "nope", "nah"]}) == (
        "Unknown tool ids: nope, nah."
    )


def test_all_four_tools_are_accepted():
    ids = ["current_time", "http_request", "calculator", "knowledge_search"]
    assert validate({"toolIds": ids}) == {"tool_ids": ids}


def test_string_checks_run_before_the_model_check():
    """Contract §4: 'string checks run first (all six fields, in the table's
    order), then model, then status, then the toolIds checks'."""
    assert message({"name": 7, "model": "gpt-4"}) == "name must be a string."


def test_fields_are_checked_in_the_documented_order():
    body = {
        "status": None,
        "systemPrompt": None,
        "model": None,
        "description": None,
        "icon": None,
        "name": None,
    }
    assert message(body) == "name must be a string."


def test_the_model_check_runs_before_the_status_check():
    assert message({"model": "gpt-4", "status": "retired"}) == 'Unknown model "gpt-4".'


def test_the_status_check_runs_before_the_tool_id_checks():
    assert message({"status": "retired", "toolIds": "nope"}) == (
        'Unknown status "retired".'
    )


def test_the_length_check_runs_before_the_enum_check():
    assert message({"model": "x" * 65}) == "model must be at most 64 characters."
