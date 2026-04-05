import { z } from "zod";
import { GOAL_LEVELS, GOAL_MODES, GOAL_STATUSES } from "../constants.js";

export const createGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  level: z.enum(GOAL_LEVELS).optional().default("task"),
  status: z.enum(GOAL_STATUSES).optional().default("planned"),
  mode: z.enum(GOAL_MODES).optional(),
  parentId: z.string().uuid().optional().nullable(),
  ownerAgentId: z.string().uuid().optional().nullable(),
  kpiFamily: z.string().trim().min(1).max(120).optional().nullable(),
  timeframe: z.string().trim().min(1).max(120).optional().nullable(),
  currentStateSummary: z.string().trim().max(2000).optional().nullable(),
});

export type CreateGoal = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = createGoalSchema.partial();

export type UpdateGoal = z.infer<typeof updateGoalSchema>;
