# Deployment

Brings up the Agent Platform end to end with one command: Postgres for durable
agents and run history, the Python API, and nginx serving the built client and
proxying `/api` to it on the same origin.

## What it delivers

The explicit development command below starts all three services in dependency
order, applies the database schema, and seeds four sample agents and four sample
knowledge documents on first boot. The stack defaults to the offline mock LLM
provider, so it comes up and serves a working UI with no API key; flipping two
environment variables switches it to live Gemini.

## LAN development

Run these commands from this directory as the dedicated Docker operator. That
operator must be allowed to run Docker and owns the environment file, while the
file remains unreadable to other users. First create the development-only
Compose environment file outside the repository:

```bash
DEV_OPERATOR=$USER
DEV_GROUP=$(id -gn "$DEV_OPERATOR")
sudo install -d -o "$DEV_OPERATOR" -g "$DEV_GROUP" -m 750 /etc/agent-platform-development
sudo install -o "$DEV_OPERATOR" -g "$DEV_GROUP" -m 640 /dev/null \
  /etc/agent-platform-development/development.env
printf '%s\n' \
  'WEB_BIND=0.0.0.0' \
  'WEB_PORT=8081' \
  'POSTGRES_VOLUME_NAME=agent-platform-development-pgdata' \
  > /etc/agent-platform-development/development.env
```

Add `WEB_PASSWORD` to that file before allowing anyone other than trusted LAN
users to use the stack. The API has no authentication of its own, so the nginx
password gate must protect both the UI and `/api` whenever access extends past
that trusted group. Do not run the commands below with `sudo`: run them as the
same dedicated operator that owns
`/etc/agent-platform-development/development.env`. Development setup and
lifecycle commands never create, change ownership or permissions on, or
otherwise modify the production-only `/etc/agent-platform` directory.

Start the base development Compose file with its explicit project name and
environment file:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml up -d --build --wait
```

The stack is reachable at `http://<host-lan-ip>:8081`. It starts only `db`,
`api`, and `web`; it does not start a Cloudflare Tunnel. Inspect or follow the
stack with:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml ps

docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml logs -f
```

Stop it without deleting the named Postgres volume:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml down
```

