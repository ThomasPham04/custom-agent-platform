"""The four sample documents, transcribed from the fixed corpus they replace.

Seeded only into an empty library, the way SEED_AGENTS is, so a restart never
resurrects a document the user deleted. The titles are load-bearing: the mock
provider's canned answer quotes the first two, and its fixture arguments are
written to match them.
"""

from datetime import UTC, datetime

from app.modules.knowledge.schemas import KnowledgeDocument

# A fixed stamp rather than now(): seeding must produce the same rows on every
# boot, and a seeded row is not a user edit.
SEED_TIME = datetime(2026, 1, 1, tzinfo=UTC)

SEED_DOCUMENTS: list[KnowledgeDocument] = [
    KnowledgeDocument(
        id="doc_refunds",
        title="Refunds — 30 day window",
        body=(
            "Refunds are available within 30 days of the invoice date. "
            "After that the charge stands and the policy window has closed."
        ),
        source="seed",
        created_at=SEED_TIME,
        updated_at=SEED_TIME,
    ),
    KnowledgeDocument(
        id="doc_proration",
        title="Proration on downgrade",
        body=(
            "Downgrades prorate from the next billing cycle, not immediately. "
            "The current cycle is billed at the original plan price."
        ),
        source="seed",
        created_at=SEED_TIME,
        updated_at=SEED_TIME,
    ),
    KnowledgeDocument(
        id="doc_usage",
        title="Usage metering and billable storage",
        body=(
            "Billable storage is measured in gigabytes at the end of each cycle. "
            "Recorded usage above the plan allowance is charged per gigabyte."
        ),
        source="seed",
        created_at=SEED_TIME,
        updated_at=SEED_TIME,
    ),
    KnowledgeDocument(
        id="doc_status",
        title="Status page and incident history",
        body=(
            "The status endpoint reports service health. Incident history is "
            "retained for 90 days and is public."
        ),
        source="seed",
        created_at=SEED_TIME,
        updated_at=SEED_TIME,
    ),
]
