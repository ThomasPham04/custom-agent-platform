"""Application factory.

Kept as a factory (rather than a module-level app) so tests can build an
isolated instance per test, the same way server.js exported createApp().
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core import db
from app.core.errors import BodySizeLimitMiddleware, register_error_handlers
from app.modules.agents.router import router as agents_router
from app.modules.agents.seeds import SEED_AGENTS
from app.modules.execution.router import router as execution_router
from app.modules.llm.router import router as llm_router
from app.modules.runs.router import router as runs_router
from app.modules.tools.router import router as tools_router


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Open the pool, apply the schema, seed once.

    With STORE_BACKEND=memory this does nothing, which is what keeps pytest and
    Playwright running without a database.
    """
    settings = get_settings()
    if settings.store_backend == "postgres":
        pool = await db.create_pool(settings.database_url)
        await db.apply_schema(pool)
        inserted = await db.seed_agents(pool, SEED_AGENTS)
        print(f"postgres ready; seeded {inserted} agents")
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
    app.include_router(execution_router)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {
            "status": "ok",
            "mode": "mock" if settings.llm_provider == "mock" else "live",
        }

    return app


app = create_app()
