# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always attach a kill date to every feature flag

- **Context**: Any phase that introduces a feature flag
- **Problem**: Flags accumulate, become permanent, nobody knows if they're safe to remove.
- **Rule**: Always attach a kill date or cleanup ticket to every feature flag at creation time.
- **Applies to**: all
