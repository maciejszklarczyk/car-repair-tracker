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
