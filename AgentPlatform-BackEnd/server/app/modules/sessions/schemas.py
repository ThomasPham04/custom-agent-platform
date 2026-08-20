"""Chat session wire schema.

Deliberately carries no agent name, icon, or model. runs/ snapshots those so
editing an agent cannot rewrite history — an audit concern. A session is
navigation: after a rename the sidebar must show the new name immediately.
"""

from datetime import datetime

from app.core.wire import WireModel


class Session(WireModel):
    id: str
    agent_id: str
    title: str
    created_at: datetime
    updated_at: datetime
