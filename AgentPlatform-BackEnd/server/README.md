# Agent Platform Service

FastAPI + Google ADK backend for the AI Agent Platform. Serves the REST API
for agent configuration, tool-calling chat, and run history — see
`AgentPlatform-BackEnd/README.md` for the endpoint list and configuration.

```bash
uv sync
uv run uvicorn app.main:app --port 4000 --reload
```
