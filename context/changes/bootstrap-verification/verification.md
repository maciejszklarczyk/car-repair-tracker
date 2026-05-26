---
bootstrapped_at: 2026-05-20T21:19:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: car-repair-tracker
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: car-repair-tracker
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack**: Solo developer building a car repair tracker MVP in 7 weeks (after-hours only) with auth and AI classification as the two technology-forcing features. The 10x Astro Starter is the recommended default for (web-app, js) and clears all four agent-friendly gates: typed (TypeScript + Zod), convention-based (Astro file-based routing), popular in training data, and well-documented. Supabase provides auth and Postgres out of the box, eliminating the need to wire auth or pick a database separately. Deployment target is self-host via Docker with Cloudflare Tunnel and Traefik instead of the starter's default Cloudflare Pages — a non-default but straightforward path requiring a Dockerfile and SSR adapter. AI classification hits an external free-tier provider, so no special framework support is needed. CI runs on GitHub Actions with auto-deploy-on-merge.

## Pre-scaffold verification

| Signal      | Value   | Severity | Notes                                                                          |
| ----------- | ------- | -------- | ------------------------------------------------------------------------------ |
| npm package | not run | n/a      | cmd_template starts with `git clone` — npm package name not derivable; skipped |
| GitHub repo | not run | n/a      | `gh` CLI not found in PATH; recency check unavailable                          |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: cloned starter repo into temp directory, deleted upstream git history, moved files up
**Exit code**: 0
**Files moved**: 48 source files + node_modules tree (774 packages, 895 total incl. dev/optional)
**Conflicts (.scaffold siblings)**: `README.md` (→ `README.md.scaffold`)
**.gitignore handling**: append-merged (cwd had existing .gitignore; scaffold lines de-duped and appended with `# from 10x-astro-starter` separator)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/3/0 direct of total 0/1/10/0

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** — range `5.6.3 – 5.8.0` (transitive, via Astro internals)
  Advisory: GHSA-77vg-94rm-hx3p — "Svelte devalue: DoS via sparse array deserialization"
  CVSS 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)
  Fix available: `npm audit fix`

#### MODERATE findings

| Package                    | Direct? | Via                                     | Fix                                   |
| -------------------------- | ------- | --------------------------------------- | ------------------------------------- |
| `@astrojs/check`           | yes     | `@astrojs/language-server`              | `@astrojs/check@0.9.2` (major bump)   |
| `@astrojs/cloudflare`      | yes     | `@cloudflare/vite-plugin`, `wrangler`   | `@astrojs/cloudflare@12.6.13` (major) |
| `wrangler`                 | yes     | `miniflare`                             | `wrangler@3.107.3` (major)            |
| `@astrojs/language-server` | no      | `volar-service-yaml`                    | via `@astrojs/check` major bump       |
| `@cloudflare/vite-plugin`  | no      | `miniflare`, `wrangler`, `ws`           | via `@astrojs/cloudflare` major bump  |
| `miniflare`                | no      | `ws`                                    | via `@astrojs/cloudflare` major bump  |
| `volar-service-yaml`       | no      | `yaml-language-server`                  | via `@astrojs/check` major bump       |
| `ws`                       | no      | upstream advisory (GHSA-58qx-3vcg-4xpx) | via `@astrojs/cloudflare` major bump  |
| `yaml`                     | no      | upstream advisory (GHSA-48c2-rrv3-qjmp) | via `@astrojs/check` major bump       |
| `yaml-language-server`     | no      | `yaml`                                  | via `@astrojs/check` major bump       |

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | self-host            |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | true                 |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- Review `README.md.scaffold` (the conflict policy preserved your existing `README.md`; diff them to see what the starter shipped).
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
- The HIGH finding (`devalue`) is transitive and advisory only for a dev-time scaffold; run `npm audit fix` when you're ready.
- `deployment_target: self-host` deviates from the starter's default Cloudflare Pages — you will need to add a Dockerfile and swap the Astro adapter when ready.
