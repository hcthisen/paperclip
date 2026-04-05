# Goal-Loop System Conversion

Date: 2026-04-04
Status: Approved implementation plan

## Summary

Paperclip will be converted in place from an org-chart-first control plane into a dual-mode system where `goal_loop` is the default execution model for new users and `classic` remains available for advanced persistent org-chart execution.

The conversion must preserve the proven runtime substrate:

- companies
- issues
- heartbeats
- workspaces
- work products
- routines
- budgets
- approvals
- audit logs

The implementation will add first-class goal-loop objects and user flows rather than creating a second unrelated execution plane.

## Core Decisions

- New companies default to `goal_loop`.
- Existing companies and goals are backfilled to `classic`.
- Goal-loop output proof gating applies only to goal-loop output-producing work in the first rollout.
- Goal-loop objects are persisted as first-class schema/API types, not only inferred from existing issue state.
- Goal-loop runtime reuses issues, heartbeats, workspaces, routines, and work products under the hood.
- `company_skills` remains the reusable skill-pack substrate.
- The implementation tracker lives in `doc/plans/2026-04-04-goal-loop-system/PLAN.md` and must be updated after each completed, tested task before the next task starts.

## Major Changes

### Contracts and schema

- Add `goal_mode`, `goal_run_phase`, `output_status`, `lease_mode`, and `recipe_source`.
- Extend companies with a goal-loop default mode.
- Extend goals with runtime mode and goal-loop planning fields.
- Add first-class records for context packs, goal briefs, recipes, recipe versions, goal runs, verification runs, scoreboards, scoreboard snapshots, runbooks, and resource leases.
- Extend issues, heartbeat runs, cost events, issue work products, and budget policies with goal-loop linkage fields where needed.

### Runtime

- Goal runs operate in phases: `direction`, `production`, `verification`, `measurement`.
- Goal runs create system-managed execution issues and reuse the existing issue/heartbeat substrate.
- Verification is first-class and mandatory for goal-loop output-producing work.
- Resource leases coordinate shared external surfaces using `shared_read` and `exclusive_write`.

### UX

- Replace the default onboarding path with: Company -> Context Pack -> Goal -> Goal Brief -> Access -> Recipe -> Launch.
- Demote org chart and employee views from the default story; keep them available for classic mode.
- Promote goals, briefs, outputs, scoreboards, runbooks, runs, and costs as the main user-facing surfaces.

## Ordered Implementation Sequence

1. Update product/spec docs and freeze the goal-loop contract.
2. Add shared enums, types, validators, and API contracts.
3. Add DB schema and migrations for goal-loop objects.
4. Add backend CRUD/read APIs for context packs, briefs, recipes, scoreboards, runbooks, outputs, verifications, and leases.
5. Add goal-run orchestration and phase-tagged runtime/cost accounting.
6. Add proof gating and verification runtime for goal-loop output work.
7. Add resource lease acquisition, queueing, and conflict handling.
8. Replace onboarding with the goal-loop-first flow and keep classic as advanced.
9. Redesign dashboard and goal detail UI around briefs, runs, outputs, scoreboards, and runbooks.
10. Add migration/backfill, coexistence hardening, and release verification.

## Acceptance Conditions

- A new user can create a useful goal and execute it without creating a CEO or org chart.
- Goal-loop output-producing work cannot resolve success without shipped, verified proof.
- Goal-level outputs and scoreboards are first-class user-facing views.
- Existing classic companies continue to run without forced migration.
- Shared-surface collisions are handled mechanically through leases.
- Paperclip can report cost per verified output.
