import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { agents, companies, createDb, issues } from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { resolveAssignedActionableIssueForAgent } from "../services/heartbeat.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres heartbeat routing tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("heartbeat actionable issue routing", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-heartbeat-routing-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(issues);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCompanyAgent() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Titan Claws",
      issuePrefix,
      defaultGoalMode: "goal_loop",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "UXDesigner",
      role: "designer",
      status: "idle",
      adapterType: "claude_local",
      adapterConfig: {},
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 3600,
          wakeOnDemand: true,
          maxConcurrentRuns: 1,
        },
      },
      permissions: {},
    });

    return { companyId, agentId, issuePrefix };
  }

  it("returns an assigned non-goal issue as actionable work", async () => {
    const { companyId, agentId, issuePrefix } = await seedCompanyAgent();
    const issueId = randomUUID();

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "UX review the headless site",
      status: "todo",
      priority: "high",
      assigneeAgentId: agentId,
      issueNumber: 1,
      identifier: `${issuePrefix}-1`,
    });

    const target = await resolveAssignedActionableIssueForAgent(db, { companyId, agentId });
    expect(target).toMatchObject({
      issueId,
      goalId: null,
      goalRunId: null,
      goalRunPhase: null,
    });
  });

  it("prefers in-progress actionable work ahead of todo and ignores hidden issues", async () => {
    const { companyId, agentId, issuePrefix } = await seedCompanyAgent();
    const hiddenIssueId = randomUUID();
    const todoIssueId = randomUUID();
    const inProgressIssueId = randomUUID();

    await db.insert(issues).values([
      {
        id: hiddenIssueId,
        companyId,
        title: "Hidden issue should not wake",
        status: "in_progress",
        priority: "critical",
        assigneeAgentId: agentId,
        issueNumber: 1,
        identifier: `${issuePrefix}-1`,
        hiddenAt: new Date("2026-04-05T00:00:00.000Z"),
      },
      {
        id: todoIssueId,
        companyId,
        title: "Todo issue",
        status: "todo",
        priority: "critical",
        assigneeAgentId: agentId,
        issueNumber: 2,
        identifier: `${issuePrefix}-2`,
      },
      {
        id: inProgressIssueId,
        companyId,
        title: "In progress issue",
        status: "in_progress",
        priority: "low",
        assigneeAgentId: agentId,
        issueNumber: 3,
        identifier: `${issuePrefix}-3`,
      },
    ]);

    const target = await resolveAssignedActionableIssueForAgent(db, { companyId, agentId });
    expect(target?.issueId).toBe(inProgressIssueId);
  });
});