The development environment file is not tracked and can hold credentials; do
not copy it into a Git working tree. For the Cloudflare Tunnel and public domain
workflow, use [Publishing it on a domain](#publishing-it-on-a-domain) instead.

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
inserts the four sample agents **only when the `agents` table is empty**. It
also inserts four sample knowledge documents only when that library is empty.
Every schema statement is `IF NOT EXISTS`, so a restart against populated data
is a no-op and an agent or document you deleted stays deleted. The log lines to
look for are:

```
postgres ready; seeded 4 agents
seeded 4 knowledge documents
```

On later boots both seed counts are zero.

Data lives in the `pgdata` volume, so the development `down` command above keeps
agents and run history. To start development from an empty database, remove its
volume as well:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml down -v
```

## Running against real Gemini

The stack defaults to the deterministic mock provider, so it runs offline with no
credentials and the tool trace still renders. To demo against live Gemini in
development, add both values to
`/etc/agent-platform-development/development.env`:

```bash
LLM_PROVIDER=adk_gemini
GEMINI_API_KEY=your-key
```

Then rebuild the API image so the `adk` extra is installed, and restart:

```bash
docker compose -p agent-platform-development \
  --env-file /etc/agent-platform-development/development.env \
  -f docker-compose.yml up -d --build api
```

`GET /api/health` reports `"mode": "live"` instead of `"mock"`, and the header in
the UI shows it.

## Configuration

Each environment has one external Compose environment file, always passed with
`--env-file`: development uses
`/etc/agent-platform-development/development.env`, while production uses the
root-owned `/etc/agent-platform/production.env`. `.env.example` is a tracked
value reference only; do not copy it to a repository `.env`.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `WEB_PORT` | compose | Host port the UI is published on (default 8080) |
| `WEB_BIND` | compose | Host interface for `WEB_PORT` (default `0.0.0.0`; use `127.0.0.1` behind the tunnel) |
| `WEB_PASSWORD` | web | Optional shared password enforced by nginx before the UI and `/api` |
| `POSTGRES_VOLUME_NAME` | compose | Docker volume name; defaults only in the base file and is required by the production overlay |
| `POSTGRES_PASSWORD` | compose | Applied at initdb only; `DATABASE_URL` is built from it |
| `LLM_PROVIDER` | app | `mock` (default) or `adk_gemini` |
| `GEMINI_API_KEY` | app | Required only when the provider is `adk_gemini` |
| `TOOL_HTTP_TIMEOUT_MS` | app | Timeout for the `http_request` tool |
| `LOG_PAYLOAD_MAX_BYTES` | app | Cap on tool payloads stored in run history |
| `KNOWLEDGE_MAX_BODY_BYTES` | app | Largest knowledge document accepted, in UTF-8 bytes |
| `TRIGGERS_ENABLED` | app | Enables the in-process trigger scheduler (default `true`) |
| `TRIGGER_TICK_SECONDS` | app | How often the scheduler checks due triggers (default 30) |
| `TRIGGER_MAX_PER_TICK` | app | Maximum due triggers started per scheduler tick (default 20) |
| `PUBLIC_ORIGIN` | compose | Prod overlay only; the API's CORS fallback |
| `CLOUDFLARE_TUNNEL_TOKEN` | compose | Prod overlay only |

The scope column is the thing to understand. **Compose-scoped** variables are
substituted into `docker-compose.yml` and never enter a container — which is how
the Cloudflare tunnel token stays out of the API's environment. **App-scoped**
variables reach the API only because the `environment:` block in
`docker-compose.yml` lists them by name. **Web-scoped** variables reach nginx
only. Those environment blocks are the complete inventory of what each
container receives, so adding a setting to `app/config.py` means adding a line
there too.

`STORE_BACKEND`, `DATABASE_URL`, and `CORS_ORIGIN` are set in that block but are
not in the table, because they describe the compose network rather than a
preference. `STORE_BACKEND=memory` in either Compose environment file does
nothing, deliberately: it
would detach the API from the database it just waited for.

## Publishing it on a domain

`docker-compose.prod.yml` overlays a Cloudflare Tunnel onto the same stack.
Production uses its explicit project and root-owned external environment file:

```bash
docker compose -p agent-platform-production \
  --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Create the tunnel in Cloudflare Zero Trust > Networks > Tunnels and point its
public hostname at `http://web:80`. No ports need forwarding and your IP stays
private; TLS is Cloudflare's.

It is a separate file on purpose. `docker-compose.yml` stays domain-neutral; a
base file provisioning certificates for a domain it does not own would fail
everywhere else.

## Automatic production deploys

`.github/workflows/deploy-production.yml` deploys every successful push to
`main`. It first runs the frontend test suite and production build on a
GitHub-hosted runner. Only then does it run the production Compose command on a
repository-scoped self-hosted runner installed on the Docker host. Deployments
are serialized, so a new push waits for any active deploy rather than cancelling
an in-progress Compose operation. Actions is the normal production deployment path; no host-checkout Compose command may run while it deploys.

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
   RUNNER_USER=terry
   RUNNER_GROUP=$(id -gn "$RUNNER_USER")
   PRODUCTION_ENV=/etc/agent-platform/production.env
   sudo install -d -o root -g "$RUNNER_GROUP" -m 750 /etc/agent-platform
   if ! sudo test -e "$PRODUCTION_ENV"; then
     sudo install -o root -g "$RUNNER_GROUP" -m 640 /dev/null "$PRODUCTION_ENV"
   fi
   sudo chown root:"$RUNNER_GROUP" "$PRODUCTION_ENV"
   sudo chmod 640 "$PRODUCTION_ENV"
   ```

   Replace `terry` with the runner service account. Root owns the directory and
   file; mode `750` lets the runner group traverse the directory, and mode `640`
   lets that group read `production.env` without granting access to other users.
   The conditional creates `production.env` only when it is absent. On an
   existing host, `chown` and `chmod` update its metadata in place without
   truncating or replacing any production setting, including the existing
   Cloudflare tunnel token. Populate or amend the file with a root-authorized
   editor and preserve those ownership and mode settings.

   Set the production values in `/etc/agent-platform/production.env`, including
   `PUBLIC_ORIGIN`, `CLOUDFLARE_TUNNEL_TOKEN`, and this required external volume
   name:

   ```dotenv
   POSTGRES_VOLUME_NAME=agent-platform-production-pgdata
   ```

   Keep the file off all Git working trees. Prepare it before the first new
   production deployment; the production overlay fails closed when
   `POSTGRES_VOLUME_NAME` is missing.
4. Protect `main`: require pull-request review and required checks before merge.
   The production runner can run Docker commands on the host, so it must never
   execute untrusted pull-request workflows. This workflow triggers only on
   trusted pushes to `main`.

The deployment job passes `/etc/agent-platform/production.env` explicitly with
`--env-file`, validates the merged Compose configuration, and runs:

```bash
docker compose -p agent-platform-production --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --wait --wait-timeout 120
```

It then confirms the services are listed by Compose and that nginx responds at
the published `web:80` port. A redirect to the configured password gate is a
valid response.

### Mandatory post-cutover acceptance

After the deployment job's `up --wait` succeeds, first confirm that the new
`agent-platform-production` `cloudflared` service is Compose-ready. It currently
declares no container healthcheck, so `up --wait` gates it on the `running`
state; if a healthcheck is added later, that check must pass too. Only then
verify the public route at the required production domain:

```bash
if systemctl is-active --quiet cloudflared; then
  echo 'host cloudflared.service is active; refusing cutover acceptance' >&2
  exit 1
fi
compose=(docker compose -p agent-platform-production \
  --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml)
cloudflared_id="$("${compose[@]}" ps --status running --no-trunc -q cloudflared)"
test -n "$cloudflared_id"
mapfile -t connector_container_ids < <(
  docker ps --no-trunc --filter status=running \
    --filter ancestor=cloudflare/cloudflared:latest --format '{{.ID}}'
)
test "${#connector_container_ids[@]}" -eq 1
test "${connector_container_ids[0]}" = "$cloudflared_id"
test "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' \
  "$cloudflared_id")" = agent-platform-production
test "$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' \
  "$cloudflared_id")" = cloudflared
mapfile -t connector_processes < <(ps -eo pid=,args= | grep '[c]loudflared')
test "${#connector_processes[@]}" -eq 1
curl --fail --silent --show-error --head https://thomas-pham.id.vn/
```

The cutover is not accepted unless the host service is inactive, exactly one
cloudflared process and exactly one running cloudflared-image container exist,
that container has the production project/service labels, and only then that
URL responds successfully. These fail-closed checks turn the troubleshooting
guidance below into a mandatory assertion and prevent split traffic through a
second connector. Reuse the existing production-only
`CLOUDFLARE_TUNNEL_TOKEN` in `/etc/agent-platform/production.env`; do not create
a second tunnel, copy the token into development, or replace the existing token
as part of this cutover.

### Cutover rollback

This rollback is specifically for the one-time volume cutover. Stop the new
production project using the cutover source, then start the retained legacy
project from a checkout pinned to the pre-cutover source revision:

```bash
docker compose -p agent-platform-production --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml \
  down

cd /opt/agent-platform-pre-cutover/AgentPlatform-BackEnd/deployment
docker compose -p deployment --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --wait --wait-timeout 120
```

The pre-cutover Compose files and project name `deployment` attach PostgreSQL to
the retained `deployment_pgdata` volume. This restores the pre-cutover data
snapshot and loses every write made after cutover. Retain `deployment_pgdata`
until a separate cleanup is explicitly approved; do not remove it as part of
the migration or routine deployment.

**Gate a public instance, or keep it on `mock`.** The API has no authentication
of its own, so an ungated instance running `adk_gemini` lets anyone spend your
Gemini credit. Either set `WEB_PASSWORD` in
`/etc/agent-platform/production.env` — nginx then demands a cookie
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

1. **Close the published port.** Set `WEB_BIND=127.0.0.1` in
   `/etc/agent-platform/production.env`. The tunnel
   is unaffected — `cloudflared` reaches `web:80` over the compose network — but
   the host's public IP stops answering on `WEB_PORT`. Skip this and step 2 is
   trivially bypassed.
2. **Put a gate in front of it.** Either set `WEB_PASSWORD` in
   `/etc/agent-platform/production.env` — one
   shared passphrase, a login page in front of both the UI and `/api`, and the
   visitor's browser remembers it for a year — or add a **Cloudflare Access
   policy** on the tunnel hostname (Zero Trust > Access > Applications) allowing
   only specific email addresses, which costs the viewer a one-time code but
   gives you per-person identity and revocation. `WEB_PASSWORD` also covers the
   published host port; Access does not.
3. **Switch the provider and rebuild**, so the `adk` extra is present in the
   image:

   ```bash
   # /etc/agent-platform/production.env
   LLM_PROVIDER=adk_gemini
   GEMINI_API_KEY=your-key
   WEB_BIND=127.0.0.1
   ```

   ```bash
   docker compose -p agent-platform-production \
     --env-file /etc/agent-platform/production.env \
     -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

Confirm before presenting: `GET /api/health` reports `"mode": "live"`, the UI
header shows it, and the hostname prompts for Access in a private window. Use a
key scoped to the Gemini API with a spending cap on the Google Cloud project,
so a mistake in any of the above costs a capped amount rather than an open one.

Reverting to `mock` afterwards means changing the two provider values in
`/etc/agent-platform/production.env` and repeating that production `up` command.

### Surviving a reboot

The prod overlay sets `restart: unless-stopped` on all four services, and Docker
is enabled at boot on a normal install, so the stack and the tunnel come back by
themselves. The `pgdata` volume is named, so agents and run history survive.

Two things to know about what that looks like:

**The restart policy lives in the overlay, not the base file.** Bring the stack
up with only the base file and the containers are recreated with *no*
restart policy, and nothing returns after the next reboot. Nothing looks wrong
until weeks later, so on a published host always pass both files:

```bash
docker compose -p agent-platform-production \
  --env-file /etc/agent-platform/production.env \
  -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Expect a short 502 window after boot.** `depends_on` applies to `compose up`
and is *not* re-evaluated when the daemon restarts containers, so `api` can start
before Postgres accepts connections, fail to apply `schema.sql`, and exit.
`unless-stopped` restarts it and it settles within seconds, but the site is
briefly up while the API is not.

Related: **editing `/etc/agent-platform/production.env` and restarting existing
containers does nothing.** A restart reuses the container's stored environment.
Repeat the full production `up -d` command above instead — that applies to
rotating `WEB_PASSWORD` as much as to anything else.

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
hostname. **Set `WEB_BIND=127.0.0.1` in
`/etc/agent-platform/production.env` before publishing.**

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
trail, no logout, and no rate limiting. Rotating it means editing the selected
external environment file and
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
`run_tool_calls` tables, which grow without bound. Running an environment's
explicit Compose command with `down -v` destroys all of it.

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
