# Titan Claws GoalLoop Cutover

This plan converts the live Titan Claws Paperclip deployment from classic operation to GoalLoop operation.

It is an operational cutover plan for a single already-running company, and it depends on the implementation and rollout guarantees in:

- [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md)
- [step-10-vps-validation.md](/C:/Github/paperclip/doc/plans/2026-04-04-goal-loop-system/step-10-vps-validation.md)

Those documents establish that GoalLoop can coexist with classic data and that a production-shaped Titan Claws clone already migrated and passed smoke validation. This cutover plan intentionally uses a stricter operating mode for Titan Claws itself:

- preserve classic data
- archive open work instead of remapping it 1:1 into live GoalLoop issues
- pause classic execution
- relaunch GoalLoop goals one at a time

## Operational Defaults

- Company: `Titan Claws`
- Cutover mode: clean restart with archive
- Open issue handling: archive and restart
- Rollout: sequential goals
- First goal: `Website and email capture conversion`
- Rollback posture: full rollback bundle on VPS plus repo-side note

## Repo Artifacts

- Tracker: [PLAN.md](/C:/Github/paperclip/doc/plans/2026-04-04-titan-claws-goalloop-cutover/PLAN.md)
- Repo-note template: [REPO-NOTE.template.md](/C:/Github/paperclip/doc/plans/2026-04-04-titan-claws-goalloop-cutover/REPO-NOTE.template.md)
- Live repo note: [REPO-NOTE.md](/C:/Github/paperclip/doc/plans/2026-04-04-titan-claws-goalloop-cutover/REPO-NOTE.md)
- Server bundle script: `pnpm cutover:titanclaws:server-bundle`
- Archive export script: `pnpm cutover:titanclaws:archive`
- Bootstrap script: `pnpm cutover:titanclaws:bootstrap`
- Monitor script: `pnpm cutover:titanclaws:monitor`

## Live Status

The Titan Claws VPS cutover was applied on 2026-04-04. The live service is now running the GoalLoop checkout at `/opt/paperclip`, the embedded Postgres schema includes the GoalLoop migrations, and Titan Claws now defaults to `goal_loop`.

The live company state currently matches the cutover intent:

- classic Titan Claws agents are paused
- legacy classic goals and issues remain readable
- all six Titan Claws GoalLoop goals are seeded
- the first GoalLoop run has been launched for `Website and email capture conversion`

The live state now satisfies the first full GoalLoop cycle in [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md). The first live GoalLoop run `Website and email capture conversion` has completed `direction -> production -> verification -> measurement` and finished as `succeeded`, with verified output proof at `https://titanclaws.com/shop/#waitlist`.

Titan Claws is now in the sequential-promotion stage:

- the live server process is running the patched GoalLoop measurement-gate logic
- `CEO`, `CTO`, `CodeQA`, `Junior Dev 1`, `CMO`, and `ContentWriterWeb` are resumed
- the second goal `Email list growth and nurture` is active
- goal 2 has already advanced from `direction` into `production` and has been reconciled with a live primary output
- the current goal 2 state is `needs_human_decision`, not active autonomous execution
- the remaining blocker is manual GoHighLevel workflow setup on `TIT-300`

This live state is still aligned with [PaperclipGoalLoopSystem.md](/C:/Github/paperclip/PaperclipGoalLoopSystem.md): issues remain the v1 execution substrate, outputs are recorded explicitly, and blockers should be surfaced as human-decision states instead of leaving a goal run quietly stranded in `production`.

## Implemented Cutover Flow

1. Create the VPS rollback bundle before touching live execution:

```sh
pnpm cutover:titanclaws:server-bundle -- --bundle-dir /home/paperclip/cutovers/2026-04-04-titan-claws-goalloop
```

This captures:

- live service unit and status
- live repo HEAD, status, and diff stat
- a tarball of the live repo tree
- a fresh DB backup through the existing Paperclip backup command
- a copy of the active instance config

2. Export the operational archive from the live company data:

```sh
pnpm cutover:titanclaws:archive -- --db-url "$DATABASE_URL" --company-id "<titan-claws-company-id>" --out-dir /home/paperclip/cutovers/2026-04-04-titan-claws-goalloop/archive
```

This writes:

- `archive.json`
- `cutover-definition.json`
- `SUMMARY.md`

The archive intentionally contains non-secret operational state only. Keep DB backups, live config, and any secret-bearing files in the VPS bundle, not in repo-tracked files.

3. Rehearse the bootstrap without mutation:

```sh
pnpm cutover:titanclaws:bootstrap -- --db-url "$DATABASE_URL" --company-id "<titan-claws-company-id>"
```

4. Apply the live bootstrap once the freeze window starts:

```sh
pnpm cutover:titanclaws:bootstrap -- --db-url "$DATABASE_URL" --company-id "<titan-claws-company-id>" --apply
```

5. Launch the first GoalLoop goal only after the live code and DB migration are in place:

```sh
pnpm cutover:titanclaws:bootstrap -- --db-url "$DATABASE_URL" --company-id "<titan-claws-company-id>" --apply --launch-first-goal
```

6. Monitor the relaunch continuously:

```sh
pnpm cutover:titanclaws:monitor -- --db-url "$DATABASE_URL" --company-id "<titan-claws-company-id>"
```

## Bootstrap Behavior

The implemented bootstrap does the following:

- pauses classic Titan Claws agents that are still runnable
- flips `companies.defaultGoalMode` to `goal_loop`
- creates the Titan Claws context pack and company runbook
- seeds these GoalLoop goals:
  - `Website and email capture conversion`
  - `Email list growth and nurture`
  - `Social audience growth`
  - `Brand consistency across touchpoints`
  - `Product-market-fit and pre-sell validation`
  - `Prototype and supplier quote pipeline`
- maps archived open issues into GoalLoop destinations using repo-implemented heuristics:
  - `context_fact`
  - `goal_current_state`
  - `runbook_next_action`
  - `parking_lot_reference`
- seeds goal briefs, scoreboards, and runbooks from the archive
- keeps product validation and supplier work in `draft` briefs until board review confirms access and launch readiness

## Acceptance Criteria

The cutover is operationally complete when all are true:

- the rollback bundle exists on the VPS
- the archive bundle exists and `SUMMARY.md` has been copied into the repo note
- Titan Claws defaults to `goal_loop`
- classic agents are paused
- all six Titan Claws GoalLoop goals exist
- the first goal completes a full `direction -> production -> verification -> measurement` cycle with a verified output on `titanclaws.com` or the connected GoHighLevel surface
- the monitor output shows no unexpected classic heartbeat runs and no stuck active leases before the next goal is launched
- subsequent goals either complete the same cycle or are explicitly marked `needs_human_decision` with recorded outputs and blockers instead of remaining silently `running`
