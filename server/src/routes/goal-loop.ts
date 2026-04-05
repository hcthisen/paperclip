import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import {
  createVerificationRunSchema,
  createRecipeSchema,
  executeGoalSchema,
  putContextPackSchema,
  putGoalBriefSchema,
  putGoalScoreboardSchema,
  resourceLeaseQuerySchema,
  runbookEntrySchema,
  updateVerificationRunSchema,
  updateRecipeSchema,
  wakeGoalRunSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { companyService, goalLoopService, goalService, heartbeatService, logActivity, workProductService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

const runbookPayloadSchema = z.object({
  entries: z.array(runbookEntrySchema).max(100),
});

export function goalLoopRoutes(db: Db) {
  const router = Router();
  const companies = companyService(db);
  const goals = goalService(db);
  const goalLoop = goalLoopService(db);
  const heartbeat = heartbeatService(db);
  const workProducts = workProductService(db);

  router.get("/companies/:companyId/context-pack", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(await goalLoop.getContextPack(companyId));
  });

  router.put("/companies/:companyId/context-pack", validate(putContextPackSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const actor = getActorInfo(req);
    const result = await goalLoop.putContextPack(companyId, req.body, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "company.context_pack_updated",
      entityType: "company",
      entityId: companyId,
      details: { sectionCount: result.sections.length },
    });
    res.json(result);
  });

  router.get("/companies/:companyId/runbook", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(await goalLoop.getRunbook(companyId, "company", companyId));
  });

  router.put("/companies/:companyId/runbook", validate(runbookPayloadSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const actor = getActorInfo(req);
    const result = await goalLoop.putRunbook(companyId, "company", companyId, req.body, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "company.runbook_updated",
      entityType: "company",
      entityId: companyId,
      details: { entryCount: result.entries.length },
    });
    res.json(result);
  });

  router.get("/companies/:companyId/recipes", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(await goalLoop.listRecipes(companyId));
  });

  router.get("/companies/:companyId/goal-loop/health", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.json(await goalLoop.getCompanyGoalLoopHealth(companyId));
  });

  router.post("/companies/:companyId/recipes", validate(createRecipeSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const recipe = await goalLoop.createRecipe(companyId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "recipe.created",
      entityType: "recipe",
      entityId: recipe.id,
      details: { slug: recipe.slug, version: recipe.latestVersion?.version ?? null },
    });
    res.status(201).json(recipe);
  });

  router.get("/companies/:companyId/resource-leases", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const company = await companies.getById(companyId);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    const filters = resourceLeaseQuerySchema.parse(req.query);
    res.json(await goalLoop.listResourceLeases(companyId, filters));
  });

  router.patch("/recipes/:id", validate(updateRecipeSchema), async (req, res) => {
    const recipeId = req.params.id as string;
    const existing = await goalLoop.getRecipeById(recipeId);
    if (!existing) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const recipe = await goalLoop.updateRecipe(recipeId, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: recipe.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "recipe.updated",
      entityType: "recipe",
      entityId: recipe.id,
      details: req.body,
    });
    res.json(recipe);
  });

  router.get("/goals/:id/brief", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.getGoalBrief(goal.id));
  });

  router.put("/goals/:id/brief", validate(putGoalBriefSchema), async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    const actor = getActorInfo(req);
    const brief = await goalLoop.putGoalBrief(goal.id, req.body, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.brief_updated",
      entityType: "goal",
      entityId: goal.id,
      details: { status: brief.status, recipeVersionId: brief.recipeVersionId },
    });
    res.json(brief);
  });

  router.get("/goals/:id/runtime", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.getGoalRuntime(goal.id));
  });

  router.post("/goals/:id/execute", validate(executeGoalSchema), async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    const actor = getActorInfo(req);
    const execution = await goalLoop.executeGoalRun(goal.id, req.body, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.execution_queued",
      entityType: "goal_run",
      entityId: execution.run.id,
      details: {
        goalId: goal.id,
        recipeVersionId: execution.run.recipeVersionId,
        phase: execution.run.currentPhase,
        issueId: execution.issue?.id ?? null,
      },
    });
    res.status(201).json({
      ...execution.run,
      issueId: execution.issue?.id ?? null,
    });
  });

  router.get("/goals/:id/runs", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.listGoalRuns(goal.id));
  });

  router.post("/goal-runs/:id/wake", validate(wakeGoalRunSchema), async (req, res) => {
    const body = (req.body ?? {}) as {
      agentId?: string | null;
      routingMode?: "auto" | "goal_loop" | "classic";
      forceFreshSession?: boolean;
    };
    const goalRun = await goalLoop.getGoalRun(req.params.id as string);
    if (!goalRun) {
      res.status(404).json({ error: "Goal run not found" });
      return;
    }
    const goal = await goals.getById(goalRun.goalId);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    const target = await goalLoop.resolveGoalRunWakeTarget(goalRun.id, {
      preferredAgentId: body.agentId ?? null,
    });
    if (!target?.agentId || !target.issueId) {
      res.status(202).json({ status: "skipped", reason: "no_actionable_goal_work" });
      return;
    }

    const actor = getActorInfo(req);
    const run = await heartbeat.wakeup(target.agentId, {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "goal_run_wake",
      routingMode: body.routingMode ?? "goal_loop",
      payload: {
        issueId: target.issueId,
        goalRunId: target.goalRunId,
        goalRunPhase: target.goalRunPhase,
      },
      requestedByActorType: actor.actorType === "agent" ? "agent" : "user",
      requestedByActorId: actor.actorType === "agent" ? actor.agentId ?? null : actor.actorId,
      contextSnapshot: {
        issueId: target.issueId,
        goalRunId: target.goalRunId,
        goalRunPhase: target.goalRunPhase,
        routingMode: body.routingMode ?? "goal_loop",
        forceFreshSession: body.forceFreshSession === true,
        triggeredBy: actor.actorType,
        actorId: actor.actorId,
      },
    });

    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.run_woken",
      entityType: "goal_run",
      entityId: goalRun.id,
      details: {
        issueId: target.issueId,
        goalRunPhase: target.goalRunPhase,
        targetAgentId: target.agentId,
        heartbeatRunId: run?.id ?? null,
      },
    });

    if (!run) {
      res.status(202).json({ status: "skipped", reason: "no_actionable_goal_work" });
      return;
    }

    res.status(202).json({
      status: "queued",
      goalRunId: goalRun.id,
      goalRunPhase: target.goalRunPhase,
      issueId: target.issueId,
      agentId: target.agentId,
      heartbeatRunId: run.id,
    });
  });

  router.get("/goals/:id/scoreboard", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.getGoalScoreboard(goal.id));
  });

  router.put("/goals/:id/scoreboard", validate(putGoalScoreboardSchema), async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    const scoreboard = await goalLoop.putGoalScoreboard(goal.id, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.scoreboard_updated",
      entityType: "goal",
      entityId: goal.id,
      details: { metricCount: scoreboard.metrics.length },
    });
    res.json(scoreboard);
  });

  router.get("/goals/:id/runbook", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.getRunbook(goal.companyId, "goal", goal.id));
  });

  router.put("/goals/:id/runbook", validate(runbookPayloadSchema), async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    const actor = getActorInfo(req);
    const runbook = await goalLoop.putRunbook(goal.companyId, "goal", goal.id, req.body, {
      agentId: actor.agentId,
      userId: actor.actorType === "user" ? actor.actorId : null,
    });
    await logActivity(db, {
      companyId: goal.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.runbook_updated",
      entityType: "goal",
      entityId: goal.id,
      details: { entryCount: runbook.entries.length },
    });
    res.json(runbook);
  });

  router.get("/goals/:id/outputs", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.listGoalOutputs(goal.id));
  });

  router.get("/goals/:id/verifications", async (req, res) => {
    const goal = await goals.getById(req.params.id as string);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    assertCompanyAccess(req, goal.companyId);
    res.json(await goalLoop.listGoalVerifications(goal.id));
  });

  router.get("/outputs/:outputId/verifications", async (req, res) => {
    const output = await workProducts.getById(req.params.outputId as string);
    if (!output) {
      res.status(404).json({ error: "Output not found" });
      return;
    }
    assertCompanyAccess(req, output.companyId);
    res.json(await goalLoop.listOutputVerifications(output.id));
  });

  router.post("/outputs/:outputId/verifications", validate(createVerificationRunSchema), async (req, res) => {
    const output = await workProducts.getById(req.params.outputId as string);
    if (!output) {
      res.status(404).json({ error: "Output not found" });
      return;
    }
    assertCompanyAccess(req, output.companyId);
    const verification = await goalLoop.createVerificationRun(output.id, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: output.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.output_verified",
      entityType: "verification_run",
      entityId: verification.id,
      details: {
        outputId: output.id,
        goalId: output.goalId ?? null,
        goalRunId: output.goalRunId ?? null,
        verdict: verification.verdict,
      },
    });
    res.status(201).json(verification);
  });

  router.patch("/verifications/:id", validate(updateVerificationRunSchema), async (req, res) => {
    const existing = await goalLoop.getVerificationRun(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: "Verification run not found" });
      return;
    }
    assertCompanyAccess(req, existing.companyId);
    const verification = await goalLoop.updateVerificationRun(existing.id, req.body);
    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: verification.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      runId: actor.runId,
      action: "goal.verification_updated",
      entityType: "verification_run",
      entityId: verification.id,
      details: req.body,
    });
    res.json(verification);
  });

  return router;
}
