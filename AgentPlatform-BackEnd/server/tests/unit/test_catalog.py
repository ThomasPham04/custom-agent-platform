"""The model catalog is the single source of truth (spec section 4.3).

The catalog carries one model. Google retired the three ids this file was
transcribed from, so gemini-3.1-flash-lite replaces all of them.
"""

from app.modules.llm.catalog import DEFAULT_MODEL, MODEL_IDS, MODELS


def test_lists_the_single_gemini_model():
    assert [m.id for m in MODELS] == ["gemini-3.1-flash-lite"]


def test_labels_match_the_frontend_config():
    assert [m.label for m in MODELS] == ["Gemini 3.1 Flash Lite"]


def test_default_model_is_flash_lite():
    assert DEFAULT_MODEL == "gemini-3.1-flash-lite"


def test_model_ids_is_the_validation_set():
    """agents/ validates against this, never against a local list."""
    assert MODEL_IDS == {"gemini-3.1-flash-lite"}
