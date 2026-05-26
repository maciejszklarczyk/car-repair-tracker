---
project: Car Repair Tracker
researched_at: 2026-05-20
recommended_platform: Self-hosted Docker + Cloudflare Tunnel
runner_up: Cloudflare Workers (cloud)
context_type: mvp
tech_stack:
  language: JavaScript / TypeScript
  framework: Astro 6 SSR + React 19
  runtime: Node.js (Docker) — requires switching from @astrojs/cloudflare to @astrojs/node
  database: Supabase Cloud (auth + Postgres, free tier)
---

## Recommendation

**Deploy on Self-hosted Docker + Cloudflare Tunnel.**

The developer already runs homelab hardware with Cloudflare Tunnel and has hands-on familiarity with this setup. At the projected scale (a few users, single region, low QPS), the platform is operationally free and gives full control over the runtime environment. The key trade-off versus Cloudflare Workers is higher initial ops setup cost — including a mandatory adapter switch and CI/CD wiring — in exchange for zero platform constraints (no bundle limits, no CPU caps, no per-request billing model). Supabase Cloud free tier provides auth and Postgres without adding self-hosting complexity for the database layer; this is the correct split for a 7-week after-hours MVP.

## Platform Comparison

| Platform                           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Notes                                     |
| ---------------------------------- | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ----------------------------------------- |
| **Self-hosted Docker + CF Tunnel** | ✅ Pass   | ❌ Fail            | 🟡 Partial          | 🟡 Partial        | ❌ Fail           | Chosen. User familiarity, zero cost       |
| Cloudflare Workers (cloud)         | ✅ Pass   | ✅ Pass            | ✅ Pass             | ✅ Pass           | ✅ Pass           | Best agent tooling; 3 MB bundle cap risk  |
| Railway                            | ✅ Pass   | ✅ Pass            | ✅ Pass             | 🟡 Partial        | 🟡 Partial        | $5/month minimum; rollback dashboard-only |

**Scoring notes:**

- **Self-hosted Docker** scores Partial on agent docs (all component docs available in markdown but no single unified platform doc) and Partial on stable deploy API (Docker Compose `up -d` is repeatable but not a one-push-to-URL workflow without CI wiring). It fails managed/serverless (raw server ops) and MCP (no platform MCP server).
- **Cloudflare Workers** scores Pass on all five criteria. It was ranked #1 on agent-friendly score but swapped to runner-up because the 3 MB free-tier bundle limit and 10 ms CPU cap per request are genuine risks for an Astro 6 + React 19 SSR app, and the developer's preference for self-hosting is a valid override.
- **Railway** scores well on managed/serverless and agent docs but has no CLI rollback (dashboard-only) and a $5/month floor that conflicts with the project's 0-cost constraint.

### Shortlisted Platforms

#### 1. Self-hosted Docker + Cloudflare Tunnel (Recommended)

Developer has existing hardware, Cloudflare Tunnel already set up, and hands-on familiarity. Deployment is `docker compose pull && docker compose up -d`. Rollback is pinning image tags in `docker-compose.yml`. Cloudflare Tunnel provides TLS termination at the edge for free. Only cost is electricity. The main trade-off is that the developer is responsible for ops (monitoring, disk, restart policies) — acceptable for a personal MVP.

#### 2. Cloudflare Workers (cloud)

The Cloudflare adapter is already configured in the project — zero adapter switching required. Free tier covers this traffic easily. Best-in-class agent tooling: official MCP server with 16 sub-servers, `llms.txt` for agent-readable docs, `wrangler` CLI for deploy/rollback/logs, no infrastructure to maintain. The risks — 3 MB compressed bundle limit and 10 ms CPU cap per request on free tier — are real but discoverable early (`wrangler deploy --dry-run` catches bundle bloat before first deploy; the $5/month paid plan eliminates both constraints). Correct first choice if the developer ever wants zero infra ops.

#### 3. Railway

Excellent Node.js PaaS: Railpack auto-detects Astro, PR preview environments are built-in, `llms-full.txt` for agent-readable docs. The $5/month Hobby plan minimum is the primary blocker given the zero-cost constraint. Rollback requires the dashboard (no CLI command). MCP server exists but is not GA. A strong fallback if homelab hardware fails or becomes inconvenient.

