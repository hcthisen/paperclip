# Step 10 VPS Validation

This note records the deployment-backed validation used to close task 10 in [PLAN.md](/C:/Github/paperclip/doc/plans/2026-04-04-goal-loop-system/PLAN.md).

It cross-references the conversion criteria in [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md), especially:

- existing classic-mode companies keep running without forced migration
- goal-loop goals can run side by side with classic goals
- output-producing work resolves through proof, verification, scoreboard updates, and runbook updates
- release verification should be proven on a real deployment shape, not only local dev data

## Environment

- Target deployment: the live Titan Claws Paperclip VPS
- Safe validation target: a staging checkout at `/opt/paperclip-goal-loop-smoke`
- Data source: a cloned backup of the running Titan Claws embedded Postgres instance, migrated through the goal-loop schema changes
- Real external surfaces present in the cloned dataset:
- local WordPress site surfaced on `https://titanclaws.com`
- connected GoHighLevel account used for email capture and social scheduling

## What Was Verified

- Migration/backfill preserved the company default as `classic` for the legacy Titan Claws company.
- Legacy Titan Claws goals remained `classic` after the migration.
- The migrated company could create and execute a new `goal_loop` goal without disturbing classic goals.
- The goal-loop run progressed through `direction`, `production`, `verification`, and `measurement`.
- A primary output was recorded, verified, surfaced in the goal output ledger, and reflected in the scoreboard and runbook.
- Repo-wide release verification passed on the Linux staging clone.

## Commands And Results

- Local workstation:
- `pnpm -r typecheck` passed
- `pnpm build` passed
- `pnpm exec vitest run server/src/__tests__/forbidden-tokens.test.ts server/src/__tests__/issue-comment-reopen-routes.test.ts server/src/__tests__/issues-goal-context-routes.test.ts server/src/__tests__/issue-document-restore-routes.test.ts` passed

- Titan Claws VPS staging clone:
- `pnpm -r typecheck` passed
- `pnpm build` passed
- `pnpm test:run` passed with `147` test files passed, `7` skipped, `742` tests passed, `32` skipped

- Titan Claws cloned-live smoke:
- `node server/node_modules/tsx/dist/cli.mjs scripts/smoke/goal-loop-upgrade-smoke.ts --db-url <cloned-db> --company-id <titan-claws-company> --goal-title 'Titan Claws goal-loop smoke step10'`
- Result: passed

## Smoke Outcome

- Company default goal mode remained `classic`.
- Legacy classic goal count remained `7`.
- Preexisting goal-loop smoke goals were tolerated on rerun and recorded explicitly instead of being treated as migration failure.
- A new goal-loop smoke goal completed successfully.
- The smoke run recorded one verified primary output with proof at `https://titanclaws.com`.
- The scoreboard recorded:
- `legacy_goal_count = 7`
- `preexisting_goal_loop_goal_count = 1`
- `verified_outputs = 1`
- `smoke_status = verified`

## Conclusion

Task 10 is complete. The goal-loop conversion now has migration/backfill coverage, coexistence validation on a production-shaped classic company, and release verification on the Titan Claws VPS staging clone, matching the rollout intent in [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md).
