import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { workspaceRuntimeServices } from "./workspace_runtime_services.js";
import { goals } from "./goals.js";
import { goalRuns } from "./goal_loop.js";

export const issueWorkProducts = pgTable(
  "issue_work_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    goalRunId: uuid("goal_run_id").references(() => goalRuns.id, { onDelete: "set null" }),
    executionWorkspaceId: uuid("execution_workspace_id")
      .references(() => executionWorkspaces.id, { onDelete: "set null" }),
    runtimeServiceId: uuid("runtime_service_id")
      .references(() => workspaceRuntimeServices.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    url: text("url"),
    status: text("status").notNull(),
    outputType: text("output_type"),
    outputStatus: text("output_status"),
    reviewState: text("review_state").notNull().default("none"),
    isPrimary: boolean("is_primary").notNull().default(false),
    healthStatus: text("health_status").notNull().default("unknown"),
    summary: text("summary"),
    proofUrl: text("proof_url"),
    verificationRunId: uuid("verification_run_id"),
    verificationSummary: text("verification_summary"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdByRunId: uuid("created_by_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIssueTypeIdx: index("issue_work_products_company_issue_type_idx").on(
      table.companyId,
      table.issueId,
      table.type,
    ),
    companyExecutionWorkspaceTypeIdx: index("issue_work_products_company_execution_workspace_type_idx").on(
      table.companyId,
      table.executionWorkspaceId,
      table.type,
    ),
    companyProviderExternalIdIdx: index("issue_work_products_company_provider_external_id_idx").on(
      table.companyId,
      table.provider,
      table.externalId,
    ),
    companyGoalRunIdx: index("issue_work_products_company_goal_run_idx").on(
      table.companyId,
      table.goalRunId,
    ),
    companyUpdatedIdx: index("issue_work_products_company_updated_idx").on(
      table.companyId,
      table.updatedAt,
    ),
  }),
);
