---
change_id: issue-58
title: Repair mileage not validated against previously logged repairs
status: implementing
created: 2026-07-03
updated: 2026-07-03
archived_at: null
---

## Notes

GitHub issue: https://github.com/maciejszklarczyk/car-repair-tracker/issues/58

Repair mileage is only validated against `car.baseline_mileage`, never against the mileage of previously logged repairs for the same vehicle — so a new repair can be saved with a lower mileage than an earlier one.

- `src/pages/api/repairs.ts:46` (create)
- `src/pages/api/repairs/[id].ts:57` (update)

Suggested fix: validate submitted mileage `>=` the highest mileage among the vehicle's existing repairs, in addition to the baseline check.

Related gaps surfaced during the same audit (not yet scoped, may become separate changes):
- `repair_date` has no format/range validation (no future-date check).
- `last_performed_mileage` on a service threshold (`src/lib/schemas.ts:32,44`) isn't validated against the vehicle's `baseline_mileage`.
- No cross-field check that a threshold's `last_performed_date`/`last_performed_mileage` are consistent with the vehicle's actual logged repairs.