## Anti-Bias Cross-Check: Self-hosted Docker + Cloudflare Tunnel

### Devil's Advocate — Weaknesses

1. **Adapter switch eats MVP budget.** Switching from `@astrojs/cloudflare` to `@astrojs/node` requires updating the adapter, reviewing all `astro:env/server` usage (Workers bindings vs `process.env`), and re-testing the full auth flow. Estimated half a day; unexpected env issues can compound.
2. **No auto-deploy without extra CI wiring.** A `git push` does nothing until you build a GitHub Actions workflow that SSHes into the homelab or uses a self-hosted runner. This is extra setup work before you can iterate quickly.
3. **Homelab = single point of failure.** Power cut, ISP outage, hardware failure — app goes down. No SLA. Acceptable for a personal MVP but a genuine reliability gap vs. managed platforms.
4. **Cloudflare Tunnel is a silent dependency.** If `cloudflared` crashes, the app is unreachable even if Docker is healthy. Without monitoring, you won't know for hours.
5. **Traefik + cloudflared layering adds two misconfiguration points.** TLS terminates at the Cloudflare edge; traffic inside the homelab is plain HTTP. Confusion here produces 502s that are hard to diagnose remotely.

### Pre-Mortem — How This Could Fail

_The Car Repair Tracker never launched. Here is the post-mortem:_

After agreeing to self-host, the developer spent week 1 switching the Astro adapter. The env-var access pattern — `astro:env/server` using Workers bindings vs `process.env` in Node — broke the Supabase client initialization and the middleware. Three evenings debugging. Week 2: Docker Compose with Traefik and cloudflared came up locally but not on the homelab — a Docker socket permission issue blocked Traefik's service discovery. Week 3: the CI/CD pipeline needed a self-hosted Actions runner, which required firewall changes that also broke the Cloudflare Tunnel; the developer reset to a manual deploy workflow. Week 4: homelab SSD showed SMART warnings; the developer spent the weekend doing backups. Total features shipped by week 7: the auth pages (migrated from the starter). The repair tracker itself was never started. Root cause: self-hosting is the right long-term move but the infrastructure setup competed directly with feature-building on a fixed after-hours budget.

### Unknown Unknowns

