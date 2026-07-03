# Opportunity Map

## Context

- **Project / context**: car-repair-tracker — single contributor, GitHub repo
- **Data constraint**: Mock / lokalne / read-only / niewrażliwe
- **Date**: 2026-06-28

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Otwarte issue po merge PR + brak linku PR↔issue | GitHub: "Closes #X" w opisie PR auto-zamyka issue; GitHub Projects / Milestones dają widok statusu | GitHub Action ostrzegający przy braku "Closes #X"; nightly job listujący issue z powiązanym zmergowanym PR wciąż open | Skrypt `gh` CLI: otwarte issue vs zmergowane PR (30 dni) — raport w terminalu, zero zapisu | read-only, gh CLI | Review / CI gate — PR check + scheduled Action |

## Recommended First Candidate

```
Candidate: gh-issue-audit

Reads:
  gh issue list --state open --json number,title,body
  gh pr list --state merged --json number,body,mergedAt (ostatnie 30 dni)

Returns:
  - Lista PR bez "Closes/Fixes #X" w body
  - Lista issue bez powiązanego PR
  - Lista issue wciąż open mimo zmergowanego PR

Does not do:
  Nie zamyka issue automatycznie, nie modyfikuje PR,
  nie pisze komentarzy, nie wymaga GitHub App ani tokenu
  z write scope.

Data risk:
  Read-only, publiczne lub prywatne repo przez gh CLI.
  Brak zapisu.

Direction if valuable:
  GitHub Action: (1) PR check — blokuje/ostrzega przy
  braku "Closes #X", (2) scheduled job — zamyka issue
  po merge jeśli GitHub nie złapał automatycznie.
```

## Why This Candidate

Skrypt `gh` CLI potwierdza czy problem jest realny w konkretnym repo zanim zainwestujesz w CI gate. Uruchamiasz raz, widzisz raport — jeśli 80% PR już ma `Closes #X`, ból jest mały i CI gate byłby overhead. Zero setupu poza `gh auth`.

## Next Direction If Valuable

`/10x-mom-test` — walidacja czy ból jest wystarczająco duży. Następnie jeśli problem potwierdzony: `/10x-shape` → `/10x-prd` → `/10x-new` → `/10x-plan` → `/10x-implement` (GitHub Action jako PR check + scheduled closer).
