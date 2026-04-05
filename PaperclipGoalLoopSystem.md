# Paperclip Goal Loop System v2

## Summary

This document defines a goal-first execution model for Paperclip that is simpler than the current org-chart-first model and more tightly optimized for human-facing output.

The core change is:

- from: `company simulator with persistent roles, delegation chains, and issue traffic as the main proof of work`
- to: `goal loop harness that generates, ships, verifies, measures, and improves real output`

This is not a clean-room rewrite proposal. It is an in-place conversion plan for Paperclip that keeps the strong parts of the current system:

- onboarding
- adapters
- heartbeats
- run history
- workspaces
- budgets
- routines
- issue documents
- work products
- audit trail

The target product shape is:

- `goal-loop mode` is the default for new users
- `classic org-chart mode` remains available as an advanced execution model
- existing deployments remain usable and can adopt the new model incrementally

## Current vs target

| Area | Current Paperclip default | Goal-loop target |
| --- | --- | --- |
| Primary object | Company with org chart | Goal with Goal Brief |
| Main execution metaphor | Employees and delegation | Directed outcome loops |
| Main proof of progress | Issue status and comments | Verified outputs and scoreboards |
| Coordination model | Persistent managers and reports | Goal-scoped Director plus resource leases |
| Quality control | QA agents and review loops | Required verification stage |
| Recurring work | Agent routines | Goal recipes and measurement loops |
| User entry path | Create CEO and org chart | Create context, goal, brief, recipe |
| Best fit | Large multi-agent orgs | High-output business workflows |

## Why change

The live Titan Claws Paperclip instance already shows the current tradeoff.

From [PaperclipBoardAssessment.md](C:/Github/PaperclipBoardAssessment.md):

- 246 visible issues
- 220 `done`
- 1,049 heartbeat runs
- 0 approvals used
- 0 tracked `issue_work_products`
- about 49 `done` issues that count as direct human-facing output
- about 30 `done` issues that count as net-new human-facing output

Interpretation:

- the system is doing real work
- but too much inference is being spent on orchestration, QA churn, correction loops, and status traffic
- completion semantics are weak
- output tracking is weak
- the board still needs to correct false completion and process drift

The problem is structural, not cosmetic.

Paperclip currently defaults to an employee-company metaphor:

- create a company
- create a CEO
- approve strategy
- build an org chart
- let managers delegate

That metaphor is valid for some advanced multi-agent operations, but it is too heavy for common high-value cases like:

- grow a social account
- fix a website
- rewrite articles
- set up email capture
- contact suppliers

For these cases, the user wants:

- a clear outcome
- a clear definition of done
- correct execution
- proof that the output shipped
- a loop that learns from results

The new model should optimize for that directly.

## Product shape

Paperclip should support two execution models.

## 1. Goal-loop mode

This is the default path for new users.

It is optimized for:

- one or more concrete business goals
- human-facing outputs
- bounded execution loops
- verification and measurement
- minimum coordination overhead

The primary objects are:

- company
- context pack
- goal brief
- recipe
- goal run
- output ledger
- scoreboard
- runbook

## 2. Classic mode

This is the existing Paperclip model and remains available.

It is optimized for:

- larger multi-agent teams
- persistent named agents
- explicit reporting structures
- long-lived manager/report coordination
- high-touch org-chart governance

Classic mode should not be removed in v1 of the conversion.

It should be treated as:

- compatible
- still supported
- no longer the default setup path

## Honest framing

The new model still needs coordination. It is not "no coordination."

The difference is:

- current Paperclip defaults to `persistent org-chart coordination`
- the new system defaults to `goal-scoped coordination`

The `Director` in goal-loop mode is a real coordinating function. It is not fundamentally different from a CEO in capability. The difference is scope:

- CEO: persistent, company-wide, role-driven
- Director: goal-scoped, runtime-bound, recipe-driven

That is a better fit for common execution loops.

## Definition

An AI harness is a runtime that repeatedly converts:

`Goal + Finish Criteria + Context + Skills + Feedback`

into:

`Shipped Human-Facing Output + Measured Results + Updated Playbook`

with the minimum inference necessary.

The system exists to move a goal toward completion.
It does not exist to simulate a company unless the user actually needs that.

## Design principles

## 1. Goals over personas

The primary runtime object is a goal, not an employee.

Most tasks do not need persistent CEO, CTO, CMO, QA, and image-generator identities. They need:

