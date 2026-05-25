# Roadmap → GitHub Issues Migration

## What was done

### 1. Roadmap analysis

Reviewed `context/foundation/roadmap.md` which contained:
- **4 delivery slices** (S-01 through S-04) ordered by dependency — S-01 is the north star, S-02/S-03/S-04 all depend on it
- **4 open questions** requiring decisions before certain slices can proceed
- **6 parked items** explicitly out of scope per PRD Non-Goals

### 2. Task management system identification

GitHub Issues on `maciejszklarczyk/car-repair-tracker` was chosen as the task management system — the repo already lives on GitHub, `gh` CLI is available, and no separate tool is needed.

Verified starting state: zero existing issues, only default labels present.

### 3. Format design

Decided on the following structure:

- **Slice issues** use `[S-XX]` prefix in title for traceability back to the roadmap
- **Labels**: created two custom labels (`slice`, `north-star`) and reused the existing `question` label
- **Issue body** follows a consistent template: Outcome, PRD refs, Prerequisites (cross-referencing issue numbers), Unknowns, Risk, and Acceptance Criteria as a checkbox list
- **Parked items** were intentionally skipped — they are non-goals and stay documented in the roadmap file
- **Open questions** were mapped to issues with the `question` label; two related AI-quality questions (audit trail + accuracy threshold) were merged into one issue

### 4. Issue creation

Created 7 issues via `gh issue create` in dependency order:

| Issue | Title | Labels | Prerequisites |
|-------|-------|--------|---------------|
| #3 | [S-01] Vehicles, repairs, and cost/km | slice, north-star | — |
| #4 | [S-02] AI repair classification | slice | #3 |
| #5 | [S-03] Service thresholds and reminders | slice | #3 |
| #6 | [S-04] Cost trend chart | slice | #3 |
| #7 | Choose AI provider (Groq vs Gemini Flash) | question | — |
| #8 | E2E testing strategy | question | — |
| #9 | AI classification audit trail and accuracy threshold | question | — |

S-01 was created first so its issue number (#3) could be cross-referenced in the prerequisite sections of S-02, S-03, and S-04.

### 5. Decisions made during migration

- **Language**: English for all issue titles and bodies (roadmap source is in Polish)
- **Parked items excluded**: no noise from out-of-scope items in the issue tracker
- **Question merging**: roadmap questions Q3 (audit trail for AI overrides) and Q4 (accuracy threshold) merged into a single issue — both are non-blocking, AI-quality-related, and inform post-launch iteration
- **No milestone/sprint assignment**: roadmap is not a calendar estimate, so no dates or sprints were attached
