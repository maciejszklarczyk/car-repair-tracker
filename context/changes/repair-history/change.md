---
change_id: repair-history
title: Repair history — browse, edit and delete repairs with confirmation
status: implementing
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

S-03 from roadmap. Prerequisite: S-02 (add-repair, merged). Parallel with S-04 and S-05.

Outcome: owner can browse full repair history for a vehicle, edit any repair, and delete it with a confirmation step.

Risk: deleting a repair must trigger cost/km recalculation (S-04). Implement delete with that side-effect in mind even if S-04 lands later — avoid a state where deletes silently leave stale aggregates.
