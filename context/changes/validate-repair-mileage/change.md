---
change_id: validate-repair-mileage
title: Validate repair mileage >= vehicle baseline mileage
status: impl_reviewed
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

GitHub issue #24. Repair forms accept any mileage >= 0, including values below the vehicle's baseline_mileage. Fix: add server-side guard in POST and PUT API routes, and inline client-side validation in both AddRepairForm and EditRepairForm.
