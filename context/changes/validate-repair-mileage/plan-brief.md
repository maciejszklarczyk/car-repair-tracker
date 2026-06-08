# Validate Repair Mileage — Plan Brief

> Full plan: `context/changes/validate-repair-mileage/plan.md`

## What & Why

Repair forms accept any mileage ≥ 0, including values below the vehicle's `baseline_mileage`. A repair logged before ownership start is logically invalid and produces misleading cost/km data. Fix: reject such values at both the API boundary and in the client form.

## Starting Point

Both `AddRepairForm` and `EditRepairForm` validate `mileage >= 0` only. Neither API route fetches `baseline_mileage` from the car. The edit page already has the full `Vehicle` object; the add page fetches the car but omits `baseline_mileage` from the select.

## Desired End State

Entering a repair mileage below the vehicle's baseline shows an inline error — "Mileage must be at or above baseline mileage (N km)" — before submission. If the client check is bypassed, the API rejects the request with the same message.

## Key Decisions Made

| Decision        | Choice                  | Why                                                   |
| --------------- | ----------------------- | ----------------------------------------------------- |
| Scope           | Both add and edit flows | Consistency — edit should not allow values add blocks |
| Error placement | Inline on mileage field | Matches existing FormField error convention           |
| Error message   | Includes baseline value | Actionable — user knows the exact minimum             |

## Scope

**In scope:** POST and PUT API validation; AddRepairForm and EditRepairForm client-side validation

**Out of scope:** DB constraint; ordering repairs by mileage; backfilling existing invalid data

## Architecture / Approach

Phase 1 hardens the server boundary first (no client changes). Phase 2 adds the client UX. Both phases are independent enough to commit separately; Phase 1 alone prevents bad data even if JS is disabled.

## Phases at a Glance

| Phase                     | What it delivers                     | Key risk                                           |
| ------------------------- | ------------------------------------ | -------------------------------------------------- |
| 1. Server-side validation | API routes reject mileage < baseline | PUT route needs two selects (repair + car)         |
| 2. Client-side validation | Inline form errors before submission | new.astro CarRow interface + select need extending |

**Prerequisites:** None — builds on existing repair forms and API routes  
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- Existing repair records with mileage < baseline are not fixed — only new/edited entries are blocked

## Success Criteria (Summary)

- Mileage below baseline is rejected by the API with a descriptive error
- Inline error appears on the mileage field in both forms before submission
- Valid mileage submits without error on both add and edit flows
