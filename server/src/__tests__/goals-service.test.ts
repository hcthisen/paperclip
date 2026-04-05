import { describe, expect, it, vi } from "vitest";
import { goalService } from "../services/goals.js";

function createDb(defaultGoalMode: "goal_loop" | "classic") {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(() => Promise.resolve([{ defaultGoalMode }]));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select, insert } as any,
    values,
    returning,
  };
}

describe("goal service create", () => {
  it("defaults new goals to classic for legacy companies", async () => {
    const { db, values, returning } = createDb("classic");
    returning.mockResolvedValue([
      {
        id: "goal-legacy",
        companyId: "company-legacy",
        mode: "classic",
      },
    ]);

    const service = goalService(db);
    await service.create("company-legacy", {
      title: "Keep the classic workflow",
      description: null,
      level: "company",
      parentId: null,
      ownerAgentId: null,
      status: "active",
    } as any);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-legacy",
        mode: "classic",
      }),
    );
  });

  it("defaults new goals to the company default goal mode", async () => {
    const { db, values, returning } = createDb("goal_loop");
    returning.mockResolvedValue([
      {
        id: "goal-1",
        companyId: "company-1",
        mode: "goal_loop",
      },
    ]);

    const service = goalService(db);
    await service.create("company-1", {
      title: "Launch a goal-loop company",
      description: null,
      level: "company",
      parentId: null,
      ownerAgentId: null,
      status: "active",
    } as any);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        mode: "goal_loop",
      }),
    );
  });

  it("preserves an explicit mode override when creating a goal", async () => {
    const { db, values, returning } = createDb("goal_loop");
    returning.mockResolvedValue([
      {
        id: "goal-1",
        companyId: "company-1",
        mode: "classic",
      },
    ]);

    const service = goalService(db);
    await service.create("company-1", {
      title: "Stay in classic mode",
      description: null,
      level: "company",
      parentId: null,
      ownerAgentId: null,
      status: "active",
      mode: "classic",
    } as any);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        mode: "classic",
      }),
    );
  });
});
