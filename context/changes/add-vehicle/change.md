---
change_id: add-vehicle
title: Add vehicle — form, list, and DB migration
status: implementing
created: 2026-05-26
updated: 2026-05-26
archived_at: null
---

## Notes

S-01 from roadmap. Owner adds a vehicle (make, model, year, current mileage, baseline mileage) and sees it in their vehicle list.

PRD refs: FR-001, FR-002, US-01. Prerequisites: none. Status: ready.

Risk: `cars` table schema + RLS must be designed with downstream slices in mind — a mistake here propagates to S-02 (add-repair), S-03, S-04, and S-06. Verify with manual CRUD tests before moving to S-02.

See @context/foundation/roadmap.md §S-01 for full slice spec.
