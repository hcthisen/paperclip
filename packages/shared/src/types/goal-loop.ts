import type {
  AgentRole,
  GoalBriefStatus,
  GoalOutputType,
  GoalRunPhase,
  GoalRunStatus,
  LeaseMode,
  OutputStatus,
  RecipeSource,
  ResourceLeaseStatus,
  RunbookScopeType,
  VerificationVerdict,
} from "../constants.js";

export interface ContextPackSection {
  key: string;
  title: string;
  body: string;
  orderIndex: number;
}

export interface ContextPack {
  companyId: string;
  sections: ContextPackSection[];
  updatedAt: Date | null;
}

export interface RunbookEntry {
  id: string;
  title: string;
  body: string;
  orderIndex: number;
  updatedAt: Date | null;
}

export interface Runbook {
  companyId: string;
  scopeType: RunbookScopeType;
  scopeId: string;
  entries: RunbookEntry[];
  updatedAt: Date | null;
}

export type RecipeStatus = "active" | "archived";

export type RecipeMeasurementCadence = "immediate" | "manual";

export interface RecipeVerificationPolicy {
  primaryOutputRequired: boolean;
  humanReviewOnAmbiguous: boolean;
}

export interface RecipeDirectorRouting {
  preferredRole: AgentRole | null;
}

export interface RecipeWorkerRouting {
  direction: AgentRole | null;
  production: AgentRole | null;
  verification: AgentRole | null;
  measurement: AgentRole | null;
}

export interface Recipe {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string | null;
  source: RecipeSource;
  status: RecipeStatus;
  latestVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeVersion {
  id: string;
  companyId: string;
  recipeId: string;
  version: number;
  title: string;
  description: string | null;
  definition: Record<string, unknown> | null;
  requiredSkillKeys: string[];
  outputType: GoalOutputType;
  createsPrimaryOutput: boolean;
  verificationPolicy: RecipeVerificationPolicy;
  measurementCadence: RecipeMeasurementCadence;
  directorRouting: RecipeDirectorRouting;
  workerRouting: RecipeWorkerRouting;
  requiredResources: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalBriefFinishCriterion {
  id: string;
  label: string;
  description: string | null;
}

export type GoalBriefAccessStatus = "pending" | "ready" | "blocked";

export interface GoalBriefAccessItem {
  key: string;
  label: string;
  status: GoalBriefAccessStatus;
  notes: string | null;
}

export interface GoalBrief {
  id: string;
  companyId: string;
  goalId: string;
  status: GoalBriefStatus;
  recipeId: string | null;
  recipeVersionId: string | null;
  body: string;
  finishLine: string | null;
  kpiFamily: string | null;
  timeframe: string | null;
  currentStateSummary: string | null;
  finishCriteria: GoalBriefFinishCriterion[];
  accessChecklist: GoalBriefAccessItem[];
  launchChecklist: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalRun {
  id: string;
  companyId: string;
  goalId: string;
  recipeVersionId: string | null;
  currentPhase: GoalRunPhase;
  status: GoalRunStatus;
  latestIssueId: string | null;
  measurementDueAt: Date | null;
  failureSummary: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationRun {
  id: string;
  companyId: string;
  goalId: string;
  goalRunId: string;
  outputId: string;
  verdict: VerificationVerdict;
  summary: string | null;
  proofPayload: Record<string, unknown> | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalScoreboardMetricValue = string | number | boolean | null;

export interface GoalScoreboardMetric {
  key: string;
  label: string;
  value: GoalScoreboardMetricValue;
  unit: string | null;
  delta: number | null;
  observedAt: Date | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface GoalScoreboard {
  id: string;
  companyId: string;
  goalId: string;
  summary: string | null;
  metrics: GoalScoreboardMetric[];
  updatedAt: Date;
}

export interface GoalScoreboardSnapshot {
  id: string;
  companyId: string;
  goalId: string;
  goalRunId: string | null;
  summary: string | null;
  metrics: GoalScoreboardMetric[];
  capturedAt: Date;
  createdAt: Date;
}

export interface ResourceLease {
  id: string;
  companyId: string;
  goalId: string | null;
  goalRunId: string | null;
  issueId: string | null;
  resourceKey: string;
  mode: LeaseMode;
  status: ResourceLeaseStatus;
  reason: string | null;
  acquiredAt: Date;
  expiresAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalRuntime {
  goalId: string;
  brief: GoalBrief | null;
  activeRun: GoalRun | null;
  latestRun: GoalRun | null;
  scoreboard: GoalScoreboard | null;
  runbook: Runbook | null;
  actionableIssueId: string | null;
  humanDecisionRequired: boolean;
  blockedBy: string | null;
  nextWakeTarget: {
    agentId: string | null;
    issueId: string | null;
    goalRunId: string | null;
    goalRunPhase: GoalRunPhase | null;
    reason: string | null;
  } | null;
  activeWorkerIssueCount: number;
  outputsPendingVerification: number;
  verifiedOutputCount: number;
  costs: {
    totalCostCents: number;
    activeRunCostCents: number;
    byPhase: Record<GoalRunPhase, number>;
    costPerVerifiedOutputCents: number | null;
    runCount: number;
    successfulRunCount: number;
    failedRunCount: number;
  };
}

export interface GoalRunWakeResult {
  status: "queued" | "skipped";
  reason?: string | null;
  goalRunId?: string | null;
  goalRunPhase?: GoalRunPhase | null;
  issueId?: string | null;
  agentId?: string | null;
  heartbeatRunId?: string | null;
}

export interface GoalLoopHealthRunSummary {
  goalId: string;
  goalTitle: string;
  goalRunId: string;
  status: GoalRunStatus;
  currentPhase: GoalRunPhase;
  latestIssueId: string | null;
  latestIssueTitle: string | null;
  latestIssueStatus: string | null;
  latestIssueAssigneeAgentId: string | null;
  latestIssueExecutionRunId: string | null;
  blockedBy: string | null;
  nextWakeTargetAgentId: string | null;
}

export interface GoalLoopHealthSummary {
  companyId: string;
  generatedAt: Date;
  activeRunCount: number;
  blockedRunCount: number;
  needsWakeCount: number;
  orphanedRunCount: number;
  genericHeartbeatRunsLastHour: number;
  skippedWakeupsLastHour: number;
  runs: GoalLoopHealthRunSummary[];
}

export interface GoalLoopOutputSummary {
  id: string;
  companyId: string;
  goalId: string;
  goalRunId: string | null;
  issueId: string;
  title: string;
  outputType: GoalOutputType | null;
  outputStatus: OutputStatus | null;
  url: string | null;
  isPrimary: boolean;
  shippedAt: Date | null;
  verifiedAt: Date | null;
}

export interface GoalExecutionIssueOrigin {
  kind: "goal_run_execution";
  goalRunId: string;
  phase: Extract<GoalRunPhase, "direction" | "production">;
}

export interface GoalVerificationIssueOrigin {
  kind: "goal_run_verification";
  goalRunId: string;
  phase: "verification";
}

export interface GoalMeasurementIssueOrigin {
  kind: "goal_run_measurement";
  goalRunId: string;
  phase: "measurement";
}