- a concrete outcome
- the right context
- the right skills
- the right tools
- a tight definition of done

## 2. Output over paperwork

Anything that does not directly:

- produce human-facing output
- verify human-facing output
- measure output performance
- or improve the playbook for the next loop

is overhead.

## 3. Strong direction, cheap production

Use stronger models for:

- defining finish criteria
- choosing strategy
- evaluating candidates
- deciding what ships
- updating the runbook

Use cheaper models in parallel for:

- drafting
- variant generation
- repetitive content production
- bulk transformations
- candidate expansion

## 4. Verification is part of execution

An output-producing task is not done because an agent says it is done.

It is done when:

- the output exists
- the output is shipped or live where expected
- the output is verified
- proof is recorded
- the scoreboard is updated

## 5. Persist distilled state, not roleplay

Durable memory should be:

- context pack
- goal brief
- runbook
- scoreboard
- output ledger
- recent verified results

It should not depend on giant role prompts or long session transcripts as the main source of truth.

## 6. The board should intervene at high-leverage points

The board should define:

- the business outcome
- constraints and brand rules
- access and credentials
- risk thresholds
- approval policies

The board should not frequently need to correct:

- false completion
- missing verification
- obvious workflow mistakes
- ambiguous ownership
- internal routing confusion

## Core objects

## Company

Still useful as the top-level tenant boundary.

It owns:

- context packs
- skills
- goals
- recipes
- runbooks
- budgets
- resources
- outputs

The company remains the right scope for:

- access control
- cost control
- data isolation
- shared learning

## Context Pack

This replaces much of the current org-chart and persona complexity.

A context pack is the reusable frame the system needs to make correct decisions.

It should contain:

- company profile
- brand voice
- ICP / audience
- product and offer
- platform access status
- constraints
- approved tools
- banned patterns
- output standards
- existing assets and references

Suggested files:

- `context/company.md`
- `context/brand.md`
- `context/audience.md`
- `context/access.md`
- `context/policies.md`

## Skill Pack

A skill pack is a reusable SOP bundle for a specific class of work.

Examples:

- `social-posting`
- `website-update`
- `wordpress-content-editing`
- `ghl-social-scheduler`
- `supplier-outreach`
- `frontend-qa-with-agent-browser`

Each skill should specify:

- when to use it
- required inputs
- expected outputs
- verification method
- failure modes
- tool usage rules

## Goal

A goal is the top-level unit of execution.

It should contain:

- title
- objective
- business reason
- owner company
- priority
- timeframe
- KPI family
- current state
- mode

Where:

- `mode = classic | goal_loop`

## Goal Brief

This is the primary planning object for goal-loop mode.

The system should refuse to execute a goal-loop goal until its Goal Brief is valid.

The Goal Brief should contain:

- objective
- business rationale
- finish criteria
- KPI
- selected recipe and version
- context references
- required resources
- verification policy
- budget envelope
- risk controls
- success measurement cadence

Suggested API:

- `GET /goals/:id/brief`
- `PUT /goals/:id/brief`

## Finish Criteria

This is the most important field in the system.

If the user does not define what finished looks like, the system must define it before execution starts.

Finish criteria must be:

- concrete
- externally testable
- outcome-oriented

Bad:

- "improve social media"
- "make the site better"
- "work on content"

Good:

- "schedule 10 Danish FB and IG posts for the next 5 days"
- "replace homepage placeholder copy and verify desktop/mobile rendering"
- "send outreach emails to 5 shortlisted prototype suppliers and log replies"

## Recipe

A recipe is a versioned execution template attached to a goal.

It defines:

- required context
- standard finish-criteria shape
- loop stages
- producer strategy
- verification rules
- measurement cadence
- retry and failure model
- output types

In v1:

- one primary recipe per goal
- recipes are versioned
- recipe composition is not supported
- recipes come from either system defaults or company-defined templates
- AI-generated recipes are not canonical

Suggested API:

- `GET /companies/:companyId/recipes`
- `POST /companies/:companyId/recipes`
- `PATCH /recipes/:id`

Recipe fields:

- `source = system | company`
- `binding = recipe_id + version`

## Goal Run

A Goal Run is one execution cycle of a goal loop.

It is the main runtime record for:

- direction
- production
- verification
- measurement

Suggested phases:

- `direction`
- `production`
- `verification`
- `measurement`

Suggested API:

