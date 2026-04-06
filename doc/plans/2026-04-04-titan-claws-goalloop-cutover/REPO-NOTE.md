# Titan Claws GoalLoop Cutover Repo Note

Date: 2026-04-04
Operator: Codex
Company id: `9299cf0c-2857-4d8c-8eb2-a4332ed5a21e`

## VPS Bundle

- Bundle path: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop`
- DB backup file: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/db-backups/titan-claws-pre-goalloop-20260404-173050.sql`
- Migration-journal backup: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/db-backups/titan-claws-pre-goalloop-journal-20260404-193800.sql`
- Repo tree tarball: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/repo-tree.tgz`
- Config copy: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/config.json`
- Service unit snapshot: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/systemd-unit.txt`
- Service status snapshot: `/home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/systemd-status.txt`
- Repo head snapshot: `63705517a569a712674f7dc1f5dbda655116a4cd`

## Archive Export

- Archive path: captured from the live bootstrap apply snapshot; the standalone live `archive` command timed out before it finished writing files
- Summary file: not written for the live run because of that timeout
- Open classic issues archived: `8`
- Active classic heartbeat runs archived: `0`
- Agents recommended for pause: `13`

## Live Validation

- GoalLoop code checkout path: `/opt/paperclip`
- Previous live checkout preserved at: `/opt/paperclip-classic-2026-04-04`
- Runtime hardening rollback snapshot: `/home/paperclip/cutovers/2026-04-05-goalloop-runtime-hardening/paperclip-live-predeploy-20260405-125818.tgz`
- Migration result: normalized the embedded Postgres migration journal, then applied `0046_smooth_sentinels.sql` and `0047_puzzling_red_wolf.sql`
- Company default goal mode after bootstrap: `goal_loop`
- Classic agents paused: `13`
- Live seeded goal IDs:
  - `Website and email capture conversion`: `a4c9f080-eefc-4ed3-9684-b0453a4251fd`
  - `Email list growth and nurture`: `906b6c11-9124-419e-a394-df6e7f9ea647`
  - `Social audience growth`: `c822db48-2f3a-427d-a011-60099eb8842f`
  - `Brand consistency across touchpoints`: `fdbae782-5ce6-4681-928e-b0698752c634`
  - `Product-market-fit and pre-sell validation`: `61a12d83-44a8-4b92-8fc0-3c5cced1d3fb`
  - `Prototype and supplier quote pipeline`: `aafdb7ed-542f-4501-92f2-b9968a3e2ee4`
- First goal launch run id: `c562fa63-9d2a-499b-bd17-ff02afbad2c5`
- First goal launch issue id: `1aa992f1-fed2-42a0-9acc-6064883aeb65`
- First goal heartbeat execution run id: `7a5ed422-2669-44b6-991f-413f86b36efa`
- First goal production issue id: `15507039-0b17-4669-bc75-a5d339c095b6`
- Core operational agents resumed after cutover: `CEO`, `CTO`, `CodeQA`, `Junior Dev 1`
- First goal verification issue id: `499e65b9-3330-4cef-be8c-8d3c3cdc36e9`
- First goal verification heartbeat run id: `d33f1aa6-7305-41c7-87c9-d4a11a7ef71d`
- First verified output id: `850e03eb-b6ca-4ce7-9790-152e6bc62282`
- First verified output proof: `https://titanclaws.com/shop/#waitlist`
- First verification run id: `166b6786-04f8-48a4-b801-caf90e9a4c5e`
- First goal measurement issue id: `404f5dc7-5fae-4135-9640-e37bbf81790f`
- First goal measurement heartbeat run id: `0e4ea8a0-4496-4129-9e10-ab2f2bc17dfe`
- First goal final status: `succeeded`
- Additional resumed agents after first-goal success: `CMO`, `ContentWriterWeb`
- Second goal launch run id: `9d377cd3-6951-4275-a246-15054926f488`
- Second goal direction issue id: `ee425458-540c-42fe-abe7-0ea08c45f63c`
- Second goal production issue id: `1cdbcfa7-f1d9-4783-a25e-82c0f6219a6a`
- Second goal active production task: `TIT-295` / `12470914-d1ae-4cca-924e-84720a2c1d50`
- CTO rebound heartbeat run after service restart: `dbb11d8e-39d5-40d2-ab5e-cfc9602850b5`
- Second goal reconciled primary output id: `8f13fbed-0ade-41f1-9e76-06ced20f43ef`
- Second goal primary output proof URLs: `https://titanclaws.com/how-to-train-a-cat-not-to-pee-everywhere/`, `https://titanclaws.com/how-to-do-cpr-on-a-cat/`
- Second goal hosted PDF proof: `https://titanclaws.com/wp-content/uploads/2026/04/indoor-cat-enrichment-checklist.pdf`
- Second goal current run status: `needs_human_decision`
- Second goal current blocker issue: `TIT-300` / `85649402-479b-407f-bb78-8a268ed232e2`

