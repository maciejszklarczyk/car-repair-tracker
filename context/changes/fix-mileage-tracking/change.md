---
change_id: fix-mileage-tracking
title: Fix mileage tracking — derive current mileage from repairs, fix cost/km range
status: implementing
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

`cars.current_mileage` is set at creation and never updated when repairs are added. Cost/km formula uses `current_mileage - baseline_mileage` but reads stale stored value. Fix: derive current mileage from `MAX(repairs.mileage)` on the fly so cost/km always reflects actual km driven since ownership start.
