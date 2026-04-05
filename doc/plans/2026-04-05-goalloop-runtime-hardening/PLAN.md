# GoalLoop Runtime Hardening Tracker

This tracker records the repo and deployment work required to make `goal_loop` operate as the default execution model instead of falling back to generic employee heartbeats. It is the handoff record for future agents and must be updated after each step is implemented and tested before the next step begins.

Last updated: 2026-04-05
Current task: 9. Clear the live Titan goal 2 blocker (`TIT-300`), then resume goal 2 through normal GoalLoop wake flow
Next task: 10. Promote the remaining Titan goals sequentially with live checks once goal 2 reaches measurement

[x] 1. Freeze the GoalLoop runtime contract in docs
[x] 2. Remove generic wakes from `goal_loop` mode
[x] 3. Make goal progression fully state-driven
[x] 4. Make blockers resumable first-class runtime state
[x] 5. Make sessions task-scoped in `goal_loop` mode
[x] 6. Align Goal detail and dashboard with runtime state
[x] 7. Add GoalLoop observability and stale-run detection
[x] 8. Validate on Titan staging clone
[] 9. Deploy to Titan live and complete goal 2 through measurement
[] 10. Promote remaining Titan goals sequentially with live checks

## Completion Log

- 2026-04-05: Locked the runtime contract in `doc/PRODUCT.md` and `doc/SPEC-implementation.md` so `goal_loop` wakes are required to be goal-bound or explicitly skipped, and real external blockers are treated as `needs_human_decision`. Checks: local review plus `pnpm -r typecheck`.
- 2026-04-05: Hardened server routing and runtime state in `goal-loop` and `heartbeat` services. Blocked worker phases now resolve back to director-level handling, worker auto-routing ignores blocked issues, and goal-loop wakes no longer rely on stale generic task scopes. Checks: `pnpm -r typecheck`; `pnpm --filter @paperclipai/server exec vitest run src/__tests__/goal-loop-service.test.ts src/__tests__/goal-loop-routes.test.ts`.
- 2026-04-05: Added company-level GoalLoop health plus operator-facing Goal detail and Dashboard runtime surfaces. The board can now see actionable issue, next wake target, blocked reason, blocked run counts, orphaned runs, skipped wakes, and generic heartbeat leakage directly in the UI. Checks: `pnpm -r typecheck`; `pnpm --filter @paperclipai/server exec vitest run src/__tests__/goal-loop-service.test.ts src/__tests__/goal-loop-routes.test.ts`.
- 2026-04-05: Synced the runtime hardening patch into the Titan staging checkout at `/opt/paperclip-goalloop-cutover-live` and validated the staged build. Checks: VPS `pnpm -r typecheck`; VPS `pnpm build`. Note: the focused `goal-loop-routes` wake test still reproduced a Linux-only 500 in the staging Vitest harness even though the same test passed locally and the live API validation below confirmed the route works end to end.
- 2026-04-05: Deployed the runtime hardening patch to the live Titan checkout at `/opt/paperclip`, after creating rollback snapshot `/home/paperclip/cutovers/2026-04-05-goalloop-runtime-hardening/paperclip-live-predeploy-20260405-125818.tgz`. Checks: VPS `pnpm --filter @paperclipai/server exec vitest run src/__tests__/goal-loop-service.test.ts`; VPS `pnpm -r typecheck`; VPS `pnpm build`; `systemctl restart paperclip.service`; `curl http://127.0.0.1:3100/api/health`.
- 2026-04-05: Validated the live GoalLoop routing fix against Titan data. `GET /api/goals/906b6c11-9124-419e-a394-df6e7f9ea647/runtime` now exposes `actionableIssueId`, `blockedBy`, and `nextWakeTarget`, `GET /api/companies/9299cf0c-2857-4d8c-8eb2-a4332ed5a21e/goal-loop/health` reports the blocked run directly, a generic CEO wake now queued heartbeat run `e72a257d-8cb4-413c-bc8c-2863c3ab4150` with `goalRunId = 9d377cd3-6951-4275-a246-15054926f488`, `goalRunPhase = production`, and `issueId = 1cdbcfa7-f1d9-4783-a25e-82c0f6219a6a`, and `POST /api/goal-runs/9d377cd3-6951-4275-a246-15054926f488/wake` returned the same goal-bound run instead of a generic session resume. The temporary validation key was revoked immediately after use. Step 9 stays open because goal 2 is still correctly blocked on manual GoHighLevel workflow issue `TIT-300`, so it has not yet completed verification or measurement.
