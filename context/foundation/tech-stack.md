---
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
---

## Why this stack

Solo developer building a car repair tracker MVP in 7 weeks (after-hours only) with auth and AI classification as the two technology-forcing features. The 10x Astro Starter is the recommended default for (web-app, js) and clears all four agent-friendly gates: typed (TypeScript + Zod), convention-based (Astro file-based routing), popular in training data, and well-documented. Supabase provides auth and Postgres out of the box, eliminating the need to wire auth or pick a database separately. Deployment target is self-host via Docker with Cloudflare Tunnel and Traefik instead of the starter's default Cloudflare Pages — a non-default but straightforward path requiring a Dockerfile and SSR adapter. AI classification hits an external free-tier provider, so no special framework support is needed. CI runs on GitHub Actions with auto-deploy-on-merge.
