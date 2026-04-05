import { z } from "zod";
import {
  AGENT_ROLES,
  GOAL_BRIEF_STATUSES,
  GOAL_OUTPUT_TYPES,
  GOAL_RUN_PHASES,
  GOAL_RUN_STATUSES,
  LEASE_MODES,
  OUTPUT_STATUSES,
  RECIPE_SOURCES,
  RESOURCE_LEASE_STATUSES,
  RUNBOOK_SCOPE_TYPES,
  VERIFICATION_VERDICTS,
} from "../constants.js";

const markdownBodySchema = z.string().trim().max(262_144);
const orderIndexSchema = z.number().int().nonnegative();
const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, - or _");

export const contextPackSectionSchema = z.object({
  key: slugSchema.max(64),
  title: z.string().trim().min(1).max(200),
  body: markdownBodySchema.default(""),
  orderIndex: orderIndexSchema.optional().default(0),
});

export const putContextPackSchema = z.object({
  sections: z.array(contextPackSectionSchema).max(50),
});

export type PutContextPack = z.infer<typeof putContextPackSchema>;

export const runbookEntrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: markdownBodySchema.default(""),
  orderIndex: orderIndexSchema.optional().default(0),
});

export const upsertRunbookSchema = z.object({
  scopeType: z.enum(RUNBOOK_SCOPE_TYPES),
  entries: z.array(runbookEntrySchema).max(100),
});

export type UpsertRunbook = z.infer<typeof upsertRunbookSchema>;

const nullableAgentRoleSchema = z.enum(AGENT_ROLES).nullable();

export const recipeVerificationPolicySchema = z.object({
  primaryOutputRequired: z.boolean().optional().default(true),
  humanReviewOnAmbiguous: z.boolean().optional().default(true),
});

export const recipeDirectorRoutingSchema = z.object({
  preferredRole: nullableAgentRoleSchema.optional().default("ceo"),
});

export const recipeWorkerRoutingSchema = z.object({
  direction: nullableAgentRoleSchema.optional().default("ceo"),
  production: nullableAgentRoleSchema.optional().default(null),
  verification: nullableAgentRoleSchema.optional().default("qa"),
  measurement: nullableAgentRoleSchema.optional().default("ceo"),
});

export const recipeVersionInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  definition: z.record(z.unknown()).optional().nullable(),
  requiredSkillKeys: z.array(slugSchema.max(120)).max(50).optional().default([]),
  outputType: z.enum(GOAL_OUTPUT_TYPES).optional().default("other"),
  createsPrimaryOutput: z.boolean().optional().default(true),
  verificationPolicy: recipeVerificationPolicySchema.optional().default({}),
  measurementCadence: z.enum(["immediate", "manual"]).optional().default("immediate"),
  directorRouting: recipeDirectorRoutingSchema.optional().default({}),
  workerRouting: recipeWorkerRoutingSchema.optional().default({}),
  requiredResources: z.array(z.string().trim().min(1).max(200)).max(25).optional().default([]),
});

export const createRecipeSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  source: z.enum(RECIPE_SOURCES).optional().default("company"),
  initialVersion: recipeVersionInputSchema,
});

export type CreateRecipe = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["active", "archived"]).optional(),
  createVersion: recipeVersionInputSchema.optional(),
});

export type UpdateRecipe = z.infer<typeof updateRecipeSchema>;

export const goalBriefFinishCriterionSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const goalBriefAccessItemSchema = z.object({
  key: slugSchema.max(120),
  label: z.string().trim().min(1).max(200),
  status: z.enum(["pending", "ready", "blocked"]).optional().default("pending"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const putGoalBriefSchema = z.object({
  status: z.enum(GOAL_BRIEF_STATUSES).optional().default("draft"),
  recipeId: z.string().uuid().optional().nullable(),
  recipeVersionId: z.string().uuid().optional().nullable(),
  body: markdownBodySchema.default(""),
  finishLine: z.string().trim().max(500).optional().nullable(),
  kpiFamily: z.string().trim().max(120).optional().nullable(),
  timeframe: z.string().trim().max(120).optional().nullable(),
  currentStateSummary: z.string().trim().max(2000).optional().nullable(),
  finishCriteria: z.array(goalBriefFinishCriterionSchema).max(25).optional().default([]),
  accessChecklist: z.array(goalBriefAccessItemSchema).max(25).optional().default([]),
  launchChecklist: z.array(z.string().trim().min(1).max(500)).max(25).optional().default([]),
});

export type PutGoalBrief = z.infer<typeof putGoalBriefSchema>;

export const executeGoalSchema = z.object({
  recipeVersionId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  force: z.boolean().optional().default(false),
  requestedPhase: z.enum(GOAL_RUN_PHASES).optional().nullable(),
});

export type ExecuteGoal = z.infer<typeof executeGoalSchema>;

export const wakeGoalRunSchema = z.object({
  agentId: z.string().uuid().optional().nullable(),
  forceFreshSession: z.preprocess(
    (value) => (value === null ? undefined : value),
    z.boolean().optional().default(false),
  ),
  routingMode: z.enum(["auto", "goal_loop", "classic"]).optional().default("goal_loop"),
});

export type WakeGoalRun = z.infer<typeof wakeGoalRunSchema>;

export const goalScoreboardMetricSchema = z.object({
  key: slugSchema.max(120),
  label: z.string().trim().min(1).max(200),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  unit: z.string().trim().max(50).optional().nullable(),
  delta: z.number().optional().nullable(),
  observedAt: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const putGoalScoreboardSchema = z.object({
  summary: z.string().trim().max(2000).optional().nullable(),
  metrics: z.array(goalScoreboardMetricSchema).max(50),
});

export type PutGoalScoreboard = z.infer<typeof putGoalScoreboardSchema>;

export const goalRunQuerySchema = z.object({
  phase: z.enum(GOAL_RUN_PHASES).optional(),
  status: z.enum(GOAL_RUN_STATUSES).optional(),
});

export type GoalRunQuery = z.infer<typeof goalRunQuerySchema>;

export const verificationRunQuerySchema = z.object({
  verdict: z.enum(VERIFICATION_VERDICTS).optional(),
  outputStatus: z.enum(OUTPUT_STATUSES).optional(),
});

export type VerificationRunQuery = z.infer<typeof verificationRunQuerySchema>;

export const createVerificationRunSchema = z.object({
  verdict: z.enum(VERIFICATION_VERDICTS),
  summary: z.string().trim().max(2000).optional().nullable(),
  proofPayload: z.record(z.unknown()).optional().nullable(),
});

export type CreateVerificationRun = z.infer<typeof createVerificationRunSchema>;

export const updateVerificationRunSchema = z.object({
  verdict: z.enum(VERIFICATION_VERDICTS).optional(),
  summary: z.string().trim().max(2000).optional().nullable(),
  proofPayload: z.record(z.unknown()).optional().nullable(),
});

export type UpdateVerificationRun = z.infer<typeof updateVerificationRunSchema>;

export const resourceLeaseQuerySchema = z.object({
  goalId: z.string().uuid().optional(),
  goalRunId: z.string().uuid().optional(),
  mode: z.enum(LEASE_MODES).optional(),
  status: z.enum(RESOURCE_LEASE_STATUSES).optional(),
});

export type ResourceLeaseQuery = z.infer<typeof resourceLeaseQuerySchema>;
