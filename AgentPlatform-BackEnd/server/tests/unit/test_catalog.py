"""The model catalog is the single source of truth (spec §4.3).

Until now the same three ids were maintained by hand in the backend and
client/src/config/models.ts. These values are transcribed from those files.
"""

from app.modules.llm.catalog import DEFAULT_MODEL, MODEL_IDS, MODELS


def test_lists_the_three_gemini_models_in_order():
    assert [m.id for m in MODELS] == [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
    ]


def test_labels_match_the_frontend_config():
    assert [m.label for m in MODELS] == [
        "Gemini 2.5 Flash",
        "Gemini 2.5 Pro",
        "Gemini 2.0 Flash",
    ]


def test_default_model_is_flash():
    assert DEFAULT_MODEL == "gemini-2.5-flash"


def test_model_ids_is_the_validation_set():
    """agents/ validates against this, never against a local list."""
    assert MODEL_IDS == {"gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"}
