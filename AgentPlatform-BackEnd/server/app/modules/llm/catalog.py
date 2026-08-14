"""The model catalog — one source of truth for the whole platform.

Mirrored by hand in client/src/config/models.ts and
docs/superpowers/references/express-contract-reference.md chapter 1; change all
three together.

The catalog held gemini-2.5-flash, gemini-2.5-pro, and gemini-2.0-flash until
Google retired them for new API keys — generateContent answers 404 NOT_FOUND on
all three regardless of the key. gemini-3.1-flash-lite replaces them.
"""

from app.modules.llm.provider import ModelInfo

MODELS: list[ModelInfo] = [
    ModelInfo(id="gemini-3.1-flash-lite", label="Gemini 3.1 Flash Lite"),
]

DEFAULT_MODEL = "gemini-3.1-flash-lite"

MODEL_IDS: set[str] = {m.id for m in MODELS}
