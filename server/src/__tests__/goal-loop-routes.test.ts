import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goalLoopRoutes } from "../routes/goal-loop.js";
import { errorHandler } from "../middleware/index.js";

const mockCompanyService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockGoalService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockGoalLoopService = vi.hoisted(() => ({
  executeGoalRun: vi.fn(),
  listGoalRuns: vi.fn(),
  getGoalRun: vi.fn(),
  getCompanyGoalLoopHealth: vi.fn(),
  resolveGoalRunWakeTarget: vi.fn(),
  createVerificationRun: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  wakeup: vi.fn(),
}));

const mockWorkProductService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  companyService: () => mockCompanyService,
  goalService: () => mockGoalService,
  goalLoopService: () => mockGoalLoopService,
  heartbeatService: () => mockHeartbeatService,
  workProductService: () => mockWorkProductService,
  logActivity: mockLogActivity,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "board",
      userId: "local-board",
      companyIds: ["11111111-1111-4111-8111-111111111111"],
      source: "local_implicit",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", goalLoopRoutes({} as any));
  app.use(errorHandler);
  return app;
}

describe("goal-loop routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyService.getById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Paperclip",
    });
    mockGoalService.getById.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      companyId: "11111111-1111-4111-8111-111111111111",
      mode: "goal_loop",
      title: "Launch a campaign",
      status: "active",
    });
    mockWorkProductService.getById.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      companyId: "11111111-1111-4111-8111-111111111111",
      goalId: "22222222-2222-4222-8222-222222222222",
      goalRunId: "44444444-4444-4444-8444-444444444444",
    });
    mockGoalLoopService.executeGoalRun.mockResolvedValue({
      run: {
        id: "44444444-4444-4444-8444-444444444444",
        companyId: "11111111-1111-4111-8111-111111111111",
        goalId: "22222222-2222-4222-8222-222222222222",
        recipeVersionId: null,
        currentPhase: "direction",
        status: "running",
        latestIssueId: "55555555-5555-4555-8555-555555555555",
        measurementDueAt: null,
        failureSummary: null,
        startedAt: new Date("2026-04-04T10:00:00.000Z"),
        finishedAt: null,
        createdAt: new Date("2026-04-04T10:00:00.000Z"),
        updatedAt: new Date("2026-04-04T10:00:00.000Z"),
      },
      issue: {
        id: "55555555-5555-4555-8555-555555555555",
      },
    });
    mockGoalLoopService.listGoalRuns.mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        companyId: "11111111-1111-4111-8111-111111111111",
        goalId: "22222222-2222-4222-8222-222222222222",
        recipeVersionId: null,
        currentPhase: "direction",
        status: "running",
        latestIssueId: "55555555-5555-4555-8555-555555555555",
        measurementDueAt: null,
        failureSummary: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date("2026-04-04T10:00:00.000Z"),
        updatedAt: new Date("2026-04-04T10:00:00.000Z"),
      },
    ]);
    mockGoalLoopService.getGoalRun.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      companyId: "11111111-1111-4111-8111-111111111111",
      goalId: "22222222-2222-4222-8222-222222222222",
      recipeVersionId: null,
      currentPhase: "direction",
      status: "running",
      latestIssueId: "55555555-5555-4555-8555-555555555555",
      measurementDueAt: null,
      failureSummary: null,
      startedAt: new Date("2026-04-04T10:00:00.000Z"),
      finishedAt: null,
      createdAt: new Date("2026-04-04T10:00:00.000Z"),
      updatedAt: new Date("2026-04-04T10:00:00.000Z"),
    });
    mockGoalLoopService.getCompanyGoalLoopHealth.mockResolvedValue({
      companyId: "11111111-1111-4111-8111-111111111111",
      generatedAt: new Date("2026-04-05T10:00:00.000Z"),
      activeRunCount: 1,
      blockedRunCount: 0,
      needsWakeCount: 1,
      orphanedRunCount: 0,
      genericHeartbeatRunsLastHour: 0,
      skippedWakeupsLastHour: 0,
      runs: [
        {
          goalId: "22222222-2222-4222-8222-222222222222",
          goalTitle: "Launch a campaign",
          goalRunId: "44444444-4444-4444-8444-444444444444",
          status: "running",
          currentPhase: "direction",
          latestIssueId: "55555555-5555-4555-8555-555555555555",
          latestIssueTitle: "direction: Launch a campaign",
          latestIssueStatus: "todo",
          latestIssueAssigneeAgentId: "77777777-7777-4777-8777-777777777777",
          latestIssueExecutionRunId: null,
          blockedBy: null,
          nextWakeTargetAgentId: "77777777-7777-4777-8777-777777777777",
        },
      ],
    });
    mockGoalLoopService.resolveGoalRunWakeTarget.mockResolvedValue({
      companyId: "11111111-1111-4111-8111-111111111111",
      goalId: "22222222-2222-4222-8222-222222222222",
      goalRunId: "44444444-4444-4444-8444-444444444444",
      goalRunPhase: "direction",
      issueId: "55555555-5555-4555-8555-555555555555",
      agentId: "77777777-7777-4777-8777-777777777777",
      reason: "director_phase",
    });
    mockGoalLoopService.createVerificationRun.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      companyId: "11111111-1111-4111-8111-111111111111",
      goalId: "22222222-2222-4222-8222-222222222222",
      goalRunId: "44444444-4444-4444-8444-444444444444",
      outputId: "33333333-3333-4333-8333-333333333333",
      verdict: "passed",
      summary: "Verified",
      proofPayload: { url: "https://example.com/proof" },
      startedAt: new Date("2026-04-04T10:00:00.000Z"),
      finishedAt: new Date("2026-04-04T10:01:00.000Z"),
      createdAt: new Date("2026-04-04T10:00:00.000Z"),
      updatedAt: new Date("2026-04-04T10:01:00.000Z"),
    });
    mockHeartbeatService.wakeup.mockResolvedValue({
      id: "88888888-8888-4888-8888-888888888888",
    });
  });

  it("executes a goal run and returns the created issue id", async () => {
    const res = await request(createApp())
      .post("/api/goals/22222222-2222-4222-8222-222222222222/execute")
      .send({});

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      id: "44444444-4444-4444-8444-444444444444",
      goalId: "22222222-2222-4222-8222-222222222222",
      currentPhase: "direction",
      issueId: "55555555-5555-4555-8555-555555555555",
    });
    expect(mockGoalLoopService.executeGoalRun).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({ force: false }),
      expect.objectContaining({ userId: "local-board" }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "goal.execution_queued",
        entityType: "goal_run",
        entityId: "44444444-4444-4444-8444-444444444444",
        details: expect.objectContaining({
          issueId: "55555555-5555-4555-8555-555555555555",
          phase: "direction",
        }),
      }),
    );
  });

  it("lists goal runs for a goal-loop goal", async () => {
    const res = await request(createApp()).get("/api/goals/22222222-2222-4222-8222-222222222222/runs");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockGoalLoopService.listGoalRuns).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
  });

  it("creates verification runs for goal-loop outputs", async () => {
    const res = await request(createApp())
      .post("/api/outputs/33333333-3333-4333-8333-333333333333/verifications")
      .send({
        verdict: "passed",
        summary: "Verified",
        proofPayload: { url: "https://example.com/proof" },
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      id: "66666666-6666-4666-8666-666666666666",
      outputId: "33333333-3333-4333-8333-333333333333",
      verdict: "passed",
    });
    expect(mockGoalLoopService.createVerificationRun).toHaveBeenCalledWith(
      "33333333-3333-4333-8333-333333333333",
      {
        verdict: "passed",
        summary: "Verified",
        proofPayload: { url: "https://example.com/proof" },
      },
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "goal.output_verified",
        entityType: "verification_run",
        entityId: "66666666-6666-4666-8666-666666666666",
        details: expect.objectContaining({
          outputId: "33333333-3333-4333-8333-333333333333",
          verdict: "passed",
        }),
      }),
    );
  });

  it("returns company goal-loop health", async () => {
    const res = await request(createApp()).get("/api/companies/11111111-1111-4111-8111-111111111111/goal-loop/health");

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({
      companyId: "11111111-1111-4111-8111-111111111111",
      activeRunCount: 1,
      needsWakeCount: 1,
    });
    expect(mockGoalLoopService.getCompanyGoalLoopHealth).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("wakes a goal run through its actionable phase issue", async () => {
    const res = await request(createApp())
      .post("/api/goal-runs/44444444-4444-4444-8444-444444444444/wake")
      .send({});

    expect(res.status, JSON.stringify(res.body)).toBe(202);
    expect(res.body).toMatchObject({
      status: "queued",
      goalRunId: "44444444-4444-4444-8444-444444444444",
      issueId: "55555555-5555-4555-8555-555555555555",
      agentId: "77777777-7777-4777-8777-777777777777",
      heartbeatRunId: "88888888-8888-4888-8888-888888888888",
    });
    expect(mockGoalLoopService.resolveGoalRunWakeTarget).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      expect.objectContaining({ preferredAgentId: null }),
    );
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      expect.objectContaining({
        reason: "goal_run_wake",
        payload: expect.objectContaining({
          issueId: "55555555-5555-4555-8555-555555555555",
          goalRunId: "44444444-4444-4444-8444-444444444444",
          goalRunPhase: "direction",
        }),
      }),
    );
  });
});
