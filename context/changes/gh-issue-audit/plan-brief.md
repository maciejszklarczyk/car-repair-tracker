# gh-issue-audit — Plan Brief

> Full plan: `context/changes/gh-issue-audit/plan.md`
> Opportunity map: `context/team/opportunity-map.md`
> Mom-test: `context/team/mom-test-validation.md`

## What & Why

Bash script auditing GitHub issue hygiene via `gh` CLI. Surfaces three types of drift that accumulate in a solo project: PRs without a closing keyword, open issues with no PR, and open issues that should have auto-closed after merge. Built as a proof-of-concept to practice the 10x-plan workflow — not because the pain is critical.

## Starting Point

`scripts/` directory exists with `post-edit-check.sh` as a style reference. No issue-audit tooling exists. `gh` CLI already in use. The project has ~50 open/closed issues and ~50 PRs — small enough that the script will be fast and results immediately verifiable.

## Desired End State

`bash scripts/gh-issue-audit.sh` prints three labeled sections to stdout and exits 0. Developer runs it occasionally to find forgotten issues and PRs with missing `Closes #N` keywords. No automation, no CI gate — pure diagnostic tool.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Language | bash + jq | Zero new deps beyond gh CLI; follows `post-edit-check.sh` pattern | Plan |
| Location | `scripts/` in repo | Versioned with the code, immediately discoverable | Plan |
| Link definition | `Closes\|Fixes\|Resolves #N` in PR body (case-insensitive) | Standard GitHub auto-close keyword — matches what GitHub itself parses | Plan |
| Time window | 30 days hardcoded | Single-contributor POC; configurability adds complexity with no user | Plan |
| Scope | Read-only, stdout only | Tool reports, never mutates — safe to run anytime | Opportunity map |

## Scope

**In scope:** Core script (3 sections), usage header, README entry

**Out of scope:** Auto-closing issues, CI integration, branch-name parsing, configurable flags, any write operations

## Architecture / Approach

Two `gh` calls (issues + PRs), jq for filtering and keyword extraction, bash set operations via `grep`. Cross-platform date detection handles macOS vs Linux. Output: plain text, 3 sections, always exits 0.

```
gh issue list --state open → ISSUES (JSON)
gh pr list --state merged  → PRS (JSON, last 30d via jq filter)
         ↓
jq: extract issue numbers from "Closes #N" in PR bodies
         ↓
Section 1: PRs with no closing keyword
Section 2: Open issues with no PR reference
Section 3: Open issues in merged PRs (should be closed)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Core script | Working `gh-issue-audit.sh` with 3 output sections | macOS/Linux date compat |
| 2. Docs | Usage header + README entry | None |

**Prerequisites:** `gh` CLI authenticated (`gh auth status`), `jq` installed  
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- `jq` assumed installed (standard on macOS dev machines, not guaranteed on all envs)
- `gh pr list --limit 200` is hardcoded — repos with >200 merged PRs in 30 days would be silently truncated (not a risk here)
- GitHub API rate limits: `gh` CLI handles auth tokens, unlikely to hit limits for a single audit run

## Success Criteria (Summary)

- Script runs without error on the live repo and exits 0
- Section 3 correctly identifies at least one known open issue that has a merged PR with `Closes #N`
- README lists the script alongside other dev commands
