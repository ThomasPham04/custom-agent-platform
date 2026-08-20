# Deployment

Brings up the Agent Platform end to end with one command: Postgres for durable
agents and run history, the Python API, and nginx serving the built client and
proxying `/api` to it on the same origin.

## What it delivers

A single `docker compose up` that starts all three services in dependency
order, applies the database schema, and seeds four sample agents on first
boot — nothing to configure by hand beyond copying the env file. The stack
defaults to the offline mock LLM provider, so it comes up and serves a working
UI with no API key; flipping two environment variables switches it to live
Gemini.

## Run

```bash
docker compose up --build
```

That is the whole setup. Open `http://localhost:8080`.

No file to copy first. Every value has a default in `docker-compose.yml`, so a
fresh clone boots against Postgres with the deterministic mock provider and no
credentials.

`.env` in this directory is the single place to change any of them — see
[Configuration](#configuration). It holds credentials, is not tracked, and must
never be committed.

## The three services

| Service | What it does |
| --- | --- |
| `db` | `postgres:16-alpine`, with its data in the `pgdata` volume |
| `api` | Builds from `AgentPlatform-BackEnd/server` and listens on 4000 |
| `web` | Builds the client and serves it through nginx on 8080 |

Startup is ordered by healthchecks rather than by luck: `api` waits for `db` to
report `pg_isready`, and `web` waits for `api` to answer `GET /api/health`.
The API applies its schema on boot, so starting before Postgres is ready would
fail rather than retry.

## First boot

On startup the API opens a connection pool, applies `app/core/schema.sql`, and
inserts the four sample agents **only when the `agents` table is empty**. Every
schema statement is `IF NOT EXISTS`, so a restart against a populated database
is a no-op and an agent you deleted stays deleted. The log line to look for is:

```
postgres ready; seeded 4 agents
```

On later boots it reads `seeded 0 agents`.

Data lives in the `pgdata` volume, so `docker compose down` keeps agents and run
history. To start from an empty database, remove the volume as well:

```bash
docker compose down -v
```

## Running against real Gemini

The stack defaults to the deterministic mock provider, so it runs offline with no
credentials and the tool trace still renders. To demo against live Gemini, set
both values in `.env`:

```bash
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

Then rebuild the API image so the `adk` extra is installed, and restart:

```bash
docker compose up -d --build api
```

`GET /api/health` reports `"mode": "live"` instead of `"mock"`, and the header in
the UI shows it.

## Configuration

One file: **`.env` in this directory**, which Compose reads automatically because
this is the directory holding `docker-compose.yml`. Copy `.env.example` to start.
Nothing in it is required — every value has a default in the compose file.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `WEB_PORT` | compose | Host port the UI is published on (default 8080) |
| `POSTGRES_PASSWORD` | compose | Applied at initdb only; `DATABASE_URL` is built from it |
| `LLM_PROVIDER` | app | `mock` (default) or `adk_gemini` |
| `GEMINI_API_KEY` | app | Required only when the provider is `adk_gemini` |
| `TOOL_HTTP_TIMEOUT_MS` | app | Timeout for the `http_request` tool |
| `LOG_PAYLOAD_MAX_BYTES` | app | Cap on tool payloads stored in run history |
| `KNOWLEDGE_MAX_BODY_BYTES` | app | Largest knowledge document accepted, in UTF-8 bytes |
| `PUBLIC_ORIGIN` | compose | Prod overlay only; the API's CORS fallback |
| `CLOUDFLARE_TUNNEL_TOKEN` | compose | Prod overlay only |

The scope column is the thing to understand. **Compose-scoped** variables are
substituted into `docker-compose.yml` and never enter a container — which is how
the Cloudflare tunnel token stays out of the API's environment. **App-scoped**
variables reach the API only because the `environment:` block in
`docker-compose.yml` lists them by name. That block is the complete inventory of
what the container receives, so adding a setting to `app/config.py` means adding
a line there too.

`STORE_BACKEND`, `DATABASE_URL`, and `CORS_ORIGIN` are set in that block but are
not in the table, because they describe the compose network rather than a
preference. `STORE_BACKEND=memory` in `.env` does nothing, deliberately: it
would detach the API from the database it just waited for.

## Publishing it on a domain

`docker-compose.prod.yml` overlays a Cloudflare Tunnel onto the same stack:

```bash
cp .env.example .env      # set PUBLIC_ORIGIN and CLOUDFLARE_TUNNEL_TOKEN
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Create the tunnel in Cloudflare Zero Trust > Networks > Tunnels and point its
public hostname at `http://web:80`. No ports need forwarding and your IP stays
private; TLS is Cloudflare's.

It is a separate file on purpose. `docker-compose.yml` has to stay zero-config so
that a fresh clone runs with one command — a base file provisioning certificates
for a domain it does not own would fail everywhere else.

## Automatic production deploys

`.github/workflows/deploy-production.yml` deploys every successful push to
`main`. It first runs the frontend test suite and production build on a
GitHub-hosted runner. Only then does it run the production Compose command on a
repository-scoped self-hosted runner installed on the Docker host. Deployments
are serialized, so a new push waits for any active deploy rather than cancelling
an in-progress Compose operation.

### One-time runner setup

1. On the production host, install a current GitHub Actions self-hosted runner
   from **Repository settings → Actions → Runners → New self-hosted runner**.
   Register it to this repository only, select Linux, and add the
   `production` label during setup.
2. Run the runner as a dedicated service account with permission to use Docker.
   Confirm that account can run `docker compose version` without `sudo`.
3. Store the Compose environment file outside the Actions checkout, because
   `actions/checkout` removes ignored files by default:

   ```bash
   sudo install -d -m 750 /etc/agent-platform
   sudo cp .env.example /etc/agent-platform/production.env
   sudo chmod 640 /etc/agent-platform/production.env
   ```

   Set the production values in `/etc/agent-platform/production.env`, including
   `PUBLIC_ORIGIN` and `CLOUDFLARE_TUNNEL_TOKEN`. Make the file readable by the
   runner service account and keep it off all Git working trees.
4. Protect `main`: require pull-request review and required checks before merge.
   The production runner can run Docker commands on the host, so it must never
   execute untrusted pull-request workflows. This workflow triggers only on
   trusted pushes to `main`.

The deployment job passes `/etc/agent-platform/production.env` explicitly with
`--env-file`, validates the merged Compose configuration, and runs:

```bash
docker compose --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --wait --wait-timeout 120
```

It then confirms the services are listed by Compose and that nginx responds at
the published `web:80` port. A redirect to the configured password gate is a
valid response.

### Manual rollback

This deployment builds from the checked-out source, so retain known-good commit
SHAs. To roll back after a failed or unsuitable release, check out one on the
production host and apply the same production command:

```bash
git checkout <known-good-commit>
cd AgentPlatform-BackEnd/deployment
docker compose --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --wait --wait-timeout 120
```

**Gate a public instance, or keep it on `mock`.** The API has no authentication
of its own, so an ungated instance running `adk_gemini` lets anyone spend your
Gemini credit. Either set `WEB_PASSWORD` in `.env` — nginx then demands a cookie
before serving the UI or proxying `/api`, and visitors enter it once — or leave
the provider on `mock`, which runs the complete flow (tool calls, trace,
execution logs) with no API calls at all, making a public demo both fully
functional and free.

Read [Known limitations](#known-limitations) before publishing.

### A live-Gemini demo for a named audience

Showing the platform on `mock` undersells it — the point of the architecture is
that a real model drives real tools. Live Gemini on a public hostname is fine
**for a known audience**, provided the audience is enforced rather than assumed.
A tunnel hostname is a public URL: anyone holding it can reach the API, and there
is no authentication and no rate limiting, so an open instance is a free LLM
proxy on your key as well as a delete button on your seeded agents.

Three steps, in this order:

1. **Close the published port.** Set `WEB_BIND=127.0.0.1` in `.env`. The tunnel
   is unaffected — `cloudflared` reaches `web:80` over the compose network — but
   the host's public IP stops answering on `WEB_PORT`. Skip this and step 2 is
   trivially bypassed.
2. **Put a gate in front of it.** Either set `WEB_PASSWORD` in `.env` — one
   shared passphrase, a login page in front of both the UI and `/api`, and the
   visitor's browser remembers it for a year — or add a **Cloudflare Access
   policy** on the tunnel hostname (Zero Trust > Access > Applications) allowing
   only specific email addresses, which costs the viewer a one-time code but
   gives you per-person identity and revocation. `WEB_PASSWORD` also covers the
   published host port; Access does not.
3. **Switch the provider and rebuild**, so the `adk` extra is present in the
   image:

   ```bash
   # .env
   LLM_PROVIDER=adk_gemini
   GEMINI_API_KEY=your-key
   WEB_BIND=127.0.0.1
   ```

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

Confirm before presenting: `GET /api/health` reports `"mode": "live"`, the UI
header shows it, and the hostname prompts for Access in a private window. Use a
key scoped to the Gemini API with a spending cap on the Google Cloud project,
so a mistake in any of the above costs a capped amount rather than an open one.

Reverting to `mock` afterwards is two lines in `.env` and one `up -d --build`.

### Surviving a reboot

The prod overlay sets `restart: unless-stopped` on all four services, and Docker
is enabled at boot on a normal install, so the stack and the tunnel come back by
themselves. The `pgdata` volume is named, so agents and run history survive.

Two things to know about what that looks like:

**The restart policy lives in the overlay, not the base file.** Bring the stack
up with `docker compose up -d` alone and the containers are recreated with *no*
restart policy, and nothing returns after the next reboot. Nothing looks wrong
until weeks later, so on a published host always pass both files:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Expect a short 502 window after boot.** `depends_on` applies to `compose up`
and is *not* re-evaluated when the daemon restarts containers, so `api` can start
before Postgres accepts connections, fail to apply `schema.sql`, and exit.
`unless-stopped` restarts it and it settles within seconds, but the site is
briefly up while the API is not.

Related: **editing `.env` and running `docker compose restart` does nothing.**
`restart` reuses the container's stored environment. Recreate with `up -d`
instead — that applies to rotating `WEB_PASSWORD` as much as to anything else.

### Debugging a tunnel that 502s for some clients but not others

Symptom: the site works from one machine and returns a bare `error code: 502`
from another, consistently rather than intermittently, with **nothing in the
nginx access log** for the failing requests.

The usual cause is a *second* connector registered to the same tunnel — most
often a host-level `cloudflared.service` left over from an earlier install,
running alongside the container. Cloudflare load-balances across every
connection the tunnel has, and HTTP keep-alive pins a given client to one of
them, which is why the split looks per-machine. The host process cannot resolve
`web` (that name only exists on the compose network), so every request routed to
it dies before reaching nginx.

Check the host, not Cloudflare — the dashboard reports the tunnel healthy either
way:

```bash
systemctl is-active cloudflared          # expect: inactive
ps aux | grep [c]loudflared              # expect: only the container's process
journalctl -u cloudflared --since -10min | grep 'Unable to reach the origin'
```

`sudo systemctl disable --now cloudflared` removes the duplicate. Everything
else — DNS, the certificate, the route binding — is a red herring here, and will
all check out correctly while half the traffic fails.

## Known limitations

This is a proof-of-concept deployment. It runs the platform end to end and is
honest about what it does not do. The list below is ordered by what would bite
first if this were pointed at real users; each item says what to do instead.

### Fix before exposing it publicly

**The published port bypasses the tunnel unless you close it.** `web` publishes
`${WEB_PORT}` on `${WEB_BIND}`, which defaults to `0.0.0.0` so the local run
works. Left at that default on a public host, the host's own IP answers on 8080
and skips Cloudflare entirely — and with it any Access policy on the tunnel
hostname. **Set `WEB_BIND=127.0.0.1` in `.env` before publishing.**

It is a variable in the base file rather than an override in
`docker-compose.prod.yml` because Compose *appends* port mappings across files
instead of replacing them: an override would bind 8080 twice and conflict. That
also means there is no way to make prod safe by default here — it depends on the
variable being set, so check it.

**The API has no authentication of its own — `WEB_PASSWORD` is the only gate,
and it lives in nginx.** Set it and nginx demands the cookie before proxying
anything to `/api/`, so curl is covered as well as the browser, and so is the
published host port. Leave it empty and every route is open: a caller can `POST
/api/agents` with an arbitrary system prompt and then chat with it, which makes
an open instance a free LLM proxy on your key whenever the provider is
`adk_gemini`. `DELETE /api/agents/:id` and the whole of `/api/triggers` are open
on the same terms — and one interval trigger is an unattended agent run every
minute, which is the expensive one.

What the gate is not: it is a single shared secret with no identity, no audit
trail, no logout, and no rate limiting. Rotating it means editing `.env` and
recreating `web`, which revokes access for everyone at once. Anything that
reaches `api:4000` without passing through nginx — another container on the
compose network, or a second tunnel hostname pointed straight at the API — skips
it entirely. Cloudflare Access is still the answer when you need per-person
identity; application-level auth is not implemented.

**Credentials are plain environment variables.** `GEMINI_API_KEY` and the tunnel
token are visible to `docker inspect` and to any process inside the container.
Docker secrets or a secret manager is the real fix.

**Nothing validates that a live provider has a key.** `LLM_PROVIDER=adk_gemini`
with an empty `GEMINI_API_KEY` starts cleanly and reports `"mode": "live"`,
because the ADK import is deferred — the failure only appears as a
`provider_error` on the first chat request.

### Fix before it holds data you care about

**No backups.** Agents and the entire run history live in the `pgdata` volume
with no dump, no restore path, and no retention policy on the `runs` and
`run_tool_calls` tables, which grow without bound. `docker compose down -v`
destroys all of it.

**The database password is fixed at first boot.** Postgres applies
`POSTGRES_PASSWORD` at initdb only. Miss it before the first `up` and the
deployment keeps `app`/`app` until you delete the volume — which also deletes the
data. Set it before the first boot, not after.

**No migrations.** `app/core/schema.sql` is applied on every startup and every
statement is `IF NOT EXISTS`, which handles creation but cannot alter an existing
table. Any schema change against a populated database is a manual job. Alembic is
the intended answer once the schema changes under real data.

### Fix before scaling past one API container

**Seeding races.** `seed_agents` runs `SELECT count(*)` and then inserts inside
one transaction, but at the default READ COMMITTED isolation two API replicas
starting against an empty database can both read zero. The inserts use fixed
primary keys and no `ON CONFLICT`, so the loser raises a unique violation during
lifespan startup and the container fails to boot. An advisory lock or
`ON CONFLICT DO NOTHING` would make it safe.

**Everything assumes one replica.** The container stack is a single `api`
service; there is no load balancer, no session affinity, and no readiness gate
beyond the healthcheck.

### Operational gaps

**Images are not reproducible or rollback-able.** `cloudflared:latest` is
unpinned, `postgres:16-alpine` floats on minor versions, and prod builds from
source on the host with `--build` — there is no registry, no tagged release, and
no previous image to roll back to.

**Every deploy is a brief outage.** One replica of each service and no rolling
update, so any `up -d` that recreates `web`, `api` or `cloudflared` returns 502
for a few seconds. Fine for a demo; it is why the tunnel blips when you rotate a
setting.

**No log rotation and no resource limits.** Container logs grow until the disk
does. Nothing constrains memory or CPU, so one runaway `http_request` tool call
affects the whole host.

**TLS stops at Cloudflare.** Traffic from `cloudflared` to `web` and from `web`
to `api` is plain HTTP inside the compose network, and the base stack on
localhost has no TLS at all.

**Client IPs are the tunnel's.** The API does not read `X-Forwarded-For`, so
logs attribute every request to the proxy rather than the caller.
