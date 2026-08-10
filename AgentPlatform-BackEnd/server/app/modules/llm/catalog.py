"""The model catalog — one source of truth for the whole platform.

Transcribed from client/src/config/models.ts and
docs/superpowers/references/express-contract-reference.md §1, which currently
duplicate each other by hand.
"""

from app.modules.llm.provider import ModelInfo

MODELS: list[ModelInfo] = [
    ModelInfo(id="gemini-2.5-flash", label="Gemini 2.5 Flash"),
    ModelInfo(id="gemini-2.5-pro", label="Gemini 2.5 Pro"),
    ModelInfo(id="gemini-2.0-flash", label="Gemini 2.0 Flash"),
]

DEFAULT_MODEL = "gemini-2.5-flash"

MODEL_IDS: set[str] = {m.id for m in MODELS}