- `GET /goals/:id/runtime`
- `POST /goals/:id/execute`

## Director

The Director is the strong-model coordinating function for a goal run.

Responsibilities:

- define or refine finish criteria
- decide strategy
- choose batch size
- choose producer parallelism
- decide what ships
- update the runbook
- decide the next loop

The Director is goal-scoped, not company-wide by default.

## Producer Pool

The Producer Pool is a bounded set of cheaper parallel workers.

Responsibilities:

- generate variants
- write drafts
- create candidate images
- implement repetitive changes
- expand candidate volume

Producer parallelism must be recipe-controlled and budget-bounded.

## Verifier / Shipper

This is the execution mode that:

- publishes
- uploads
- schedules
- verifies live results
- captures proof
- writes output records

This is not optional for output-producing work.

## Scoreboard

The scoreboard is the source of truth for progress.

It measures the goal, not internal issue motion.

Examples:

- posts scheduled
- posts published
- followers gained
- pages fixed
- articles rewritten
- signups captured
- supplier replies received

Suggested API:

- `GET /goals/:id/scoreboard`
- `PUT /goals/:id/scoreboard`

## Runbook

The runbook is the durable memory of what works and what fails.

It stores:

- successful tactics
- failure patterns
- verified heuristics
- platform quirks
- updated quality rules

There should be:

- company-level runbook
- optional goal-level overlay

The company-level runbook is the main cross-goal learning layer in v1.

Suggested API:

- `GET /goals/:id/runbook`
- `PUT /goals/:id/runbook`

## Output Ledger

Every human-facing output must be recorded here.

Examples:

- scheduled social post IDs and screenshots
- live URLs
- before/after page screenshots
- sent email metadata
- uploaded image URLs
- article IDs changed
- supplier outreach records

Paperclip already has the correct primitive:

- `issue_work_products`

In the new model, work products become mandatory for output-producing work.

In v1, goal outputs should be implemented as a goal-level aggregation over work products created by the goal's execution issues.

Suggested API:

- `GET /goals/:id/outputs`

## Verification Run

Verification must become a first-class runtime stage.

A Verification Run should:

- be linked to a Goal Run
- be linked to the output being verified
- record cost
- record method
- record proof
- record verdict

Suggested APIs:

- `GET /goals/:id/verifications`
- `GET /outputs/:outputId/verifications`

## Resource Lease

This is the primary multi-goal coordination primitive for shared external surfaces.

Paperclip already has issue checkout, execution locks, workspace reuse, and routine coalescing. Those solve concurrency inside the current execution model.

What is missing is goal-native coordination for external systems like:

- one WordPress site
- one GHL location
- one social account set
- one outbound email identity

The new model should add Resource Leases.

Resource keys should look like:

- `wordpress:prod:titanclaws.com`
- `ghl:social:<locationId>`
- `email:outbound:titanclaws.com`
- `vercel:prod:<project>`

Lease modes:

- `shared_read`
- `exclusive_write`

Default rules:

- analysis and measurement can use `shared_read`
- any mutating or shipping step requires `exclusive_write`
- conflicting writes queue instead of racing
- queued runs retry with bounded backoff
- semantic conflicts escalate to the board

Suggested API:

- `GET /companies/:companyId/resource-leases`

In v1, lease acquisition can remain an internal runtime operation even if the read surface is public.

## Runtime model

## Post-onboarding happy path

After onboarding, the primary user flow should be:

1. create company
2. define or import context pack
3. create goal
4. review or accept generated Goal Brief
5. connect missing access
6. select recipe
7. execute first loop
8. inspect outputs and scoreboard

The user should not need to:

1. create a CEO
2. build an org chart
3. define multiple permanent role prompts
4. approve a manager strategy before common execution begins

## General goal-loop

```text
Goal created
-> create Goal Brief
-> validate finish criteria
-> load context + skills
-> check required access
-> acquire resource leases for the next stage
-> run direction phase
-> run production phase
-> ship outputs
-> run verification phase
-> record outputs in ledger
-> update scoreboard
-> release leases
-> wait for measurement cadence
-> run measurement phase
-> update runbook
-> queue next loop
```

## Example: social growth goal

User sets goal:

> Grow Titan Claws social media in Denmark.

Correct system execution:

1. System gathers or infers:
- target audience
- channels
- tone
- success metric
- access status

