import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { documents } from "./documents.js";
import { goals } from "./goals.js";

export const contextPacks = pgTable(
  "context_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyOrderIdx: index("context_packs_company_order_idx").on(table.companyId, table.orderIndex),
    companyKeyUq: uniqueIndex("context_packs_company_key_uq").on(table.companyId, table.key),
    documentUq: uniqueIndex("context_packs_document_uq").on(table.documentId),
  }),
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    source: text("source").notNull().default("company"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("recipes_company_status_idx").on(table.companyId, table.status),
    companySlugUq: uniqueIndex("recipes_company_slug_uq").on(table.companyId, table.slug),
  }),
);

export const recipeVersions = pgTable(
  "recipe_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    definition: jsonb("definition").$type<Record<string, unknown>>().default({}),
    requiredSkillKeys: jsonb("required_skill_keys").$type<string[]>().notNull().default([]),
    outputType: text("output_type").notNull().default("other"),
    createsPrimaryOutput: boolean("creates_primary_output").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyRecipeIdx: index("recipe_versions_company_recipe_idx").on(table.companyId, table.recipeId),
    recipeVersionUq: uniqueIndex("recipe_versions_recipe_version_uq").on(table.recipeId, table.version),
  }),
);

export const goalBriefs = pgTable(
  "goal_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("draft"),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    recipeVersionId: uuid("recipe_version_id").references(() => recipeVersions.id, { onDelete: "set null" }),
    finishLine: text("finish_line"),
    kpiFamily: text("kpi_family"),
    timeframe: text("timeframe"),
    currentStateSummary: text("current_state_summary"),
    finishCriteria: jsonb("finish_criteria").$type<Array<Record<string, unknown>>>().notNull().default([]),
    accessChecklist: jsonb("access_checklist").$type<Array<Record<string, unknown>>>().notNull().default([]),
    launchChecklist: jsonb("launch_checklist").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGoalUq: uniqueIndex("goal_briefs_company_goal_uq").on(table.companyId, table.goalId),
    documentUq: uniqueIndex("goal_briefs_document_uq").on(table.documentId),
    companyUpdatedIdx: index("goal_briefs_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);

export const goalRuns = pgTable(
  "goal_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    recipeVersionId: uuid("recipe_version_id").references(() => recipeVersions.id, { onDelete: "set null" }),
    currentPhase: text("current_phase").notNull().default("direction"),
    status: text("status").notNull().default("queued"),
    latestIssueId: uuid("latest_issue_id"),
    measurementDueAt: timestamp("measurement_due_at", { withTimezone: true }),
    failureSummary: text("failure_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGoalCreatedIdx: index("goal_runs_company_goal_created_idx").on(table.companyId, table.goalId, table.createdAt),
    companyStatusIdx: index("goal_runs_company_status_idx").on(table.companyId, table.status),
  }),
);

export const verificationRuns = pgTable(
  "verification_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    goalRunId: uuid("goal_run_id").notNull().references(() => goalRuns.id, { onDelete: "cascade" }),
    outputId: uuid("output_id").notNull(),
    verdict: text("verdict").notNull().default("pending"),
    summary: text("summary"),
    proofPayload: jsonb("proof_payload").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    goalRunIdx: index("verification_runs_goal_run_idx").on(table.goalRunId, table.createdAt),
    outputIdx: index("verification_runs_output_idx").on(table.outputId, table.createdAt),
  }),
);

export const goalScoreboards = pgTable(
  "goal_scoreboards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    summary: text("summary"),
    metrics: jsonb("metrics").$type<Array<Record<string, unknown>>>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGoalUq: uniqueIndex("goal_scoreboards_company_goal_uq").on(table.companyId, table.goalId),
    companyUpdatedIdx: index("goal_scoreboards_company_updated_idx").on(table.companyId, table.updatedAt),
  }),
);

export const goalScoreboardSnapshots = pgTable(
  "goal_scoreboard_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    goalRunId: uuid("goal_run_id").references(() => goalRuns.id, { onDelete: "set null" }),
    summary: text("summary"),
    metrics: jsonb("metrics").$type<Array<Record<string, unknown>>>().notNull().default([]),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyGoalCapturedIdx: index("goal_scoreboard_snapshots_company_goal_captured_idx").on(
      table.companyId,
      table.goalId,
      table.capturedAt,
    ),
  }),
);

export const runbooks = pgTable(
  "runbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    scopeType: text("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyScopeUpdatedIdx: index("runbooks_company_scope_updated_idx").on(
      table.companyId,
      table.scopeType,
      table.scopeId,
      table.updatedAt,
    ),
    companyScopeOrderUq: uniqueIndex("runbooks_company_scope_order_uq").on(
      table.companyId,
      table.scopeType,
      table.scopeId,
      table.orderIndex,
    ),
    documentUq: uniqueIndex("runbooks_document_uq").on(table.documentId),
  }),
);

export const resourceLeases = pgTable(
  "resource_leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    goalRunId: uuid("goal_run_id").references(() => goalRuns.id, { onDelete: "set null" }),
    issueId: uuid("issue_id"),
    resourceKey: text("resource_key").notNull(),
    mode: text("mode").notNull(),
    status: text("status").notNull().default("active"),
    reason: text("reason"),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyResourceStatusIdx: index("resource_leases_company_resource_status_idx").on(
      table.companyId,
      table.resourceKey,
      table.status,
    ),
    companyGoalRunIdx: index("resource_leases_company_goal_run_idx").on(
      table.companyId,
      table.goalRunId,
      table.updatedAt,
    ),
  }),
);
