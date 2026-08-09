FROM python:3.12-slim

WORKDIR /srv

COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install --no-cache-dir .

EXPOSE 4000

# Port 4000, not uvicorn's default 8000: client/nginx.conf proxies to api:4000
# and must not change (spec D9).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
