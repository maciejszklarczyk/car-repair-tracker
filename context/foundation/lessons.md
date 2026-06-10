# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always attach a kill date to every feature flag

- **Context**: Any phase that introduces a feature flag
- **Problem**: Flags accumulate, become permanent, nobody knows if they're safe to remove.
- **Rule**: Always attach a kill date or cleanup ticket to every feature flag at creation time.
- **Applies to**: all

## Write all GitHub issues in English

- **Context**: GitHub issues — any create or edit via gh CLI or GitHub API
- **Problem**: Issues created in Polish required a follow-up translation pass, adding noise and making the repo less accessible to contributors.
- **Rule**: Every GitHub issue must be written in English — title, body, and comments — so it can be widely understood.
- **Applies to**: implement, impl-review

## Never reference Cloudflare Workers, wrangler, or .dev.vars

- **Context**: Any file touching env vars or deployment (README, .env, deploy configs, CI workflows)
- **Problem**: Stale starter-template artifacts leak in — README, docs, and configs reference Cloudflare/wrangler/.dev.vars that don't exist in this project. The project uses @astrojs/node standalone adapter with Docker deployment.
- **Rule**: Never reference .dev.vars, wrangler, or Cloudflare Workers — this project uses @astrojs/node standalone adapter with Docker deployment.
- **Applies to**: all