## Commands Used

```sh
systemctl stop paperclip.service
cp -a /opt/paperclip /opt/paperclip-classic-2026-04-04
cp -a /opt/paperclip-goalloop-cutover-live /opt/paperclip
```

```sh
runuser -u paperclip -- bash -lc 'cd /opt/paperclip && pnpm --filter @paperclipai/server exec vitest run src/__tests__/config-schema.test.ts'
runuser -u paperclip -- bash -lc 'cd /opt/paperclip && pnpm -r typecheck'
runuser -u paperclip -- bash -lc 'cd /opt/paperclip && pnpm build'
systemctl restart paperclip.service
curl http://127.0.0.1:3100/api/health
```

```sh
runuser -u paperclip -- bash -lc 'cd /opt/paperclip && timeout 120s node --import ./server/node_modules/tsx/dist/loader.mjs scripts/cutover/titan-claws-goalloop-bootstrap.ts --db-url postgres://paperclip:paperclip@127.0.0.1:54329/paperclip --company-id 9299cf0c-2857-4d8c-8eb2-a4332ed5a21e --apply --launch-first-goal --json'
runuser -u paperclip -- bash -lc 'cd /opt/paperclip && timeout 90s node --import ./server/node_modules/tsx/dist/loader.mjs scripts/cutover/titan-claws-goalloop-monitor.ts --db-url postgres://paperclip:paperclip@127.0.0.1:54329/paperclip --company-id 9299cf0c-2857-4d8c-8eb2-a4332ed5a21e --json'
```

## Manual Interventions And Notes

