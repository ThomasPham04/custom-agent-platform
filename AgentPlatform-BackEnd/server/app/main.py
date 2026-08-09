"""Application factory.

Kept as a factory (rather than a module-level app) so tests can build an
isolated instance per test, the same way server.js exported createApp().
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.errors import BodySizeLimitMiddleware, register_error_handlers
from app.modules.agents.router import router as agents_router
from app.modules.execution.router import router as execution_router
from app.modules.llm.router import router as llm_router
from app.modules.runs.router import router as runs_router
from app.modules.tools.router import router as tools_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="AI Agent Platform API", version="0.1.0")

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
