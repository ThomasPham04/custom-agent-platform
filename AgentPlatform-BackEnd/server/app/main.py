"""Application factory.

Kept as a factory (rather than a module-level app) so tests can build an
isolated instance per test, the same way server.js exported createApp().
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.container import get_run_repository, get_session_repository
from app.core import db
from app.core.errors import BodySizeLimitMiddleware, register_error_handlers
from app.modules.agents.router import router as agents_router
from app.modules.agents.seeds import SEED_AGENTS
from app.modules.execution.router import router as execution_router
from app.modules.llm.router import router as llm_router
from app.modules.runs.router import router as runs_router
from app.modules.sessions.backfill import backfill_sessions
from app.modules.sessions.router import router as sessions_router
from app.modules.tools.router import router as tools_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Open the pool, apply the schema, seed once, then rescue any run history
    written before sessions existed.

    With STORE_BACKEND=memory the schema step does nothing, which is what keeps
    the test suites running without a database. The backfill runs for both
    backends — a harmless no-op on an empty memory store — so the two paths
    stay honest with each other.
    """
    settings = get_settings()
    if settings.store_backend == "postgres":
        pool = await db.create_pool(settings.database_url)
        await db.apply_schema(pool)
        inserted = await db.seed_agents(pool, SEED_AGENTS)
        print(f"postgres ready; seeded {inserted} agents")
    try:
        created = await backfill_sessions(get_run_repository(), get_session_repository())
    except Exception:
        # A database hiccup or one malformed legacy row must never block
        # startup: the backfill is idempotent, so booting with some history
        # still un-migrated is recoverable on the next boot, while failing to
        # boot at all is a total outage — strictly worse than a delayed
        # migration. Log loudly and keep going.
        logger.exception("session backfill failed; continuing to boot unmigrated")
    else:
        if created:
            print(f"backfilled {created} session(s) from legacy runs")
    yield
    await db.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="AI Agent Platform API", version="0.1.0", lifespan=_lifespan
    )

    # add_middleware prepends, so the LAST registered runs outermost. Express ran
    # cors() before express.json({limit}), which meant a 413 still carried
    # Access-Control-Allow-Origin; CORS therefore has to wrap the body limiter.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    app.include_router(tools_router)
    app.include_router(llm_router)
    app.include_router(agents_router)
    app.include_router(runs_router)
    app.include_router(sessions_router)
    app.include_router(execution_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "mode": "mock" if settings.llm_provider == "mock" else "live",
        }

    return app


app = create_app()
