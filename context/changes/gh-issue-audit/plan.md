# gh-issue-audit Implementation Plan

## Overview

A read-only bash script (`scripts/gh-issue-audit.sh`) that audits GitHub issue hygiene for the current repo via `gh` CLI. Surfaces three classes of drift: PRs missing a closing keyword, open issues with no linked PR, and open issues that should have been auto-closed after a PR merge.

## Current State Analysis

`scripts/` directory exists with `post-edit-check.sh` — consistent place for repo dev tooling. No existing issue-audit tooling. `gh` CLI is already used in project workflow. No `jq` dependency declared anywhere — assumed available in dev environment (standard on macOS with Homebrew).

## Desired End State

Running `bash scripts/gh-issue-audit.sh` prints three labeled sections to stdout:
1. Merged PRs (last 30 days) whose body lacks `Closes/Fixes/Resolves #N`
2. Open issues not referenced in any merged PR (last 30 days)
3. Open issues referenced in a merged PR body (GitHub auto-close missed or keyword was absent)

Script exits 0 regardless of findings — it reports, never fails CI.

### Key Discoveries

- `scripts/post-edit-check.sh` exists — follow its shebang/style as the pattern (`#!/usr/bin/env bash`, `set -euo pipefail`)
- `gh pr list` has no `--since` flag — date filtering must happen in jq after fetch
- macOS `date` and GNU `date` have different flags for relative dates — script must detect and branch
- `gh issue list` defaults to 30 items — `--limit 200` required for repos with many open issues

## What We're NOT Doing

- Not auto-closing issues
- Not posting comments on PRs or issues
- Not checking branch names for issue numbers
- Not making this configurable via flags (single-contributor POC)
- Not integrating with CI — this is a manual developer tool

## Implementation Approach

Single-phase core script, then usage documentation. Fetch open issues and merged PRs separately via `gh` JSON output, parse closing keywords with jq regex, cross-reference sets, print findings grouped by section. Cross-platform date handled by detecting OS.

---

## Phase 1: Write scripts/gh-issue-audit.sh

### Overview

Create the audit script with three reporting sections. File follows the `scripts/post-edit-check.sh` pattern.

### Changes Required

#### 1. Core audit script

**File**: `scripts/gh-issue-audit.sh`

**Intent**: Fetch open issues and merged PRs (last 30 days), extract issue references from PR bodies using `Closes|Fixes|Resolves #N` pattern, then print three sections: PRs without keyword, open issues not referenced in any merged PR (last 30 days), open issues linked in merged PRs that are still open.

**Contract**: Executable bash script. No arguments. Reads `GITHUB_REPOSITORY` env var if set (for CI context), otherwise calls `gh repo view` to detect the repo. Depends on `gh` (authenticated) and `jq`. Exits 0 always. Output to stdout. Three sections separated by blank lines, each with a `---` header line.

Key cross-platform date detection:

```bash
if date -v-1d > /dev/null 2>&1; then
  SINCE=$(date -v-30d -u +%Y-%m-%dT%H:%M:%SZ)  # macOS
else
  SINCE=$(date -u -d "30 days ago" +%Y-%m-%dT%H:%M:%SZ)  # GNU/Linux
fi
```

Key jq closing-keyword extraction (case-insensitive via `(?i)` PCRE flag):

```bash
# Check if PR body contains a closing keyword
echo "$PR_BODY" | jq -r 'test("(?i)(closes|fixes|resolves) #[0-9]+")'

# Extract referenced issue numbers from a PR body
echo "$PR_BODY" | jq -r '[scan("(?i)(?:closes|fixes|resolves) #([0-9]+)"; "g")] | .[]'
```

### Success Criteria

#### Automated Verification

- File is executable: `test -x scripts/gh-issue-audit.sh`
- ShellCheck passes (if available): `shellcheck scripts/gh-issue-audit.sh || echo "shellcheck not installed, skip"`
- Script exits 0: `bash scripts/gh-issue-audit.sh; echo "exit: $?"`

#### Manual Verification

- Output shows exactly 3 labeled sections
- Section 1 lists PRs (or "none found") — cross-check one entry against actual PR on GitHub
- Section 3 shows any open issues that have a merged PR with `Closes #N` — manually verify one

**Implementation Note**: After automated checks pass, run the script against the live repo and review output before proceeding to Phase 2.

---

## Phase 2: Usage Header and README Entry

### Overview

Add a self-documenting header to the script and one-line entry in README so the tool is discoverable.

### Changes Required

#### 1. Usage comment block

**File**: `scripts/gh-issue-audit.sh`

**Intent**: Add a comment block at the top (after shebang) documenting usage, dependencies, and what each section means.

**Contract**: Comment block immediately after `#!/usr/bin/env bash`, before `set -euo pipefail`. Lists: Usage, Dependencies (gh CLI authenticated, jq), Output sections (3 items).

#### 2. README mention

**File**: `README.md`

**Intent**: Add `gh-issue-audit` to the Available Scripts section so it appears alongside `npm run dev`, `npm run test`, etc.

**Contract**: One line under `## Available Scripts`: `- \`bash scripts/gh-issue-audit.sh\` — audit GitHub issue hygiene (open issues vs merged PRs)`

### Success Criteria

#### Automated Verification

- README mentions `gh-issue-audit`: `grep -q "gh-issue-audit" README.md`

#### Manual Verification

- Script header is readable and accurate when running `head -20 scripts/gh-issue-audit.sh`

---

## Testing Strategy

### Manual Testing Steps

1. Run `bash scripts/gh-issue-audit.sh` — verify 3 sections print, script exits 0
2. Pick one entry from Section 1 (PR without keyword) — open that PR on GitHub and confirm body lacks `Closes #N`
3. Pick one entry from Section 3 (open issue in merged PR) — open that issue on GitHub and confirm it is still open
4. Merge a test PR with `Closes #N` in the body, re-run script — verify the issue disappears from Section 3

## References

- Opportunity map: `context/team/opportunity-map.md`
- Mom-test validation: `context/team/mom-test-validation.md`
- Pattern reference: `scripts/post-edit-check.sh`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Write scripts/gh-issue-audit.sh

#### Automated

- [ ] 1.1 File is executable: `test -x scripts/gh-issue-audit.sh`
- [ ] 1.2 ShellCheck passes: `shellcheck scripts/gh-issue-audit.sh || echo "shellcheck not installed, skip"`
- [ ] 1.3 Script exits 0: `bash scripts/gh-issue-audit.sh; echo "exit: $?"`

#### Manual

- [ ] 1.4 Output shows exactly 3 labeled sections
- [ ] 1.5 Cross-check one Section 1 entry against actual PR on GitHub
- [ ] 1.6 Cross-check one Section 3 entry against actual open issue on GitHub

### Phase 2: Usage Header and README Entry

#### Automated

- [ ] 2.1 README mentions gh-issue-audit: `grep -q "gh-issue-audit" README.md`

#### Manual

- [ ] 2.2 Script header readable: `head -20 scripts/gh-issue-audit.sh`