2. System creates Goal Brief:
- finish criteria:
  - 10 approved posts scheduled for the next 5 days
  - unique approved image for each post
  - post IDs and screenshots logged
  - 5-day performance review completed
  - next batch strategy updated from results
- recipe: `social_growth@v1`
- required resources:
  - `ghl:social:<locationId>`
  - `wordpress:prod:titanclaws.com`

3. Direction phase:
- Director chooses batch size
- candidate budget is set
- scoring rubric is defined

4. Production phase:
- cheap text workers generate many captions
- cheap image workers generate prompt/image candidates
- Director selects the best outputs

5. Shipping phase:
- system acquires `exclusive_write` lease on GHL social surface
- schedules 10 posts
- stores media URLs

6. Verification phase:
- confirms each scheduled post has text, media, time, and correct destination
- captures proof
- writes work products

7. Scoreboard update:
- `posts_scheduled += 10`

8. Measurement phase after 5 days:
- fetch engagement metrics
- compare results to rubric
- update company and goal runbook
- queue next batch

## Example: website repair goal

User sets goal:

> Fix the About and Contact pages so they are visually coherent and conversion-ready.

Correct execution:

1. Goal Brief defines finish criteria:
- About page white-on-white issue fixed
- carousel overflow fixed
- Contact form fields visible and working
- desktop and mobile screenshots attached
- verification pass recorded

2. Recipe selected:
- `website_repair@v1`

3. Production phase:
- system acquires `exclusive_write` lease on `wordpress:prod:titanclaws.com`
- applies code/content changes

4. Verification phase:
- fetches live pages
- runs visual and functional checks
- captures screenshots
- writes output ledger entries

5. Only then can the goal run resolve as verified

This directly fixes the failure mode seen in the live instance where `TIT-143` was marked done after analysis alone and had to be reopened via `TIT-203`.

## Example: supplier outreach goal

User sets goal:

> Contact 5 prototype suppliers for durable cat toy pricing.

Correct execution:

1. Goal Brief defines finish criteria:
- 5 qualified suppliers identified
- 5 emails sent
- messages logged
- responses tracked
- next action plan recorded

2. Recipe selected:
- `supplier_outreach@v1`

3. Production phase:
- shortlist suppliers
- generate outreach variants
- select best drafts

4. Shipping phase:
- send emails

5. Verification phase:
- confirm provider acknowledgment
- store proof
- record outreach outputs

6. Measurement phase:
- track replies
- update runbook with response quality and vendor signal

## Verification architecture

The earlier proposal was correct to make verification mandatory, but underdefined how it works. This section makes it concrete.

## Verification policy

The default policy is:

- `hard gate + async verification`

Meaning:

- output-producing work cannot resolve to terminal success without proof
- verification runs asynchronously after shipping
- the run remains non-terminal until verification succeeds or fails

## Output states

For output-producing work, these states replace premature `done`:

- `generated_not_shipped`
- `shipped_pending_verification`
- `verified`
- `verification_failed`
- `needs_human_verification`

Classic issue status can remain under the hood, but the user-facing output state must be more precise.

## Verification methods by output type

### Website / page / blog output

Required checks:

- live URL reachable
- expected content or structural markers present
- screenshots captured when visual quality matters
- proof linked in ledger

### Scheduled social output

Required checks:

- post record exists in target platform or scheduler
- destination channel is correct
- publish time is correct
- media is attached
- proof screenshot or record attached when possible

### Email output

Required checks:

- provider/API acknowledgment
- durable sent proof or event log
- recipient, subject, and timestamp recorded

### Outreach / API mutation output

Required checks:

- provider/API success response
- external object ID or stable proof
- summary of mutation recorded

## Verification failures

When verification fails:

1. classify the failure
- retryable
- blocked_missing_access
- broken_output
- ambiguous_result
- needs_human_decision

2. apply bounded retries

3. if still unresolved:
- move to `verification_failed` or `needs_human_verification`
- do not resolve as success

## Verification cost accounting

Verification costs must be visible, not hidden.

Each Goal Run should report cost by phase:

- `direction`
- `production`
- `verification`
- `measurement`

This allows direct reporting of:

- cost per verified output
- verification cost ratio
- production discard rate

## Cost model

The new system should claim efficiency only if it can measure it.

For every goal and recipe, Paperclip should report:

- total run cost
- cost by phase
- number of candidates generated
- number of candidates selected
- number of verified outputs
- cost per verified output
- cost per net-new output

