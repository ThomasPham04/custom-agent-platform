"""Prefixed identifiers, matching the Express server's format (agent_, run_...).

The suffix is URL-safe and lowercase so hand-written seed ids like
`agent_support` live in the same namespace.
"""

from uuid import uuid4


def create_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"
