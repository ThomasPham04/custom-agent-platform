"""WireModel is the single most likely place for the REST contract to break.

Python is snake_case; the finished React client reads camelCase. These tests
pin both directions.
"""

from app.core.wire import WireModel


class Sample(WireModel):
    system_prompt: str
    tool_ids: list[str]
    created_at: str
    model: str


def test_serializes_to_camel_case():
    s = Sample(system_prompt="hi", tool_ids=["a"], created_at="2026-08-08", model="x")
    assert s.model_dump(by_alias=True) == {
        "systemPrompt": "hi",
        "toolIds": ["a"],
        "createdAt": "2026-08-08",
        "model": "x",
    }


def test_accepts_camel_case_input():
    s = Sample.model_validate(
        {"systemPrompt": "hi", "toolIds": [], "createdAt": "2026-08-08", "model": "x"}
    )
    assert s.system_prompt == "hi"


def test_accepts_snake_case_input():
    """populate_by_name keeps internal construction ergonomic."""
    s = Sample(system_prompt="hi", tool_ids=[], created_at="2026-08-08", model="x")
    assert s.system_prompt == "hi"


def test_model_field_does_not_collide_with_pydantic_namespace():
    """`model` is a real Agent field and pydantic reserves the model_ prefix."""
    s = Sample(system_prompt="", tool_ids=[], created_at="", model="gemini-2.5-flash")
    assert s.model_dump(by_alias=True)["model"] == "gemini-2.5-flash"
