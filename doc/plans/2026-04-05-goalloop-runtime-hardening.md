# GoalLoop Runtime Hardening

This plan closes the remaining runtime gap between the current Paperclip implementation and the intended behavior in `PaperclipGoalLoopSystem.md`. The target state is that `goal_loop` mode always executes goal-bound work, advances from real output and verification state, surfaces real blockers as `needs_human_decision`, and gives operators an explicit goal-first control surface instead of relying on generic employee heartbeats.

The repo implementation is tracked in `doc/plans/2026-04-05-goalloop-runtime-hardening/PLAN.md`. That tracker is the handoff artifact for future agents and must be updated after each completed, tested step before the next step begins.

## Key Decisions

- `goal_loop` runtime behavior is governed by `PaperclipGoalLoopSystem.md`, `doc/PRODUCT.md`, and `doc/SPEC-implementation.md`.
- In `goal_loop` mode, a heartbeat is valid only when it is bound to a goal run or goal-scoped issue. Otherwise it must skip explicitly with `no_actionable_goal_work`.
- Real external blockers are first-class runtime state. They move the run to `needs_human_decision` and stop autonomous execution until the blocker is cleared.
- Titan Claws remains the live proving ground, but the fixes must be repo-wide and not Titan-specific.

## Ordered Implementation

1. Freeze the runtime contract in product/spec docs.
2. Remove generic heartbeat execution from `goal_loop` mode.
3. Ensure phase progression is state-driven from outputs, verifications, scoreboard updates, and runbook updates.
4. Route blocked goal-loop work back to director-level handling and make the blocked state resumable.
5. Make session reuse task-scoped in `goal_loop` mode so stale generic sessions cannot bypass routing.
6. Expose a goal-first operator surface in Goal detail with actionable issue, next wake target, blocked reason, and a primary wake action.
7. Add company-level GoalLoop runtime health so operators can see blocked runs, orphaned runs, skipped wakes, and generic heartbeat leakage.
8. Validate the patch set against a Titan staging clone.
9. Deploy the runtime patch to Titan live and use goal-run wake as the primary execution trigger.
10. Resume Titan’s remaining goals sequentially only after goal 2 clears its real external blocker and completes through measurement.

## Acceptance

- `goal_loop` wakes never succeed as generic employee heartbeats with empty goal context.
- Blocked runs route back to director-level handling instead of continuing on worker timer wakes.
- Goal detail and dashboard expose enough runtime state that operators can see why a goal is blocked or idle without DB queries.
- Titan live can resume goal 2 through the normal runtime once the GoHighLevel blocker is cleared, with no manual DB surgery.
