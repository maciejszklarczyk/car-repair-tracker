# Changelog

## 2026-06-08

- [d2c8dbf] fix: resolve all ESLint/Prettier errors in service-reminders files
- [8bf4e13] chore(seed): add two service_thresholds — oil change (ok) and air filter (approaching)
- [b10d08b] fix: use en-GB locale for consistent dd/mm/yyyy date display
- [235b3dc] fix(service-reminders): impl-review fixes — ownership checks, error handling, schema refine
- [6467187] fix(service-reminders): relax car_id validation to accept non-v4 UUIDs

## 2026-06-02

- [aa7a576] chore(context): add missing plan briefs and plan reviews
- [f17bd45] fix(validate-repair-mileage): impl-review fixes — event type, targeted select, report saved
- [f82044c] ci(migrate): link project before db push, fix unknown flag error
- [2242788] ci: add migrate job to apply Supabase migrations before deploy
- [2ca8213] docs(roadmap): update statuses S-01–S-04 done, S-08 implemented
- [6389602] chore(seed): add oil change and rozrząd repairs, fix baseline_mileage
- [3b532dd] fix(cost-per-km): review fixes — ownership guard, error handling, archived filter
- [382e558] fix(repair-history): impl-review fixes — null guard, dead prop, schema comments, generic errors
- [ce840cb] fix(repair-api): revert unnecessary !repair guard flagged by lint

## 2026-05-21

- [8df900a] fix(docker): replace --spider with -O /dev/null in healthcheck
- [e640cdd] build: switch adapter to Node.js, add Docker + CI/CD pipeline

## 2026-05-20

- [f386593] docs(infra): add infrastructure decision and deployment plan
- [8c24d7f] chore: bootstrap project with Astro/Supabase/Cloudflare stack