- The live service initially failed to start because the VPS config used `$meta.source = "vps-bootstrap"` and the current schema no longer accepted that value. The repo was patched to allow `vps-bootstrap`, rebuilt on the VPS, and then the service started cleanly.
- The live embedded Postgres migration journal needed normalization before pending migrations could be applied safely. After normalization, `0046_smooth_sentinels.sql` and `0047_puzzling_red_wolf.sql` applied cleanly.
- The live `archive` script returned its JSON to stdout but timed out before writing archive files to disk. The same pre-cutover archive snapshot was still included in the bootstrap apply JSON and was used for this note.
- The cutover itself succeeded, but the first live GoalLoop run is not autonomous yet. It is currently a running `direction` phase with an unassigned GoalLoop issue, so step 9 remains open until the first run reaches verified output and measurement.
- The first live GoalLoop run has now been bridged onto the CEO. CEO agent `024c4df0-c612-4c3e-a404-a31b7a5a5b68` was resumed, GoalLoop issue `1aa992f1-fed2-42a0-9acc-6064883aeb65` was assigned to the CEO, and the live `/api/agents/:id/wakeup` route returned `202` with heartbeat run `7a5ed422-2669-44b6-991f-413f86b36efa`. The issue now has `execution_run_id = 7a5ed422-2669-44b6-991f-413f86b36efa` and the CEO is in `running` state.
- Monitoring showed that the CEO completed the `direction` phase successfully. The direction issue is now `done`, the heartbeat run `7a5ed422-2669-44b6-991f-413f86b36efa` finished `succeeded`, and the GoalLoop run advanced to `production` with new production issue `15507039-0b17-4669-bc75-a5d339c095b6`. The production issue is still unassigned, there are no outputs yet, and the production lease is active.
- The live operationalization pass resumed the minimum engineering core needed for the first GoalLoop cycle: `CTO`, `CodeQA`, and `Junior Dev 1`. Production issue `15507039-0b17-4669-bc75-a5d339c095b6` was assigned to CTO and completed successfully with a shipped homepage CTA fix that routes both primary homepage CTAs to `/shop/#waitlist`.
- Verification issue `499e65b9-3330-4cef-be8c-8d3c3cdc36e9` was then assigned to CodeQA and completed successfully. The first verified GoalLoop output is `850e03eb-b6ca-4ce7-9790-152e6bc62282`, titled `Homepage primary CTAs route to waitlist anchor`, with proof URL `https://titanclaws.com/shop/#waitlist` and verification summary confirming the homepage CTA targets and waitlist anchor exposure.
- The first GoalLoop cycle has now reached `measurement`. Measurement issue `404f5dc7-5fae-4135-9640-e37bbf81790f` is assigned to the CEO and is running under heartbeat run `0e4ea8a0-4496-4129-9e10-ab2f2bc17dfe`. Step 9 remains open only until that measurement run completes and the goal run flips from `waiting_measurement` to a finished state.
- A live measurement-gate regression blocked the first goal from closing even after the scoreboard and goal runbook had been updated. The bug was in `server/src/services/goal-loop.ts`: the aggregated `max(runbooks.updated_at)` value was not normalized before date comparison in `resolveMeasurementReadiness`.
- The regression was fixed in the repo, covered by a new `goal-loop-service` measurement test, copied to the VPS checkout, and validated on the VPS with `pnpm --filter @paperclipai/server exec vitest run src/__tests__/goal-loop-service.test.ts`, `pnpm build`, and `pnpm -r typecheck`.
- Because the live API process was still running the pre-fix build, the first goal was closed with a one-off patched service script against the live DB. That moved measurement issue `404f5dc7-5fae-4135-9640-e37bbf81790f` to `done` and finalized goal run `c562fa63-9d2a-499b-bd17-ff02afbad2c5` as `succeeded`.
- After the first goal succeeded, Titan Claws resumed `CMO` and `ContentWriterWeb`, launched the second goal `Email list growth and nurture`, and bridged its direction issue to the CEO. Goal 2 advanced into `production`, creating `TIT-295` for inline article/blog email capture work.
- `paperclip.service` was then restarted to put the measurement-gate fix into the long-running server process. The in-flight CTO run was cancelled as part of that restart, one automatic retry failed with `Process lost -- server may have restarted`, and CTO was manually re-woken. The active production task `TIT-295` is now rebound to CTO under heartbeat run `dbb11d8e-39d5-40d2-ab5e-cfc9602850b5`.
- Goal 2 was later reconciled against the actual live Titan Claws state. `TIT-295` and `TIT-299` had already shipped the article lead-magnet surface, PDF hosting, and GHL tagging, but `TIT-298` was still sitting `in_progress` with no GoalLoop output recorded. A live reconciliation pass created primary output `8f13fbed-0ade-41f1-9e76-06ced20f43ef` on `TIT-298`, updated the goal 2 scoreboard and runbook, and marked `TIT-298` as `blocked`.
- The blocker is explicit and board-owned: `TIT-300` requires manual GoHighLevel workflow setup in location `LAMhO9BeUzwkpgMBhJgP` before the run can enter verification honestly. The goal 2 run `9d377cd3-6951-4275-a246-15054926f488` now shows `needs_human_decision` with failure summary `Phase "production" is blocked`, which is the correct GoalLoop state under [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md).
- 2026-04-05 runtime hardening was deployed to the live VPS after the live checkout was snapshotted at `/home/paperclip/cutovers/2026-04-05-goalloop-runtime-hardening/paperclip-live-predeploy-20260405-125818.tgz`. The patched live build passed VPS `pnpm --filter @paperclipai/server exec vitest run src/__tests__/goal-loop-service.test.ts`, VPS `pnpm -r typecheck`, VPS `pnpm build`, and `paperclip.service` restarted healthy.
- The live GoalLoop runtime is now goal-first. `GET /api/goals/906b6c11-9124-419e-a394-df6e7f9ea647/runtime` exposes `actionableIssueId`, `blockedBy`, and `nextWakeTarget = { agentId: 024c4df0-c612-4c3e-a404-a31b7a5a5b68, issueId: 1cdbcfa7-f1d9-4783-a25e-82c0f6219a6a, goalRunId: 9d377cd3-6951-4275-a246-15054926f488, goalRunPhase: production, reason: human_decision }`.
- Live company GoalLoop health is now exposed at `GET /api/companies/9299cf0c-2857-4d8c-8eb2-a4332ed5a21e/goal-loop/health`. At deployment validation time it reported `activeRunCount = 1`, `blockedRunCount = 1`, `needsWakeCount = 0`, `orphanedRunCount = 0`, `genericHeartbeatRunsLastHour = 5`, and `skippedWakeupsLastHour = 13`.
- A generic CEO wake no longer resumes a stale employee thread. Validation wakeup created heartbeat run `e72a257d-8cb4-413c-bc8c-2863c3ab4150` with `goalId = 906b6c11-9124-419e-a394-df6e7f9ea647`, `goalRunId = 9d377cd3-6951-4275-a246-15054926f488`, `goalRunPhase = production`, and context snapshot issue/task scope `1cdbcfa7-f1d9-4783-a25e-82c0f6219a6a`. That run finished `succeeded` and left the CEO `idle`.
- `POST /api/goal-runs/9d377cd3-6951-4275-a246-15054926f488/wake` is now mounted live and returns the same goal-bound run instead of a generic session resume. A temporary validation key `abe2eb7c-6dcc-4a1d-8b71-3074da392380` was created for the CEO, used for runtime validation, and revoked at `2026-04-05T13:11:14.869Z`.
- A second live routing gap showed up once board work created non-goal execution issues inside the GoalLoop-default Titan company. `UXDesigner` was unpaused and assigned `TIT-314`, but timer/manual wakes kept being written as `skipped` with reason `no_actionable_goal_work` because the GoalLoop router only considered goal-bound issues. The live roster itself was healthy: no agents were paused, but unassigned/assigned non-goal work in a GoalLoop company was not actionable.
- The fix was deployed from the repo on `2026-04-05`: `server/src/services/heartbeat.ts` now falls back to the agent’s assigned actionable issue (`in_progress` or `todo`) when no more specific goal-run wake target exists. Focused coverage was added in `server/src/__tests__/heartbeat-routing.test.ts`. VPS checks passed: `pnpm --filter @paperclipai/server exec vitest run src/__tests__/heartbeat-routing.test.ts`, `pnpm -r typecheck`, `pnpm build`, and `paperclip.service` restarted healthy.
- Live validation after the restart confirmed the fix: the on-demand wake routed `UXDesigner` onto `TIT-314`, which moved from `todo` to `in_progress` with `checkout_run_id = execution_run_id = 35cfe2bc-325a-4a53-96b1-e7be1d6d99b2`. `UXDesigner` is now `running`, and subsequent timer wakes are being `coalesced` with `reason = issue_execution_same_name` instead of being skipped. Current aggregate live roster status is `11 idle`, `2 running`, `0 paused`.
- On `2026-04-06`, a new Phase 4 blocker on `TIT-321` exposed a deployment-context mismatch rather than a missing host capability. CTO reported “needs VPS credentials / root / DNS provider / nginx”, but the live Titan host already provides local deployment access: `paperclip` has passwordless `sudo`, `titanclaws.com` already resolves to the same VPS (`46.224.172.180`), WordPress is local at `/var/www/titanclaws/public`, the local backend preview is reachable at `http://127.0.0.1:8080`, GraphQL is live at `http://127.0.0.1:8080/graphql`, the Next.js app is already running locally on port `3000`, and the public proxy is `caddy` via `/etc/caddy/Caddyfile`.
- The actual problem was that CTO’s live `TOOLS.md` did not include those Titan deployment facts, so it inferred a remote-SSH + Nginx + DNS-cutover model from missing env vars. The live CTO instructions bundle was patched in place with a `Titan VPS Deployment Access` section documenting local `sudo`, Caddy, WordPress root, local backend origin, and the running Next app. A board clarification comment was then added to `TIT-321`, the issue was reopened to `todo`, and CTO was re-woken under heartbeat run `ed9bbd34-11f0-4b91-98cf-226b0260a3b9`, which is now the active deployment run for Phase 4.
