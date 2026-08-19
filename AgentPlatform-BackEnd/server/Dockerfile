FROM python:3.14-slim

WORKDIR /srv

COPY pyproject.toml README.md ./
COPY app ./app
# The adk extra, not a bare install: deployment/README.md documents switching
# LLM_PROVIDER to adk_gemini, and google.adk is imported lazily. Without it the
# image starts, reports live mode, and then fails on the first chat request.
RUN pip install --no-cache-dir ".[adk]"

EXPOSE 4000

# Port 4000, not uvicorn's default 8000: client/nginx.conf proxies to api:4000
# and must not change (spec D9).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
