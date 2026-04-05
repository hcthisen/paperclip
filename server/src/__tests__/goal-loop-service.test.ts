import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agents,
  agentWakeupRequests,
  companies,
  createDb,
  documents,
  goalBriefs,
  goalRuns,
  goals,
  heartbeatRuns,
  issueWorkProducts,
  issues,
  recipes,
  recipeVersions,
  resourceLeases,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { goalLoopService } from "../services/goal-loop.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres goal-loop service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("goalLoopService resource lease handling", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof goalLoopService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-goal-loop-service-");
    db = createDb(tempDb.connectionString);
    svc = goalLoopService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(agentWakeupRequests);
    await db.delete(heartbeatRuns);
    await db.delete(resourceLeases);
    await db.delete(issueWorkProducts);
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(goalRuns);
    await db.delete(goalBriefs);
    await db.delete(recipeVersions);
    await db.delete(recipes);
    await db.delete(documents);
    await db.delete(goals);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("queues conflicting production runs behind an active exclusive-write lease", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GL${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Repair the website",
      description: "Goal-loop lease test",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Repair the homepage and publish the changes.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "website-repair-test",
      name: "Website repair",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Website repair v1",
      definition: {},
      requiredSkillKeys: [],
      outputType: "website",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Homepage repaired",
      finishCriteria: [{ id: "finish", label: "Publish the fix" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const firstRun = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "production" },
      { userId: "board-user" },
    );

    expect(firstRun.run.status).toBe("running");
    expect(firstRun.run.currentPhase).toBe("production");
    expect(firstRun.issue?.id).toBeTruthy();

    const blockedRun = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "production", force: true },
      { userId: "board-user" },
    );

    expect(blockedRun.issue).toBeNull();
    expect(blockedRun.run.status).toBe("queued");
    expect(blockedRun.run.currentPhase).toBe("production");
    expect(blockedRun.run.failureSummary).toContain("Waiting for resource lease");

    const leases = await svc.listResourceLeases(companyId, {
      goalId,
      status: "active",
    });
    expect(leases).toHaveLength(1);
    expect(leases[0]).toMatchObject({
      goalRunId: firstRun.run.id,
      mode: "exclusive_write",
      status: "active",
    });
  });

  it("blocks verification-phase completion until a primary output is verified", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GV${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Verify a shipped output",
      description: "Goal-loop proof gate test",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Ship and verify the output.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "verification-test",
      name: "Verification recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Verification v1",
      definition: {},
      requiredSkillKeys: [],
      outputType: "document",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Output verified",
      finishCriteria: [{ id: "finish", label: "Verify the output" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "verification" },
      { userId: "board-user" },
    );

    expect(run.issue?.id).toBeTruthy();

    await expect(svc.validateGoalRunIssueStatusChange(run.issue!.id, "done")).rejects.toThrow(
      "Verification phase cannot complete until a primary output is verified",
    );

    await db.insert(issueWorkProducts).values({
      companyId,
      issueId: run.issue!.id,
      goalId,
      goalRunId: run.run.id,
      type: "document",
      provider: "manual",
      title: "Published artifact",
      status: "ready_for_review",
      outputType: "document",
      outputStatus: "verified",
      isPrimary: true,
      verifiedAt: new Date(),
    });

    await expect(svc.validateGoalRunIssueStatusChange(run.issue!.id, "done")).resolves.toBeUndefined();
  });

  it("allows measurement-phase completion after scoreboard and runbook updates", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GM${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Measure a verified output",
      description: "Goal-loop measurement readiness test",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Ship, verify, and measure the output.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "measurement-test",
      name: "Measurement recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Measurement v1",
      definition: {},
      requiredSkillKeys: [],
      outputType: "website",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Measured output",
      finishCriteria: [{ id: "finish", label: "Complete measurement" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "measurement" },
      { userId: "board-user" },
    );

    expect(run.issue?.id).toBeTruthy();

    await db.insert(issueWorkProducts).values({
      companyId,
      issueId: run.issue!.id,
      goalId,
      goalRunId: run.run.id,
      type: "website",
      provider: "manual",
      title: "Verified output",
      status: "ready_for_review",
      outputType: "website",
      outputStatus: "verified",
      isPrimary: true,
      proofUrl: "https://example.com/proof",
      verifiedAt: new Date(),
    });

    await svc.putGoalScoreboard(goalId, {
      summary: "Measured improvement after verification.",
      metrics: [{ key: "coverage", label: "Coverage", value: "3/5" }],
    });
    await svc.putRunbook(
      companyId,
      "goal",
      goalId,
      {
        entries: [
          {
            title: "Next cycle",
            body: "Continue the verified flow and extend coverage.",
            orderIndex: 0,
          },
        ],
      },
      { userId: "board-user" },
    );

    await expect(svc.validateGoalRunIssueStatusChange(run.issue!.id, "done")).resolves.toBeUndefined();
  });

  it("auto-assigns the direction phase to the CEO and resolves a director wake target", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();
    const ceoId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GD${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(agents).values({
      id: ceoId,
      companyId,
      name: "CEO",
      role: "ceo",
      status: "idle",
      adapterType: "process",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Direction-owned goal",
      description: "Direction should route to the CEO",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Write the direction plan and delegate production.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "director-route-test",
      name: "Director route recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Director route v1",
      definition: {
        directorRouting: { preferredRole: "ceo" },
        workerRouting: { direction: "ceo", production: "cto", verification: "qa", measurement: "ceo" },
      },
      requiredSkillKeys: [],
      outputType: "document",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Direction captured",
      finishCriteria: [{ id: "finish", label: "Create the direction plan" }],
      accessChecklist: [{ key: "ops", label: "Ops access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(goalId, {}, { userId: "board-user" });
    expect(run.issue?.id).toBeTruthy();

    const createdIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, run.issue!.id))
      .then((rows) => rows[0] ?? null);
    expect(createdIssue?.assigneeAgentId).toBe(ceoId);

    const wakeTarget = await svc.resolveGoalLoopWakeTargetForAgent(ceoId);
    expect(wakeTarget).toMatchObject({
      goalRunId: run.run.id,
      goalRunPhase: "direction",
      issueId: run.issue!.id,
      agentId: ceoId,
      reason: "assigned_issue",
    });
  });

  it("routes blocked goal-loop work back to the director and reports it in health", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();
    const ceoId = randomUUID();
    const ctoId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GB${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(agents).values([
      {
        id: ceoId,
        companyId,
        name: "CEO",
        role: "ceo",
        status: "idle",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: ctoId,
        companyId,
        name: "CTO",
        role: "cto",
        status: "idle",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Blocked production goal",
      description: "Blocked production should bounce back to the director",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Ship the output unless a blocker requires CEO intervention.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "blocked-production-test",
      name: "Blocked production recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Blocked production v1",
      definition: {
        directorRouting: { preferredRole: "ceo" },
        workerRouting: { direction: "ceo", production: "cto", verification: "qa", measurement: "ceo" },
      },
      requiredSkillKeys: [],
      outputType: "website_page",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Blocked production is surfaced cleanly",
      finishCriteria: [{ id: "finish", label: "Block the run and route it back to the CEO" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "production" },
      { userId: "board-user" },
    );

    expect(run.issue?.id).toBeTruthy();

    await db
      .update(issues)
      .set({
        status: "blocked",
        updatedAt: new Date(),
      })
      .where(eq(issues.id, run.issue!.id));

    const synced = await svc.syncGoalRunForIssue(run.issue!.id, { userId: "board-user" });
    expect(synced?.run.status).toBe("needs_human_decision");

    const workerWakeTarget = await svc.resolveGoalLoopWakeTargetForAgent(ctoId);
    expect(workerWakeTarget).toBeNull();

    const directorWakeTarget = await svc.resolveGoalLoopWakeTargetForAgent(ceoId);
    expect(directorWakeTarget).toMatchObject({
      goalRunId: run.run.id,
      issueId: run.issue!.id,
      agentId: ceoId,
      reason: "human_decision",
    });

    await db.insert(heartbeatRuns).values({
      companyId,
      agentId: ctoId,
      invocationSource: "timer",
      triggerDetail: "system",
      status: "succeeded",
      startedAt: new Date(),
      finishedAt: new Date(),
      contextSnapshot: {},
    });
    await db.insert(agentWakeupRequests).values({
      companyId,
      agentId: ceoId,
      source: "on_demand",
      triggerDetail: "manual",
      reason: "no_actionable_goal_work",
      status: "skipped",
      finishedAt: new Date(),
    });

    const health = await svc.getCompanyGoalLoopHealth(companyId);
    expect(health.activeRunCount).toBe(1);
    expect(health.blockedRunCount).toBe(1);
    expect(health.genericHeartbeatRunsLastHour).toBe(1);
    expect(health.skippedWakeupsLastHour).toBe(1);
    expect(health.runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          goalId,
          goalRunId: run.run.id,
          status: "needs_human_decision",
          latestIssueId: run.issue!.id,
          nextWakeTargetAgentId: ceoId,
        }),
      ]),
    );
  });

  it("advances production to verification when a primary output is shipped", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();
    const ctoId = randomUUID();
    const qaId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GP${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(agents).values([
      {
        id: ctoId,
        companyId,
        name: "CTO",
        role: "cto",
        status: "idle",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: qaId,
        companyId,
        name: "QA",
        role: "qa",
        status: "idle",
        adapterType: "process",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Ship the first output",
      description: "Production should advance from real output state",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Ship the output and move directly into verification.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "production-state-test",
      name: "Production state recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Production state v1",
      definition: {
        workerRouting: { direction: "ceo", production: "cto", verification: "qa", measurement: "ceo" },
      },
      requiredSkillKeys: [],
      outputType: "website_page",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Output shipped",
      finishCriteria: [{ id: "finish", label: "Ship the site change" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "production" },
      { userId: "board-user" },
    );

    expect(run.issue?.id).toBeTruthy();
    const productionIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, run.issue!.id))
      .then((rows) => rows[0] ?? null);
    expect(productionIssue?.assigneeAgentId).toBe(ctoId);

    await db.insert(issueWorkProducts).values({
      companyId,
      issueId: run.issue!.id,
      goalId,
      goalRunId: run.run.id,
      type: "website",
      provider: "manual",
      title: "Homepage waitlist live",
      status: "ready_for_review",
      outputType: "website_page",
      outputStatus: "shipped_pending_verification",
      isPrimary: true,
      url: "https://example.com/waitlist",
      proofUrl: "https://example.com/proof",
      shippedAt: new Date(),
    });

    const sync = await svc.syncGoalRunForIssue(run.issue!.id, { userId: "board-user" });
    expect(sync?.run.currentPhase).toBe("verification");
    expect(sync?.nextIssue?.id).toBeTruthy();

    const verificationIssue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, sync!.nextIssue!.id))
      .then((rows) => rows[0] ?? null);
    expect(verificationIssue?.assigneeAgentId).toBe(qaId);
  });

  it("auto-completes measurement once scoreboard and runbook state are present", async () => {
    const companyId = randomUUID();
    const goalId = randomUUID();
    const recipeId = randomUUID();
    const recipeVersionId = randomUUID();
    const briefDocumentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `GA${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "goal_loop",
    });

    await db.insert(goals).values({
      id: goalId,
      companyId,
      title: "Auto-complete measurement",
      description: "Measurement should succeed from goal state",
      level: "company",
      status: "active",
      mode: "goal_loop",
    });

    await db.insert(documents).values({
      id: briefDocumentId,
      companyId,
      title: "Goal brief",
      latestBody: "Measure the verified output and record the next action.",
      latestRevisionNumber: 1,
      createdByUserId: "board-user",
      updatedByUserId: "board-user",
    });

    await db.insert(recipes).values({
      id: recipeId,
      companyId,
      slug: "measurement-auto-test",
      name: "Measurement auto recipe",
      source: "company",
      status: "active",
    });

    await db.insert(recipeVersions).values({
      id: recipeVersionId,
      companyId,
      recipeId,
      version: 1,
      title: "Measurement auto v1",
      definition: { measurementCadence: "immediate" },
      requiredSkillKeys: [],
      outputType: "website_page",
      createsPrimaryOutput: true,
    });

    await db.insert(goalBriefs).values({
      companyId,
      goalId,
      documentId: briefDocumentId,
      status: "ready",
      recipeId,
      recipeVersionId,
      finishLine: "Measurement done",
      finishCriteria: [{ id: "finish", label: "Record measurement and next action" }],
      accessChecklist: [{ key: "site", label: "Production access", status: "ready" }],
      launchChecklist: [],
    });

    const run = await svc.executeGoalRun(
      goalId,
      { requestedPhase: "measurement" },
      { userId: "board-user" },
    );

    await db.insert(issueWorkProducts).values({
      companyId,
      issueId: run.issue!.id,
      goalId,
      goalRunId: run.run.id,
      type: "website",
      provider: "manual",
      title: "Verified output",
      status: "ready_for_review",
      outputType: "website_page",
      outputStatus: "verified",
      isPrimary: true,
      proofUrl: "https://example.com/proof",
      verifiedAt: new Date(),
    });

    await svc.putGoalScoreboard(goalId, {
      summary: "Measured after verification.",
      metrics: [{ key: "signups", label: "Signups", value: 5 }],
    });
    await svc.putRunbook(
      companyId,
      "goal",
      goalId,
      {
        entries: [{ title: "Next action", body: "Scale the winning variant.", orderIndex: 0 }],
      },
      { userId: "board-user" },
    );

    const completedRun = await svc.getGoalRun(run.run.id);
    expect(completedRun?.status).toBe("succeeded");
    expect(completedRun?.finishedAt).toBeTruthy();
  });
});
