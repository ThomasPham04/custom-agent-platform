"""One-time migration for history written before sessions existed.

Runs on every boot and is a no-op after the first: it only looks at runs whose
session_id is still NULL. Titles come from truncation, never from the model — a
startup path must not depend on a network call or an API key.

Reads orphans through `RunRepository.list_orphans`, which is oldest-first and
scoped to session_id IS NULL — not `list()` filtered in Python. `list()` sorts
newest-first and truncates to its limit before any filtering happens, so on a
table with more orphans than that limit the oldest ones fall outside the
window and, because the table only grows, can never re-enter it: they would be
stranded forever, which is exactly the failure this module exists to prevent.

Batches are migrated one at a time (`assign_session` runs before the next
`list_orphans` call), so a run this call has already handled can never occupy
a later batch's window. Oldest-first plus "migrate, then requery" means every
orphan is eventually consumed and the loop always terminates: each pass
strictly shrinks the remaining orphan count.
"""

from app.core.ids import create_id
from app.modules.runs.repository import RunRepository
from app.modules.runs.schemas import Run
from app.modules.sessions.repository import SessionRepository
from app.modules.sessions.schemas import Session
from app.modules.sessions.titles import truncate_title

# Large enough that the common case (well under a thousand legacy runs) is a
# single batch; small enough that a pathological table doesn't try to hold an
# unbounded page in memory at once. Overridable per call for tests.
BATCH_SIZE = 1000


async def backfill_sessions(
    runs: RunRepository, sessions: SessionRepository, batch_size: int = BATCH_SIZE
) -> int:
    """Group session-less runs into one session per agent. Returns how many
    sessions were created, which is 0 on every boot after the first.

    Because list_orphans is oldest-first and batches are processed in order,
    the first orphan this call ever sees for a given agent is that agent's
    true earliest orphan — even when its backlog spans more than one batch.
    """
    created = 0
    session_id_by_agent: dict[str, str] = {}

    while True:
        batch = await runs.list_orphans(limit=batch_size)
        if not batch:
            return created

        by_agent: dict[str, list[Run]] = {}
        for run in batch:
            by_agent.setdefault(run.agent_id, []).append(run)

        for agent_id, agent_runs in by_agent.items():
            session_id = session_id_by_agent.get(agent_id)
            if session_id is None:
                earliest = min(agent_runs, key=lambda r: r.created_at)
                session = await sessions.create(
                    Session(
                        id=create_id("sess"),
                        agent_id=agent_id,
                        title=truncate_title(earliest.user_message),
                        created_at=earliest.created_at,
                        updated_at=max(r.created_at for r in agent_runs),
                    )
                )
                session_id_by_agent[agent_id] = session.id
                session_id = session.id
                created += 1
            else:
                # This agent's backlog spilled into another batch. The
                # session already carries the right title and created_at
                # from the first batch; touch() is the closest the port
                # offers to acknowledging that more history just landed on
                # it. This only ever fires when a single agent has more than
                # batch_size orphaned runs, an edge case far past what the
                # common case (well under a thousand legacy runs) hits.
                await sessions.touch(session_id)

            await runs.assign_session([r.id for r in agent_runs], session_id)
