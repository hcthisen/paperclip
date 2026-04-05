import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueRoutes } from "../routes/issues.js";
import { errorHandler } from "../middleware/index.js";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
}));

const mockGoalLoopService = vi.hoisted(() => ({
  validateGoalRunIssueStatusChange: vi.fn(async () => undefined),
  syncGoalRunForIssue: vi.fn(async () => null),
}));

const mockRoutineService = vi.hoisted(() => ({
  syncRunStatusForIssue: vi.fn(async () => undefined),
}));

const mockWorkProductService = vi.hoisted(() => ({
  createForIssue: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../services/index.js", () => ({
  accessService: () => ({ canUser: vi.fn(), hasPermission: vi.fn() }),
  agentService: () => ({ getById: vi.fn() }),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  goalService: () => ({ getDefaultCompanyGoal: vi.fn() }),
  goalLoopService: () => mockGoalLoopService,
  heartbeatService: () => ({
    wakeup: vi.fn(async () => undefined),
    reportRunActivity: vi.fn(async () => undefined),
    getRun: vi.fn(async () => null),
    getActiveRunForAgent: vi.fn(async () => null),
    cancelRun: vi.fn(async () => null),
  }),
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  projectService: () => ({}),
  routineService: () => mockRoutineService,
  workProductService: () => mockWorkProductService,
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
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

function makeIssue(status: string) {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    companyId: "11111111-1111-4111-8111-111111111111",
    projectId: "88888888-8888-4888-8888-888888888888",
    goalId: "22222222-2222-4222-8222-222222222222",
    goalRunId: "44444444-4444-4444-8444-444444444444",
    parentId: null,
    status,
    priority: "medium",
    identifier: "PAP-900",
    title: "Goal-loop execution issue",
    description: null,
    assigneeAgentId: null,
    assigneeUserId: null,
    createdByAgentId: null,
    createdByUserId: "local-board",
    requestDepth: 0,
    billingCode: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    executionRunId: null,
    hiddenAt: null,
    createdAt: new Date("2026-04-04T10:00:00.000Z"),
    updatedAt: new Date("2026-04-04T10:00:00.000Z"),
  };
}

describe("issue routes goal-loop integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates goal-loop proof gating and logs phase advancement on terminal status updates", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("in_progress"));
    mockIssueService.update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...makeIssue("in_progress"),
      ...patch,
    }));
    mockGoalLoopService.syncGoalRunForIssue.mockResolvedValue({
      run: {
        id: "44444444-4444-4444-8444-444444444444",
        currentPhase: "production",
      },
      nextIssue: {
        id: "99999999-9999-4999-8999-999999999999",
      },
    });

    const res = await request(createApp())
      .patch("/api/issues/77777777-7777-4777-8777-777777777777")
      .send({ status: "done" });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(mockGoalLoopService.validateGoalRunIssueStatusChange).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      "done",
    );
    expect(mockGoalLoopService.syncGoalRunForIssue).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      expect.objectContaining({ userId: "local-board" }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "goal.phase_advanced",
        entityType: "goal_run",
        entityId: "44444444-4444-4444-8444-444444444444",
        details: expect.objectContaining({
          completedIssueId: "77777777-7777-4777-8777-777777777777",
          nextIssueId: "99999999-9999-4999-8999-999999999999",
          phase: "production",
        }),
      }),
    );
  });

  it("inherits goal-loop linkage when creating issue work products", async () => {
    mockIssueService.getById.mockResolvedValue(makeIssue("in_progress"));
    mockWorkProductService.createForIssue.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      issueId: "77777777-7777-4777-8777-777777777777",
      companyId: "11111111-1111-4111-8111-111111111111",
      projectId: "88888888-8888-4888-8888-888888888888",
      goalId: "22222222-2222-4222-8222-222222222222",
      goalRunId: "44444444-4444-4444-8444-444444444444",
      type: "artifact",
      provider: "manual",
      title: "Published output",
      status: "active",
    });

    const res = await request(createApp())
      .post("/api/issues/77777777-7777-4777-8777-777777777777/work-products")
      .send({
        type: "artifact",
        provider: "manual",
        title: "Published output",
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(mockWorkProductService.createForIssue).toHaveBeenCalledWith(
      "77777777-7777-4777-8777-777777777777",
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        projectId: "88888888-8888-4888-8888-888888888888",
        goalId: "22222222-2222-4222-8222-222222222222",
        goalRunId: "44444444-4444-4444-8444-444444444444",
      }),
    );
  });
});
