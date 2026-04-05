import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  companies,
  contextPacks,
  createDb,
  documentRevisions,
  documents,
  goalBriefs,
  goalRuns,
  goalScoreboards,
  goals,
  heartbeatRuns,
  issues,
  projects,
  recipes,
  recipeVersions,
  resourceLeases,
  runbooks,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { classifyTitanClawsIssue, goalLoopCutoverService } from "../services/goal-loop-cutover.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres goal-loop cutover tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describe("classifyTitanClawsIssue", () => {
  it("routes website popup work into the website/email capture goal", () => {
    const result = classifyTitanClawsIssue({
      title: "Update email popup CTA and visually QA it",
      status: "todo",
      projectName: "Website improvements",
    });

    expect(result.goalKey).toBe("website_email_capture");
    expect(result.disposition).toBe("runbook_next_action");
  });

  it("routes blocked supplier work into product current-state context", () => {
    const result = classifyTitanClawsIssue({
      title: "Blocked on supplier quote for first prototype batch",
      status: "blocked",
    });

    expect(result.goalKey).toBe("prototype_supplier_pipeline");
    expect(result.disposition).toBe("goal_current_state");
  });
});

describeEmbeddedPostgres("goalLoopCutoverService Titan Claws bootstrap", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof goalLoopCutoverService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-goal-loop-cutover-");
    db = createDb(tempDb.connectionString);
    svc = goalLoopCutoverService(db);
  }, 20_000);

  afterEach(async () => {
    await db.delete(resourceLeases);
    await db.delete(heartbeatRuns);
    await db.delete(issues);
    await db.delete(projects);
    await db.delete(goalRuns);
    await db.delete(goalBriefs);
    await db.delete(goalScoreboards);
    await db.delete(runbooks);
    await db.delete(contextPacks);
    await db.delete(recipeVersions);
    await db.delete(recipes);
    await db.delete(documentRevisions);
    await db.delete(documents);
    await db.delete(goals);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("archives classic work, pauses agents, seeds GoalLoop artifacts, and launches the first goal", async () => {
    const companyId = randomUUID();
    const companyGoalId = randomUUID();
    const socialGoalId = randomUUID();
    const ceoId = randomUUID();
    const marketerId = randomUUID();
    const websiteProjectId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Titan Claws",
      issuePrefix: "TIT",
      issueCounter: 286,
      requireBoardApprovalForNewAgents: false,
      defaultGoalMode: "classic",
    });

    await db.insert(goals).values([
      {
        id: companyGoalId,
        companyId,
        title: "Titan Claws Website: https://titanclaws.com",
        description: "Root classic company goal",
        level: "company",
        status: "active",
        mode: "classic",
      },
      {
        id: socialGoalId,
        companyId,
        title: "Grow engaged audience through daily social content and weekly blog articles",
        description: "Classic social goal",
        level: "team",
        status: "active",
        mode: "classic",
      },
    ]);

    await db.insert(agents).values([
      {
        id: ceoId,
        companyId,
        name: "CEO",
        role: "ceo",
        status: "idle",
        adapterType: "claude_local",
        runtimeConfig: {
          heartbeat: {
            enabled: true,
            intervalSec: 3600,
            wakeOnDemand: true,
            maxConcurrentRuns: 1,
          },
        },
      },
      {
        id: marketerId,
        companyId,
        name: "Marketing Lead",
        role: "marketing",
        status: "active",
        adapterType: "claude_local",
        runtimeConfig: {
          heartbeat: {
            enabled: true,
            intervalSec: 1800,
            wakeOnDemand: true,
            maxConcurrentRuns: 1,
          },
        },
      },
    ]);

    await db.insert(projects).values({
      id: websiteProjectId,
      companyId,
      name: "Website conversion",
      description: "Landing and popup work",
      status: "in_progress",
    });

    await db.insert(issues).values([
      {
        companyId,
        projectId: websiteProjectId,
        title: "Update email popup CTA and visually QA it",
        status: "todo",
        priority: "high",
        assigneeAgentId: marketerId,
        issueNumber: 286,
        identifier: "TIT-286",
      },
      {
        companyId,
        goalId: socialGoalId,
        title: "SoMe Weekly Review: Apr 4-10 to Create Apr 12-18 batch",
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: marketerId,
        issueNumber: 283,
        identifier: "TIT-283",
      },
      {
        companyId,
        title: "Blocked on supplier quote for first prototype batch",
        status: "blocked",
        priority: "high",
        assigneeAgentId: ceoId,
        issueNumber: 280,
        identifier: "TIT-280",
      },
    ]);

    const archive = await svc.buildTitanClawsCutoverArchive(companyId);
    expect(archive.company.defaultGoalMode).toBe("classic");
    expect(archive.openIssues).toHaveLength(3);
    expect(archive.backlogByGoal.find((entry) => entry.goalKey === "website_email_capture")?.openIssueCount).toBe(1);
    expect(
      archive.openIssues.find((issue) => issue.identifier === "TIT-286")?.classification.goalKey,
    ).toBe("website_email_capture");

    const result = await svc.applyTitanClawsGoalLoopCutover(companyId, {
      actor: { userId: "board-user" },
      launchFirstGoal: true,
    });

    expect(result.defaultGoalMode).toBe("goal_loop");
    expect(result.pausedAgentIds).toEqual(expect.arrayContaining([ceoId, marketerId]));
    expect(result.goals).toHaveLength(6);
    expect(result.firstLaunch?.status).toBe("running");
    expect(result.firstLaunch?.issueId).toBeTruthy();

    const updatedCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    expect(updatedCompany?.defaultGoalMode).toBe("goal_loop");

    const updatedAgents = await db.select().from(agents).where(eq(agents.companyId, companyId));
    expect(updatedAgents.every((agent) => agent.status === "paused")).toBe(true);

    const goalLoopGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.companyId, companyId), eq(goals.mode, "goal_loop")));
    expect(goalLoopGoals).toHaveLength(6);

    const websiteGoal = goalLoopGoals.find((goal) => goal.title === "Website and email capture conversion");
    expect(websiteGoal?.status).toBe("active");

    const websiteBrief = websiteGoal
      ? await db.select().from(goalBriefs).where(eq(goalBriefs.goalId, websiteGoal.id)).then((rows) => rows[0] ?? null)
      : null;
    expect(websiteBrief?.status).toBe("ready");

    const productGoal = goalLoopGoals.find((goal) => goal.title === "Product-market-fit and pre-sell validation");
    const productBrief = productGoal
      ? await db.select().from(goalBriefs).where(eq(goalBriefs.goalId, productGoal.id)).then((rows) => rows[0] ?? null)
      : null;
    expect(productGoal?.status).toBe("planned");
    expect(productBrief?.status).toBe("draft");

    const context = await db.select().from(contextPacks).where(eq(contextPacks.companyId, companyId));
    expect(context.length).toBeGreaterThanOrEqual(4);

    const companyRunbook = await db
      .select()
      .from(runbooks)
      .where(and(eq(runbooks.companyId, companyId), eq(runbooks.scopeType, "company"), eq(runbooks.scopeId, companyId)));
    expect(companyRunbook).toHaveLength(3);
  });
});