- `@astrojs/node` standalone mode requires both `dist/client/` and `dist/server/` to be present in the Docker image. A Dockerfile that only copies `dist/server/` causes 404s on all CSS/JS assets. The [Astro Docker recipe](https://docs.astro.build/en/recipes/docker/) shows the correct pattern.
- Supabase Cloud free tier connection pool is limited (default 60 connections via Supavisor). A Node.js SSR server holds connections open across requests; at modest concurrency, pool exhaustion produces DB connection errors. Use Supabase's transaction mode pooler (`?pgbouncer=true` in the connection string) if this becomes an issue.
- GitHub Actions SSH deploys to a homelab require either a self-hosted runner or SSH over the internet. The safest path: `cloudflared access ssh` exposes SSH through the existing tunnel without opening port 22 publicly.
- The Cloudflare Workers adapter and the Node.js adapter have different static asset semantics. Any middleware currently reading `CF-*` request headers (Cloudflare-specific) will need to be removed or guarded before the app runs correctly on Node.

## Operational Story

- **Preview deploys**: No automatic preview URLs. For local preview, `npm run preview` runs the built Node server. For homelab staging, add a second Docker Compose profile with a separate port (e.g. 4322) and a separate Cloudflare Tunnel route (e.g. `staging.yourdomain.com`). Manual step — not automatic per PR.
- **Secrets**: Store in a `.env` file on the homelab (not committed to git). Load via `env_file:` in `docker-compose.yml`. Rotate by updating the file and running `docker compose up -d --force-recreate`. GitHub Actions deployment secrets go in GitHub repository secrets.
- **Rollback**: Pin image tags in `docker-compose.yml` (e.g. `myapp:v1.2.3`). To revert: update the tag to the prior version and run `docker compose up -d`. If you use a CI build pipeline, keep the previous image in your local registry or tag it before each deploy. DB migrations don't roll back automatically — maintain a `migrate:down` script for each migration.
- **Approval**: Human required for: editing `.env` secrets on the homelab, running DB migrations, updating `docker-compose.yml` service definitions. Agent may perform: `docker compose pull && docker compose up -d`, reading logs via `docker compose logs -f`, checking container status via `docker compose ps`.
- **Logs**: `docker compose logs -f app` streams runtime logs. `docker compose logs -f` streams all services. Pipe to `grep` for filtering. For Cloudflare Tunnel access logs, run `cloudflared tunnel info <tunnel-name>`.

## Risk Register

| Risk                                                                     | Source           | Likelihood | Impact | Mitigation                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ---------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Adapter switch breaks Supabase auth flow (env var access pattern change) | Devil's advocate | High       | High   | Address first, before any feature work. Update `src/lib/supabase.ts` to use `process.env` instead of Workers bindings. Test sign-in/sign-up end-to-end locally before deploying.                                         |
| No CI/CD pipeline → manual deploys → slow iteration                      | Devil's advocate | High       | Medium | Set up a simple GitHub Actions workflow in week 1 that SSHes into homelab and runs `docker compose pull && docker compose up -d`. Use `cloudflared access ssh` to avoid exposing port 22.                                |
| Homelab hardware failure causes downtime                                 | Devil's advocate | Low        | Medium | Set `restart: unless-stopped` on all containers. Enable SMART monitoring (`smartmontools`) for early disk warning. Keep Cloudflare Workers as the escape hatch — the app can be deployed there quickly if homelab fails. |
| `cloudflared` crash = silent outage                                      | Devil's advocate | Medium     | High   | Add a Docker health check for the cloudflared container. Use `restart: unless-stopped`. Set up a simple uptime check (e.g. a free UptimeRobot ping on the public URL).                                                   |
| Static assets 404 after Docker build (missing `dist/client/`)            | Unknown unknowns | Medium     | High   | Verify Dockerfile copies both `dist/client/` and `dist/server/`. Test in CI before deploying.                                                                                                                            |
| Supabase Cloud connection pool exhaustion under concurrent load          | Unknown unknowns | Low        | Medium | Use Supabase transaction-mode pooler. Keep a single Supabase client instance per request via `src/lib/supabase.ts`. Monitor via Supabase dashboard.                                                                      |
| Pre-mortem: infra setup consumes all MVP weeks                           | Pre-mortem       | Medium     | High   | Time-box infra setup to week 1. If adapter switch + Docker setup + basic CI takes more than 3 evenings, switch to Cloudflare Workers (runner-up) and eliminate the ops overhead entirely.                                |

## Getting Started

1. **Switch Astro adapter to Node.js standalone:**

   ```bash
   npm remove @astrojs/cloudflare
   npm install @astrojs/node
   ```

   Update `astro.config.mjs`:

   ```js
   import node from "@astrojs/node";
   // adapter: cloudflare({ ... })  →  adapter: node({ mode: 'standalone' })
   ```

   Update `src/lib/supabase.ts` to read `process.env.SUPABASE_URL` and `process.env.SUPABASE_KEY` instead of Workers bindings.

2. **Write a minimal Dockerfile** (multi-stage build):

   ```dockerfile
   FROM node:lts-alpine AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM node:lts-alpine AS runtime
   WORKDIR /app
   COPY --from=build /app/dist ./dist
   COPY --from=build /app/node_modules ./node_modules
   ENV HOST=0.0.0.0
   ENV PORT=4321
   EXPOSE 4321
   CMD ["node", "./dist/server/entry.mjs"]
   ```

3. **Create `docker-compose.yml`** with the app container, Traefik reverse proxy, and cloudflared. Set `restart: unless-stopped` on all services. Use Docker labels for Traefik routing.

4. **Set environment variables:** create a `.env` file on the homelab (not committed to git) with `SUPABASE_URL` and `SUPABASE_KEY` from your Supabase Cloud project dashboard → Settings → API.

5. **Wire a GitHub Actions deploy workflow:** on push to `main`, SSH into the homelab (via `cloudflared access ssh` or a self-hosted runner) and run:
   ```bash
   docker compose pull && docker compose up -d
   ```

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration beyond the starter Dockerfile pattern
- CI/CD pipeline implementation details
- Production-scale architecture (multi-region, HA, DR)
- Self-hosted Supabase — evaluated and rejected for MVP due to 13-container complexity vs. 7-week budget