Recipes must also define candidate caps and oversampling rules.

Example:

```json
{
  "director_model": "gpt-5.4",
  "producer_model": "gpt-5.4-mini",
  "producer_parallelism": 20,
  "max_caption_candidates": 200,
  "max_image_candidates": 40,
  "max_retry_count": 2
}
```

This prevents "generate 200 and throw away 190" from becoming an unbounded hidden cost pattern.

## Recipe model

Recipes are central to the new model and must be explicit.

## Recipe contract

Each recipe must define:

- required context inputs
- finish-criteria template
- allowed output types
- loop stages
- verification method
- measurement cadence
- failure classification
- retry rules
- budget hints
- required resource leases

## Recipe versioning

Rules:

- recipe version is pinned in the Goal Brief
- old goal runs continue to use the pinned version
- new goals can adopt newer versions
- company-defined recipes can fork system recipes but remain explicit

## Recipe failure model

Every recipe step must resolve to one of:

- `succeeded`
- `retryable`
- `blocked_missing_access`
- `verification_failed`
- `needs_human_decision`
- `terminal_failed`

This is mandatory because "something went wrong" is not a valid execution outcome.

## Recipe composition

In v1:

- arbitrary recipe composition is not supported
- one primary recipe per goal
- recipes can call reusable skills or subroutines, but the goal still has one controlling recipe

This avoids a second layer of orchestration complexity before the core model is proven.

## Multi-goal coordination

The previous proposal correctly favored goal loops, but it needed to answer how multiple concurrent goals interact.

## What the org chart currently provides

The current org-chart model does provide real things:

- implicit scope boundaries
- stable ownership
- persistent chain-of-command escalation
- company-wide coordination

Those cannot simply disappear.

## v1 replacement for common cases

Goal-loop mode replaces most of that with:

- Goal Brief ownership
- company-level runbook
- resource leases
- explicit risk and approval policy
- scheduler-level queueing and retry

This is sufficient for common multi-goal operations if the surfaces are clearly modeled.

## When to escalate

Escalation should happen when:

- two goals require incompatible outcomes on the same surface
- one goal wants to override another goal's verified output
- a human must choose between business priorities

Escalation should not happen just because two runs touched the same resource key. That is a mechanical problem and should be handled by leases.

## Mapping to current Paperclip primitives

This conversion should reuse current Paperclip where possible.

| Current Paperclip feature | Keep | Change |
| --- | --- | --- |
| Onboarding CLI | yes | gather context packs and goal-loop defaults |
| Companies | yes | still the tenant boundary |
| Goals | yes | promote to primary runtime object |
| Projects | yes, limited | use only when a true deliverable grouping exists |
| Issues | yes | use as execution substrate, not primary user mental model |
| Org chart | yes, advanced | not the default execution path |
| Heartbeats | yes | wake goal runs and workers, not only persistent employees |
| Routines | yes | trigger recipes and measurement loops |
| Issue documents | yes | use for briefs, plans, notes, specs |
| Work products | yes | make mandatory as output ledger |
| Budgets | yes | track at goal and phase level, not only per agent |
| Approvals | yes | reserve for risky actions and major decisions |
| Audit log | yes | still essential |
| Sessions | yes | still useful for run continuity |

## v1 technical shape

The first implementation should not introduce a second full execution plane.

Instead:

- Goal Briefs, recipes, leases, and verification runs become new first-class concepts
- current `issues`, `heartbeats`, `workspaces`, and `work_products` are reused under the hood
- goal-loop runs can create system-managed execution issues so existing checkout and workspace logic still applies

That gives:

- lower implementation risk
- reuse of proven infrastructure
- backward compatibility

## Backward compatibility and migration

This must work in place for existing deployments.

## Deployment stance

- existing companies remain usable
- existing agents remain usable
- existing issues remain usable
- existing sessions remain usable
- no data reset
- no forced switch

## Migration model

Adoption should happen:

- per company
- then per goal

The first goal-loop rollout should allow a company to run:

- classic goals
- goal-loop goals

side by side.

## Existing data

Existing artifacts map like this:

- current goals -> can receive Goal Briefs
- current issues -> remain execution records
- current work products -> become the output ledger backing store
- current agents -> still valid in classic mode and available as advanced runtime workers in goal-loop mode

## Implementation phases

## Phase 1: Make outputs mandatory

Objective:

