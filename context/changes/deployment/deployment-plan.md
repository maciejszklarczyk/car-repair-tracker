# First Deployment: Self-hosted Docker + Cloudflare Tunnel

## Prerequisites

Everything in this section must be in place **before** executing the plan. Grouped by where you do the work.

### Local machine

| Requirement                       | Check                    | Notes                                                  |
| --------------------------------- | ------------------------ | ------------------------------------------------------ |
| Node.js 22.14.0                   | `node -v` → `v22.14.0`   | Use `.nvmrc`: `nvm use`                                |
| Docker Desktop (or Docker Engine) | `docker --version`       | Used for local build + run tests                       |
| Docker Compose v2                 | `docker compose version` | Bundled with Docker Desktop; separate install on Linux |
| Supabase CLI (optional)           | `npx supabase --version` | Only needed if running local Supabase stack            |

### Supabase Cloud

You need a **hosted Supabase project** (free tier is fine). Self-hosting Supabase is explicitly out of scope for this MVP.

1. Create a project at [supabase.com](https://supabase.com) if you don't have one.
2. Go to **Project Settings → API**.
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_KEY`
4. Go to **Authentication → Email → Confirm email** and toggle it **off** for local development (optional but removes email-verification friction during dev).
5. No database tables are needed yet — Supabase Auth uses the built-in `auth.users` table.

### Cloudflare account

You need a **Cloudflare account with Zero Trust** (free plan covers this). The tunnel connects your homelab to the internet via Cloudflare's edge — no open ports needed.

1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. You need a **domain managed by Cloudflare** (DNS pointing to Cloudflare nameservers). Free domains: register anywhere → point NS to Cloudflare.
3. Go to **Zero Trust → Networks → Tunnels → Create a tunnel**.
   - Tunnel type: **Cloudflared**
   - Name: e.g. `homelab`
   - After creation, copy the **Tunnel Token** → `CLOUDFLARE_TUNNEL_TOKEN`
4. Add a **Public Hostname** to the tunnel:
   - Subdomain: e.g. `car-tracker` (or root domain)
   - Domain: your Cloudflare-managed domain
   - Service: `http://app:4321` (this is the Docker container name + port)
5. Save. The public URL `https://car-tracker.yourdomain.com` will now route through the tunnel to your homelab.

### GitHub repository

| Requirement                       | Check                               | Notes                                     |
| --------------------------------- | ----------------------------------- | ----------------------------------------- |
| Repo exists on GitHub             | Already done                        | Current remote must be on GitHub for GHCR |
| GitHub Container Registry enabled | Automatic                           | GHCR is enabled for all GitHub accounts   |
| `SUPABASE_URL` secret set         | Repo → Settings → Secrets → Actions | Used by the CI build step                 |
| `SUPABASE_KEY` secret set         | Same location                       | Used by the CI build step                 |

GHCR image will be published at `ghcr.io/GITHUB_USERNAME/car-repair-tracker:latest`. Replace `GITHUB_USERNAME` with your actual GitHub username in `docker-compose.yml`.

### Homelab server

| Requirement                                 | Check                                         | Notes                                                              |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| Linux server (x86_64 or ARM64)              | —                                             | The homelab machine                                                |
| Docker Engine installed                     | `docker --version` on homelab                 | [Install guide](https://docs.docker.com/engine/install/)           |
| Docker Compose v2 installed                 | `docker compose version`                      | Included with Docker Engine ≥ 23                                   |
| Outbound HTTPS access                       | Can reach `github.com` and `registry.ghcr.io` | Needed to pull images                                              |
| `~/car-repair-tracker/` directory created   | `mkdir -p ~/car-repair-tracker`               | Working directory for compose stack                                |
| `.env` file created in that directory       | —                                             | Contains `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_TUNNEL_TOKEN` |
| Self-hosted GitHub Actions runner installed | `systemctl status actions.runner.*`           | See setup steps below                                              |

**Self-hosted runner setup (one-time):**

1. Go to your GitHub repo → Settings → Actions → Runners → **New self-hosted runner**
2. Select OS (Linux) and architecture (x64 or ARM64)
3. Follow the download + configure commands shown in the UI
4. Start as a service: `sudo ./svc.sh install && sudo ./svc.sh start`
5. Verify in GitHub UI: runner appears as **Idle**

The runner polls GitHub outbound — no firewall changes needed.

---

## Context

The project was bootstrapped with the `10x-astro-starter` which targets Cloudflare Workers by default. The infrastructure decision (recorded in `context/foundation/infrastructure.md`) is to self-host via Docker + Cloudflare Tunnel on a homelab. This plan migrates the project from the Cloudflare Workers adapter to the Node.js adapter, adds Docker deployment files, and wires up CI/CD for automated deploys.

**Key finding:** `src/lib/supabase.ts` and `src/lib/config-status.ts` both import from `astro:env/server` — **no changes needed**. The `astro:env` virtual module is adapter-agnostic; with the Node.js adapter it reads from `process.env` automatically.

**CI bug found:** `.github/workflows/ci.yml` triggers on branch `master`, but the repo uses `main`. CI is currently never triggered on push.

---

## Files to Modify

### 1. `astro.config.mjs`

Swap the adapter import and usage. Keep everything else (env schema, integrations).

```js
// Remove:
import cloudflare from "@astrojs/cloudflare";
// Add:
import node from "@astrojs/node";

// Change:
adapter: cloudflare();
// To:
adapter: node({ mode: "standalone" });
```

### 2. `package.json`

- Remove `@astrojs/cloudflare` from dependencies
- Remove `wrangler` from devDependencies
- Add `@astrojs/node` to dependencies
- Add `start` script: `"start": "node ./dist/server/entry.mjs"`

### 3. `.github/workflows/ci.yml`

- Fix branch trigger: `master` → `main` (both `push` and `pull_request`)
- Add a `docker` job that builds the image and pushes to GitHub Container Registry (GHCR) on push to `main`
- Add a `deploy` job that runs on self-hosted runner and executes `docker compose pull && docker compose up -d`

CI jobs run in order: `ci` (lint + build) → `docker` (build + push image to GHCR) → `deploy` (pull + restart, runs on self-hosted runner).

The `deploy` job runs on `runs-on: self-hosted`. No inbound SSH required — the runner polls GitHub Actions and executes locally on the homelab.

Required GitHub secrets:

- `GITHUB_TOKEN` is automatic — used for GHCR push (no extra secret needed)

One-time homelab setup (before first CI deploy):

1. Go to repo → Settings → Actions → Runners → New self-hosted runner
2. Follow the Linux/ARM64 install instructions on the homelab
3. The runner service connects outbound to GitHub and picks up jobs tagged `self-hosted`

---

## Files to Create

### 4. `Dockerfile`

Multi-stage build. Stage 1 installs deps and builds. Stage 2 is the runtime image (Node 22 Alpine). Port 4321.

```dockerfile
FROM node:22.14.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.14.0-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
```

### 5. `.dockerignore`

Exclude build artifacts, secrets, and dev files from the Docker context.

```
node_modules
dist
.git
.env
.env.local
.dev.vars
```

### 6. `docker-compose.yml`

App container + cloudflared tunnel client. Traefik is omitted for the first deployment to keep the blast radius small — cloudflared can route directly to the app container.

```yaml
services:
  app:
    image: ghcr.io/GITHUB_USERNAME/car-repair-tracker:latest
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "4321"
      HOST: "0.0.0.0"
    env_file:
      - .env
    ports:
      - "4321:4321"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4321"]
      interval: 30s
      timeout: 10s
      retries: 3

  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    depends_on:
      - app
```

The `.env` file on the homelab (not committed to git) must contain:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
CLOUDFLARE_TUNNEL_TOKEN=<token from Cloudflare Zero Trust dashboard>
```

The Cloudflare Tunnel must be configured in the Zero Trust dashboard to route traffic to `http://app:4321`.

---

## Files to Delete

### 7. `wrangler.jsonc`

Obsolete after the adapter switch. Removing it avoids confusion and stale references.

---

## Critical Files

| File                       | Role                                              |
| -------------------------- | ------------------------------------------------- |
| `astro.config.mjs`         | Adapter config — the core switch                  |
| `src/lib/supabase.ts`      | Auth client — no change, `astro:env/server` works |
| `src/lib/config-status.ts` | Env check — no change                             |
| `src/middleware.ts`        | Auth middleware — no change, no CF-specific code  |
| `.github/workflows/ci.yml` | CI/CD — fix branch + add deploy jobs              |

---

## Homelab First-Deploy Checklist (manual, run once)

1. SSH into homelab
2. Create `~/car-repair-tracker/` directory
3. Upload `docker-compose.yml` (or `git clone` the repo)
4. Create `.env` with Supabase credentials and Cloudflare Tunnel token
5. `docker compose pull && docker compose up -d`
6. Verify: `docker compose ps` — both `app` and `cloudflared` should show `running`
7. Check logs: `docker compose logs -f app`
8. Test the public URL via the Cloudflare Tunnel

---

## Verification

1. **Local build check**: After adapter swap, run `npm install && npm run build` — should produce `dist/server/entry.mjs`
2. **Local run check**: `node ./dist/server/entry.mjs` — server starts on port 4321, sign-in page loads
3. **Docker build check**: `docker build -t car-repair-tracker:test .` — image builds without errors
4. **Docker run check**: `docker run -p 4321:4321 --env-file .env car-repair-tracker:test` — auth flow works end-to-end
5. **CI check**: After pushing to `main`, both `ci` and `docker` jobs pass in GitHub Actions
6. **Production check**: Public URL via Cloudflare Tunnel responds, auth flow works
