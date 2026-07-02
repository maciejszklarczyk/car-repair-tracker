---
change_id: reactive-cost-km
title: Reactive cost/km update after repair delete
status: impl_reviewed
created: 2026-06-26
updated: 2026-07-02
archived_at: null
---

## Notes

Cost/km metric on vehicle detail page stays stale after local-state delete of a repair (F3 from vehicle-god-page impl review). Metric is server-rendered in Astro template, outside React island boundary. Fix requires pulling cost/km into a React island or adding cross-island state so it recalculates client-side after delete.