- stop relying on comments and status changes as proof of shipped work

Changes:

- require work products for output-producing completions
- add output-type taxonomy
- add proof and verification metadata
- block terminal completion without verified primary output
- add goal-level output view over work products

Done for Phase 1:

- false-completion cases like `TIT-143` are prevented by the product
- users can inspect real outputs instead of reading comment threads

## Phase 2: Add Goal Briefs

Objective:

- add the missing object between "goal" and "a pile of issues"

Changes:

- add Goal Brief model and APIs
- require valid finish criteria before goal-loop execution
- attach recipe, context refs, verification policy, required resources, and budget envelope

Done for Phase 2:

- after onboarding, a user can create a goal and get an executable brief without creating a CEO

## Phase 3: Add recipes

Objective:

- make recurring execution loops reusable and explicit

Changes:

- add recipe catalog
- add system recipes and company recipes
- pin recipe version in Goal Brief
- attach verification and measurement defaults to recipes

Done for Phase 3:

- social growth, website repair, and supplier outreach can run as explicit recipes

## Phase 4: Add goal-loop runtime

Objective:

- let goals execute as loops rather than as org-chart delegation trees

Changes:

- add Goal Run model
- add direction/production/verification/measurement phases
- add Director and Producer Pool runtime behavior
- keep issues as the v1 execution substrate

Done for Phase 4:

- a goal-loop goal can execute end-to-end without classic org-chart setup

## Phase 5: Add resource leases and verification runs

Objective:

- solve the concurrency and verification gaps

Changes:

- add resource lease model
- add verification run model
- add retry and escalation rules
- attribute cost by phase

Done for Phase 5:

- multi-goal collisions on shared surfaces are mechanically controlled
- output-producing runs cannot hide behind unverified success

## Phase 6: Redesign the user experience around outcomes

Objective:

- make the product tell the truth the user cares about

Primary views:

- Goals
- Goal Briefs
- Outputs
- Scoreboards
- Runbooks
- Runs
- Costs
- Access / Context

Demoted views:

- org chart
- employee list
- chain-of-command monitoring

Done for Phase 6:

- the default user mental model is "what changed in the real world?" not "which fictional department moved this ticket?"

## Public interfaces to add or change

The revised spec should add these interfaces:

- `GET /goals/:id/brief`
- `PUT /goals/:id/brief`
- `GET /goals/:id/runtime`
- `POST /goals/:id/execute`
- `GET /goals/:id/scoreboard`
- `PUT /goals/:id/scoreboard`
- `GET /goals/:id/runbook`
- `PUT /goals/:id/runbook`
- `GET /goals/:id/outputs`
- `GET /goals/:id/verifications`
- `GET /outputs/:outputId/verifications`
- `GET /companies/:companyId/recipes`
- `POST /companies/:companyId/recipes`
- `PATCH /recipes/:id`
- `GET /companies/:companyId/resource-leases`

And define these types:

- `goal_mode = classic | goal_loop`
- `goal_run_phase = direction | production | verification | measurement`
- `output_status = generated_not_shipped | shipped_pending_verification | verified | verification_failed | needs_human_verification`
- `lease_mode = shared_read | exclusive_write`
- `recipe_source = system | company`

## What done means

The earlier proposal explained the idea of done. This section makes it operational.

## Done for an output-producing task

A run is done only when:

1. output was created or changed
2. output was shipped or made live
3. verification succeeded
4. proof was recorded in the output ledger
5. scoreboard was updated
6. next action was recorded

If any of those are missing, the run is not terminally successful.

## Done for a goal-loop goal

A goal is done only when:

1. Goal Brief finish criteria are all satisfied
2. required outputs are verified
3. scoreboard reflects the satisfied outcome
4. remaining work is either terminal or intentionally deferred
5. the runbook captures the final lessons

## Done for the Paperclip conversion

The system should be considered successfully converted when:

1. a new user can onboard and execute a useful goal without creating an org chart
2. output-producing work cannot be marked done without verified proof
3. goal-level outputs and scoreboards are first-class user-facing views
4. existing classic-mode companies keep running without forced migration
5. shared-surface collisions are handled by leases instead of implicit agent coordination
6. cost per verified output can be measured

## One-sentence test

If a user sets a goal after onboarding, and the system cannot clearly tell them:

- what finished looks like
- what it is doing now
- what it shipped
- how it verified the result
- how the result changed the next loop

then the system is not done.
