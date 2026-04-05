import type { GoalLevel, GoalMode, GoalStatus } from "../constants.js";

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  status: GoalStatus;
  mode?: GoalMode;
  parentId: string | null;
  ownerAgentId: string | null;
  kpiFamily?: string | null;
  timeframe?: string | null;
  currentStateSummary?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
