# Goal-Loop System Implementation Tracker

This document tracks the implementation status of the goal-loop conversion. It is the handoff record for future agents and must be updated after each task is implemented and tested before the next task begins.

Last updated: 2026-04-04
Current task: Complete
Next task: None

## Checklist

[x] 1. Update product/spec docs and freeze the goal-loop contract
[x] 2. Add shared enums, types, validators, and API contracts
[x] 3. Add DB schema and migrations for goal-loop objects
[x] 4. Add backend CRUD/read APIs for context packs, briefs, recipes, scoreboards, runbooks, outputs, verifications, and leases
[x] 5. Add goal-run orchestration and phase-tagged runtime/cost accounting
[x] 6. Add proof gating and verification runtime for goal-loop output work
[x] 7. Add resource lease acquisition, queueing, and conflict handling
[x] 8. Replace onboarding with the goal-loop-first flow and keep classic as advanced
[x] 9. Redesign dashboard and goal detail UI around briefs, runs, outputs, scoreboards, and runbooks
[x] 10. Add migration/backfill, coexistence hardening, and release verification

## Completion Log

- 2026-04-04: Completed task 1 by adding the dated goal-loop design doc, adding the implementation tracker, and updating `doc/PRODUCT.md` and `doc/SPEC-implementation.md` for dual-mode execution and tracker requirements. Checks: manual content verification with `Get-Content` and `rg`; no automated tests applicable for doc-only changes.
- 2026-04-04: Completed task 2 by extending shared enums and contracts for goal-loop mode, adding the `goal-loop` shared types/validators module, and exporting the new schemas and types through `@paperclipai/shared`. Checks: `pnpm -r typecheck`.
- 2026-04-04: Completed task 3 by adding the goal-loop schema tables, extending existing runtime tables with goal-loop linkage fields, generating migration `0047_puzzling_red_wolf.sql`, and manually fixing the migration backfill so existing companies remain `classic` while new companies default to `goal_loop`. Checks: `pnpm --filter @paperclipai/db typecheck`; `pnpm --filter @paperclipai/db generate`; `pnpm -r typecheck`.
- 2026-04-04: Completed task 4 by adding a dedicated goal-loop backend service and router for context packs, company/goal runbooks, recipes, goal briefs, runtime summaries, queued goal runs, scoreboards, outputs, verifications, and resource leases; also updated company/work-product services so the new fields are exposed consistently. Checks: `pnpm -r typecheck`.
- 2026-04-04: Completed task 5 by wiring goal-run execution through server-orchestrated phase issues, phase advancement from issue status changes, goal runtime cost summaries, goal run listings, and phase-tagged runtime accounting in goal runtime and dashboard surfaces. Checks: `pnpm -r typecheck`; `pnpm build`; `pnpm exec vitest run server/src/__tests__/goal-loop-routes.test.ts server/src/__tests__/issue-goal-loop-routes.test.ts server/src/__tests__/goals-service.test.ts server/src/__tests__/goal-loop-service.test.ts`.
- 2026-04-04: Completed task 6 by enforcing proof gating on goal-loop verification/measurement completion, adding verification create/update routes and work-product status propagation, and ensuring goal-loop outputs can only resolve success after verified primary output state. Checks: `pnpm -r typecheck`; `pnpm build`; `pnpm exec vitest run server/src/__tests__/goal-loop-routes.test.ts server/src/__tests__/issue-goal-loop-routes.test.ts server/src/__tests__/goals-service.test.ts server/src/__tests__/goal-loop-service.test.ts`.
- 2026-04-04: Completed task 7 by adding resource lease acquisition and release around goal-run phases, queueing conflicting exclusive-write runs behind active leases, and exposing lease state through goal-loop APIs. Checks: `pnpm -r typecheck`; `pnpm build`; `pnpm exec vitest run server/src/__tests__/goal-loop-routes.test.ts server/src/__tests__/issue-goal-loop-routes.test.ts server/src/__tests__/goals-service.test.ts server/src/__tests__/goal-loop-service.test.ts`.
- 2026-04-04: Completed task 8 by replacing `/onboarding` with the goal-loop-first route flow, keeping the classic wizard available as an advanced fallback, and wiring launch to create the company context pack, goal, brief, scoreboard, runbook, and first goal run. Checks: `pnpm -r typecheck`; `pnpm build`.
- 2026-04-04: Completed task 9 by redesigning the goal detail and dashboard surfaces around briefs, runs, outputs, scoreboards, runbooks, goal-mode badges, and goal-loop launch/verification workflows, plus adding the dedicated UI goal-loop API client/query keys. Checks: `pnpm -r typecheck`; `pnpm build`.
- 2026-04-04: Completed task 10 by hardening migration/backfill coexistence checks, fixing repo-wide verification blockers in issue-route tests and forbidden-token/script handling, and validating the rollout against the Titan Claws VPS staging clone and migrated live-data snapshot described in `PaperclipGoalLoopSystem.md`. Checks: local `pnpm -r typecheck`; local `pnpm build`; local `pnpm exec vitest run server/src/__tests__/forbidden-tokens.test.ts server/src/__tests__/issue-comment-reopen-routes.test.ts server/src/__tests__/issues-goal-context-routes.test.ts server/src/__tests__/issue-document-restore-routes.test.ts`; VPS staging `pnpm -r typecheck`; VPS staging `pnpm build`; VPS staging `pnpm test:run`; Titan Claws cloned-live smoke via `node server/node_modules/tsx/dist/cli.mjs scripts/smoke/goal-loop-upgrade-smoke.ts --db-url <cloned-db> --company-id <titan-claws-company> --goal-title 'Titan Claws goal-loop smoke step10'`, which passed with 7 legacy classic goals preserved, 1 preexisting goal-loop smoke goal tolerated on rerun, 1 new goal-loop run succeeded, and a verified output recorded against `https://titanclaws.com`.
