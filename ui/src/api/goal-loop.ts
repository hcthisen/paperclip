import type {
  ContextPack,
  GoalBrief,
  GoalLoopHealthSummary,
  GoalLoopOutputSummary,
  GoalRun,
  GoalRunWakeResult,
  GoalRuntime,
  GoalScoreboard,
  Recipe,
  ResourceLease,
  Runbook,
  VerificationRun,
} from "@paperclipai/shared";
import { api } from "./client";

export const goalLoopApi = {
  getContextPack: (companyId: string) =>
    api.get<ContextPack>(`/companies/${companyId}/context-pack`),
  getCompanyHealth: (companyId: string) =>
    api.get<GoalLoopHealthSummary>(`/companies/${companyId}/goal-loop/health`),
  putContextPack: (
    companyId: string,
    data: { sections: Array<{ key: string; title: string; body: string; orderIndex?: number }> },
  ) => api.put<ContextPack>(`/companies/${companyId}/context-pack`, data),
  listRecipes: (companyId: string) => api.get<Array<Recipe & { latestVersion: unknown | null }>>(`/companies/${companyId}/recipes`),
  getGoalBrief: (goalId: string) => api.get<GoalBrief | null>(`/goals/${goalId}/brief`),
  putGoalBrief: (goalId: string, data: Record<string, unknown>) =>
    api.put<GoalBrief>(`/goals/${goalId}/brief`, data),
  getGoalRuntime: (goalId: string) => api.get<GoalRuntime>(`/goals/${goalId}/runtime`),
  executeGoal: (goalId: string, data?: Record<string, unknown>) =>
    api.post<GoalRun & { issueId?: string | null }>(`/goals/${goalId}/execute`, data ?? {}),
  wakeGoalRun: (goalRunId: string, data?: Record<string, unknown>) =>
    api.post<GoalRunWakeResult>(`/goal-runs/${goalRunId}/wake`, data ?? {}),
  listGoalRuns: (goalId: string) => api.get<GoalRun[]>(`/goals/${goalId}/runs`),
  getGoalScoreboard: (goalId: string) => api.get<GoalScoreboard | null>(`/goals/${goalId}/scoreboard`),
  putGoalScoreboard: (goalId: string, data: Record<string, unknown>) =>
    api.put<GoalScoreboard>(`/goals/${goalId}/scoreboard`, data),
  getGoalRunbook: (goalId: string) => api.get<Runbook>(`/goals/${goalId}/runbook`),
  putGoalRunbook: (goalId: string, data: Record<string, unknown>) =>
    api.put<Runbook>(`/goals/${goalId}/runbook`, data),
  listGoalOutputs: (goalId: string) => api.get<GoalLoopOutputSummary[]>(`/goals/${goalId}/outputs`),
  listGoalVerifications: (goalId: string) => api.get<VerificationRun[]>(`/goals/${goalId}/verifications`),
  listOutputVerifications: (outputId: string) =>
    api.get<VerificationRun[]>(`/outputs/${outputId}/verifications`),
  createOutputVerification: (outputId: string, data: Record<string, unknown>) =>
    api.post<VerificationRun>(`/outputs/${outputId}/verifications`, data),
  updateVerification: (verificationId: string, data: Record<string, unknown>) =>
    api.patch<VerificationRun>(`/verifications/${verificationId}`, data),
  listResourceLeases: (companyId: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters ?? {});
    const qs = params.toString();
    return api.get<ResourceLease[]>(`/companies/${companyId}/resource-leases${qs ? `?${qs}` : ""}`);
  },
};
