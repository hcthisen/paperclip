import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  agentWakeupRequests,
  costEvents,
  companies,
  contextPacks,
  documentRevisions,
  documents,
  goalBriefs,
  goals,
  goalRuns,
  goalScoreboardSnapshots,
  goalScoreboards,
  heartbeatRuns,
  issueDocuments,
  issueWorkProducts,
  issues,
  recipes,
  recipeVersions,
  resourceLeases,
  runbooks,
  verificationRuns,
} from "@paperclipai/db";
import type {
  AgentRole,
  ContextPack,
  GoalBrief,
  GoalLoopHealthSummary,
  GoalLoopOutputSummary,
  GoalRun,
  GoalRunPhase,
  GoalRuntime,
  GoalScoreboard,
  Recipe,
  RecipeVersion,
  ResourceLease,
  Runbook,
  VerificationRun,
} from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";

type ActorInfo = {
  agentId?: string | null;
  userId?: string | null;
};

const ACTIVE_GOAL_RUN_STATUSES = ["queued", "running", "waiting_measurement", "needs_human_decision"] as const;
const PHASE_ORDER: GoalRunPhase[] = ["direction", "production", "verification", "measurement"];
const ACTIVE_PHASE_ISSUE_STATUSES = ["todo", "in_progress", "blocked"] as const;
const ACTIONABLE_PHASE_ISSUE_STATUSES = ["todo", "in_progress"] as const;
const ISSUE_PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

type DocumentRecord = {
  id: string;
  latestRevisionNumber: number;
};

type GoalLoopWakeTarget = {
  companyId: string;
  goalId: string;
  goalRunId: string;
  goalRunPhase: GoalRunPhase;
  issueId: string | null;
  agentId: string | null;
  reason: "director_phase" | "assigned_issue" | "preferred_worker" | "human_decision";
};

type ResolvedRecipeRuntimePolicy = Pick<
  RecipeVersion,
  "verificationPolicy" | "measurementCadence" | "directorRouting" | "workerRouting" | "requiredResources"
>;

function nextPhaseForRun(input: {
  phase: GoalRunPhase;
  createsPrimaryOutput: boolean;
}): GoalRunPhase | null {
  if (input.phase === "direction") return "production";
  if (input.phase === "production") {
    return input.createsPrimaryOutput ? "verification" : "measurement";
  }
  if (input.phase === "verification") return "measurement";
  return null;
}

function normalizeTimestamp(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function phaseOriginKind(phase: GoalRunPhase) {
  if (phase === "verification") return "goal_run_verification" as const;
  if (phase === "measurement") return "goal_run_measurement" as const;
  return "goal_run_execution" as const;
}

function parseAgentRole(value: unknown): AgentRole | null {
  if (
    value === "ceo"
    || value === "cto"
    || value === "cmo"
    || value === "cfo"
    || value === "engineer"
    || value === "designer"
    || value === "pm"
    || value === "qa"
    || value === "devops"
    || value === "researcher"
    || value === "general"
  ) {
    return value;
  }
  return null;
}

function defaultProductionRoleForOutputType(outputType: RecipeVersion["outputType"]): AgentRole | null {
  if (outputType === "website_page" || outputType === "artifact") return "cto";
  if (outputType === "scheduled_social_post" || outputType === "email" || outputType === "outreach_mutation") {
    return "cmo";
  }
  return "general";
}

function resolveRecipeRuntimePolicy(input: {
  definition: Record<string, unknown> | null;
  createsPrimaryOutput: boolean;
  outputType: RecipeVersion["outputType"];
}): ResolvedRecipeRuntimePolicy {
  const definition = input.definition ?? {};
  const verificationPolicyRaw =
    definition.verificationPolicy && typeof definition.verificationPolicy === "object"
      ? definition.verificationPolicy as Record<string, unknown>
      : {};
  const directorRoutingRaw =
    definition.directorRouting && typeof definition.directorRouting === "object"
      ? definition.directorRouting as Record<string, unknown>
      : {};
  const workerRoutingRaw =
    definition.workerRouting && typeof definition.workerRouting === "object"
      ? definition.workerRouting as Record<string, unknown>
      : {};

  return {
    verificationPolicy: {
      primaryOutputRequired:
        typeof verificationPolicyRaw.primaryOutputRequired === "boolean"
          ? verificationPolicyRaw.primaryOutputRequired
          : input.createsPrimaryOutput,
      humanReviewOnAmbiguous:
        typeof verificationPolicyRaw.humanReviewOnAmbiguous === "boolean"
          ? verificationPolicyRaw.humanReviewOnAmbiguous
          : true,
    },
    measurementCadence:
      definition.measurementCadence === "manual" ? "manual" : "immediate",
    directorRouting: {
      preferredRole: parseAgentRole(directorRoutingRaw.preferredRole) ?? "ceo",
    },
    workerRouting: {
      direction: parseAgentRole(workerRoutingRaw.direction) ?? "ceo",
      production: parseAgentRole(workerRoutingRaw.production) ?? defaultProductionRoleForOutputType(input.outputType),
      verification: parseAgentRole(workerRoutingRaw.verification) ?? "qa",
      measurement: parseAgentRole(workerRoutingRaw.measurement) ?? "ceo",
    },
    requiredResources: asStringArray(definition.requiredResources),
  };
}

function getLatestUpdatedAt<T extends { updatedAt: Date }>(rows: T[]): Date | null {
  return rows.reduce<Date | null>((latest, row) => {
    if (!latest || row.updatedAt > latest) return row.updatedAt;
    return latest;
  }, null);
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object") : [];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toContextPack(
  companyId: string,
  rows: Array<{
    key: string;
    title: string;
    latestBody: string;
    orderIndex: number;
    updatedAt: Date;
  }>,
): ContextPack {
  return {
    companyId,
    sections: rows.map((row) => ({
      key: row.key,
      title: row.title,
      body: row.latestBody,
      orderIndex: row.orderIndex,
    })),
    updatedAt: getLatestUpdatedAt(rows),
  };
}

function toRunbook(
  companyId: string,
  scopeType: "company" | "goal",
  scopeId: string,
  rows: Array<{
    id: string;
    title: string;
    latestBody: string;
    orderIndex: number;
    updatedAt: Date;
  }>,
): Runbook {
  return {
    companyId,
    scopeType,
    scopeId,
    entries: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.latestBody,
      orderIndex: row.orderIndex,
      updatedAt: row.updatedAt,
    })),
    updatedAt: getLatestUpdatedAt(rows),
  };
}

function toRecipeVersion(row: typeof recipeVersions.$inferSelect): RecipeVersion {
  const runtimePolicy = resolveRecipeRuntimePolicy({
    definition: (row.definition as Record<string, unknown> | null) ?? null,
    createsPrimaryOutput: row.createsPrimaryOutput,
    outputType: row.outputType as RecipeVersion["outputType"],
  });
  return {
    id: row.id,
    companyId: row.companyId,
    recipeId: row.recipeId,
    version: row.version,
    title: row.title,
    description: row.description ?? null,
    definition: (row.definition as Record<string, unknown> | null) ?? null,
    requiredSkillKeys: asStringArray(row.requiredSkillKeys),
    outputType: row.outputType as RecipeVersion["outputType"],
    createsPrimaryOutput: row.createsPrimaryOutput,
    verificationPolicy: runtimePolicy.verificationPolicy,
    measurementCadence: runtimePolicy.measurementCadence,
    directorRouting: runtimePolicy.directorRouting,
    workerRouting: runtimePolicy.workerRouting,
    requiredResources: runtimePolicy.requiredResources,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRecipe(row: typeof recipes.$inferSelect, latestVersionId: string | null): Recipe {
  return {
    id: row.id,
    companyId: row.companyId,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    source: row.source as Recipe["source"],
    status: row.status as Recipe["status"],
    latestVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toGoalBrief(row: {
  id: string;
  companyId: string;
  goalId: string;
  status: string;
  recipeId: string | null;
  recipeVersionId: string | null;
  latestBody: string;
  finishLine: string | null;
  kpiFamily: string | null;
  timeframe: string | null;
  currentStateSummary: string | null;
  finishCriteria: unknown;
  accessChecklist: unknown;
  launchChecklist: unknown;
  createdAt: Date;
  updatedAt: Date;
}): GoalBrief {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId,
    status: row.status as GoalBrief["status"],
    recipeId: row.recipeId ?? null,
    recipeVersionId: row.recipeVersionId ?? null,
    body: row.latestBody,
    finishLine: row.finishLine ?? null,
    kpiFamily: row.kpiFamily ?? null,
    timeframe: row.timeframe ?? null,
    currentStateSummary: row.currentStateSummary ?? null,
    finishCriteria: asRecordArray(row.finishCriteria).map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      label: typeof item.label === "string" ? item.label : "",
      description: typeof item.description === "string" ? item.description : null,
    })),
    accessChecklist: asRecordArray(row.accessChecklist).map((item) => ({
      key: typeof item.key === "string" ? item.key : "",
      label: typeof item.label === "string" ? item.label : "",
      status:
        item.status === "ready" || item.status === "blocked" || item.status === "pending"
          ? item.status
          : "pending",
      notes: typeof item.notes === "string" ? item.notes : null,
    })),
    launchChecklist: asStringArray(row.launchChecklist),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toGoalRun(row: typeof goalRuns.$inferSelect): GoalRun {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId,
    recipeVersionId: row.recipeVersionId ?? null,
    currentPhase: row.currentPhase as GoalRun["currentPhase"],
    status: row.status as GoalRun["status"],
    latestIssueId: row.latestIssueId ?? null,
    measurementDueAt: row.measurementDueAt ?? null,
    failureSummary: row.failureSummary ?? null,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toGoalScoreboard(row: typeof goalScoreboards.$inferSelect): GoalScoreboard {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId,
    summary: row.summary ?? null,
    metrics: asRecordArray(row.metrics).map((item) => ({
      key: typeof item.key === "string" ? item.key : "",
      label: typeof item.label === "string" ? item.label : "",
      value:
        typeof item.value === "string"
        || typeof item.value === "number"
        || typeof item.value === "boolean"
        || item.value === null
          ? item.value
          : null,
      unit: typeof item.unit === "string" ? item.unit : null,
      delta: typeof item.delta === "number" ? item.delta : null,
      observedAt: typeof item.observedAt === "string" ? new Date(item.observedAt) : null,
      notes: typeof item.notes === "string" ? item.notes : null,
      metadata: item.metadata && typeof item.metadata === "object" ? item.metadata as Record<string, unknown> : null,
    })),
    updatedAt: row.updatedAt,
  };
}

function toVerificationRun(row: typeof verificationRuns.$inferSelect): VerificationRun {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId,
    goalRunId: row.goalRunId,
    outputId: row.outputId,
    verdict: row.verdict as VerificationRun["verdict"],
    summary: row.summary ?? null,
    proofPayload: (row.proofPayload as Record<string, unknown> | null) ?? null,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toResourceLease(row: typeof resourceLeases.$inferSelect): ResourceLease {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId ?? null,
    goalRunId: row.goalRunId ?? null,
    issueId: row.issueId ?? null,
    resourceKey: row.resourceKey,
    mode: row.mode as ResourceLease["mode"],
    status: row.status as ResourceLease["status"],
    reason: row.reason ?? null,
    acquiredAt: row.acquiredAt,
    expiresAt: row.expiresAt ?? null,
    releasedAt: row.releasedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toOutputSummary(row: typeof issueWorkProducts.$inferSelect): GoalLoopOutputSummary {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId ?? "",
    goalRunId: row.goalRunId ?? null,
    issueId: row.issueId,
    title: row.title,
    outputType: row.outputType as GoalLoopOutputSummary["outputType"],
    outputStatus: row.outputStatus as GoalLoopOutputSummary["outputStatus"],
    url: row.url ?? null,
    isPrimary: row.isPrimary,
    shippedAt: row.shippedAt ?? null,
    verifiedAt: row.verifiedAt ?? null,
  };
}

async function writeDocument(
  tx: Pick<Db, "select" | "insert" | "update">,
  input: {
    companyId: string;
    documentId?: string | null;
    title: string | null;
    body: string;
    actor: ActorInfo;
  },
): Promise<DocumentRecord> {
  const now = new Date();
  if (input.documentId) {
    const existing = await tx
      .select({
        id: documents.id,
        latestRevisionNumber: documents.latestRevisionNumber,
      })
      .from(documents)
      .where(eq(documents.id, input.documentId))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Document not found");

    const nextRevisionNumber = existing.latestRevisionNumber + 1;
    const [revision] = await tx
      .insert(documentRevisions)
      .values({
        companyId: input.companyId,
        documentId: existing.id,
        revisionNumber: nextRevisionNumber,
        title: input.title,
        format: "markdown",
        body: input.body,
        changeSummary: null,
        createdByAgentId: input.actor.agentId ?? null,
        createdByUserId: input.actor.userId ?? null,
        createdAt: now,
      })
      .returning();

    await tx
      .update(documents)
      .set({
        title: input.title,
        latestBody: input.body,
        latestRevisionId: revision.id,
        latestRevisionNumber: nextRevisionNumber,
        updatedByAgentId: input.actor.agentId ?? null,
        updatedByUserId: input.actor.userId ?? null,
        updatedAt: now,
      })
      .where(eq(documents.id, existing.id));

    return { id: existing.id, latestRevisionNumber: nextRevisionNumber };
  }

  const [document] = await tx
    .insert(documents)
    .values({
      companyId: input.companyId,
      title: input.title,
      format: "markdown",
      latestBody: input.body,
      latestRevisionId: null,
      latestRevisionNumber: 1,
      createdByAgentId: input.actor.agentId ?? null,
      createdByUserId: input.actor.userId ?? null,
      updatedByAgentId: input.actor.agentId ?? null,
      updatedByUserId: input.actor.userId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [revision] = await tx
    .insert(documentRevisions)
    .values({
      companyId: input.companyId,
      documentId: document.id,
      revisionNumber: 1,
      title: input.title,
      format: "markdown",
      body: input.body,
      changeSummary: null,
      createdByAgentId: input.actor.agentId ?? null,
      createdByUserId: input.actor.userId ?? null,
      createdAt: now,
    })
    .returning();

  await tx
    .update(documents)
    .set({ latestRevisionId: revision.id })
    .where(eq(documents.id, document.id));

  return { id: document.id, latestRevisionNumber: 1 };
}

function buildRecipeVersionDefinition(input: {
  definition?: Record<string, unknown> | null;
  outputType: RecipeVersion["outputType"];
  createsPrimaryOutput: boolean;
  verificationPolicy?: RecipeVersion["verificationPolicy"];
  measurementCadence?: RecipeVersion["measurementCadence"];
  directorRouting?: RecipeVersion["directorRouting"];
  workerRouting?: RecipeVersion["workerRouting"];
  requiredResources?: string[];
}) {
  const baseDefinition = { ...(input.definition ?? {}) };
  baseDefinition.verificationPolicy = {
    primaryOutputRequired: input.verificationPolicy?.primaryOutputRequired ?? input.createsPrimaryOutput,
    humanReviewOnAmbiguous: input.verificationPolicy?.humanReviewOnAmbiguous ?? true,
  };
  baseDefinition.measurementCadence = input.measurementCadence ?? "immediate";
  baseDefinition.directorRouting = {
    preferredRole: input.directorRouting?.preferredRole ?? "ceo",
  };
  baseDefinition.workerRouting = {
    direction: input.workerRouting?.direction ?? "ceo",
    production: input.workerRouting?.production ?? defaultProductionRoleForOutputType(input.outputType),
    verification: input.workerRouting?.verification ?? "qa",
    measurement: input.workerRouting?.measurement ?? "ceo",
  };
  baseDefinition.requiredResources = input.requiredResources ?? [];
  return baseDefinition;
}

export function goalLoopService(db: Db) {
  const issueSvc = issueService(db);

  async function ensureCompany(companyId: string) {
    const company = await db
      .select({ id: companies.id, defaultGoalMode: companies.defaultGoalMode })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!company) throw notFound("Company not found");
    return company;
  }

  async function ensureGoal(goalId: string) {
    const goal = await db
      .select({
        id: goals.id,
        companyId: goals.companyId,
        title: goals.title,
        description: goals.description,
        mode: goals.mode,
      })
      .from(goals)
      .where(eq(goals.id, goalId))
      .then((rows) => rows[0] ?? null);
    if (!goal) throw notFound("Goal not found");
    return goal;
  }

  async function ensureSystemRecipes(companyId: string) {
    const existing = await db
      .select({
        id: recipes.id,
        slug: recipes.slug,
      })
      .from(recipes)
      .where(and(eq(recipes.companyId, companyId), eq(recipes.source, "system")));
    const existingSlugs = new Set(existing.map((row) => row.slug));
    const now = new Date();
    const seeds = [
      {
        slug: "social_growth",
        name: "Social Growth",
        description: "Produce and verify social posts tied to an explicit goal loop.",
        versionTitle: "social_growth@v1",
        versionDescription: "Direction, content production, verification, and measurement for social growth loops.",
        outputType: "scheduled_social_post",
      },
      {
        slug: "website_repair",
        name: "Website Repair",
        description: "Drive a website fix from diagnosis through verification and measurement.",
        versionTitle: "website_repair@v1",
        versionDescription: "Direction, production, verification, and measurement for website repair work.",
        outputType: "website_page",
      },
      {
        slug: "supplier_outreach",
        name: "Supplier Outreach",
        description: "Run supplier outreach with tracked proof and verification.",
        versionTitle: "supplier_outreach@v1",
        versionDescription: "Direction, production, verification, and measurement for supplier outreach loops.",
        outputType: "email",
      },
    ] as const;

    for (const seed of seeds) {
      if (existingSlugs.has(seed.slug)) continue;
      const [recipe] = await db
        .insert(recipes)
        .values({
          companyId,
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          source: "system",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await db.insert(recipeVersions).values({
        companyId,
        recipeId: recipe.id,
        version: 1,
        title: seed.versionTitle,
        description: seed.versionDescription,
        definition: buildRecipeVersionDefinition({
          definition: {
            phaseOrder: PHASE_ORDER,
            leasePolicy: "goal_serialized",
          },
          outputType: seed.outputType,
          createsPrimaryOutput: true,
          workerRouting: {
            direction: "ceo",
            production: seed.outputType === "website_page" ? "cto" : "cmo",
            verification: "qa",
            measurement: "ceo",
          },
        }),
        requiredSkillKeys: [],
        outputType: seed.outputType,
        createsPrimaryOutput: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async function getGoalRunById(goalRunId: string, database: Pick<Db, "select"> = db) {
    const row = await database
      .select()
      .from(goalRuns)
      .where(eq(goalRuns.id, goalRunId))
      .then((rows) => rows[0] ?? null);
    return row;
  }

  async function getLatestActiveGoalRun(goalId: string, database: Pick<Db, "select"> = db) {
    return database
      .select()
      .from(goalRuns)
      .where(and(eq(goalRuns.goalId, goalId), inArray(goalRuns.status, [...ACTIVE_GOAL_RUN_STATUSES])))
      .orderBy(desc(goalRuns.createdAt))
      .then((rows) => rows[0] ?? null);
  }

  async function getRecipeVersionForRun(recipeVersionId: string | null, database: Pick<Db, "select"> = db) {
    if (!recipeVersionId) return null;
    return database
      .select()
      .from(recipeVersions)
      .where(eq(recipeVersions.id, recipeVersionId))
      .then((rows) => rows[0] ?? null);
  }

  async function getGoalLoopIssue(issueId: string, database: Pick<Db, "select"> = db) {
    return database
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
  }

  async function getGoalRunPhaseIssue(goalRunId: string, database: Pick<Db, "select"> = db) {
    const run = await getGoalRunById(goalRunId, database);
    if (!run?.latestIssueId) return null;
    return getGoalLoopIssue(run.latestIssueId, database);
  }

  async function listGoalRunChildIssues(parentIssueId: string, database: Pick<Db, "select"> = db) {
    return database
      .select({
        id: issues.id,
        status: issues.status,
        assigneeAgentId: issues.assigneeAgentId,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .where(eq(issues.parentId, parentIssueId))
      .orderBy(asc(issues.createdAt));
  }

  async function listIssueDocumentKeys(issueId: string, database: Pick<Db, "select"> = db) {
    return database
      .select({ key: issueDocuments.key })
      .from(issueDocuments)
      .where(eq(issueDocuments.issueId, issueId));
  }

  async function findAgentByRole(
    companyId: string,
    roles: AgentRole[],
    database: Pick<Db, "select"> = db,
  ) {
    if (roles.length === 0) return null;
    const rows = await database
      .select({
        id: agents.id,
        role: agents.role,
        status: agents.status,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), inArray(agents.role, roles)))
      .orderBy(asc(agents.createdAt));
    return rows.find((row) => row.status !== "terminated") ?? null;
  }

  async function resolvePreferredAgentForPhase(input: {
    companyId: string;
    phase: GoalRunPhase;
    recipeVersion: typeof recipeVersions.$inferSelect | null;
    preferredAgentId?: string | null;
    database?: Pick<Db, "select">;
  }) {
    const database = input.database ?? db;
    if (input.preferredAgentId) {
      const agent = await database
        .select({
          id: agents.id,
          companyId: agents.companyId,
          role: agents.role,
          status: agents.status,
        })
        .from(agents)
        .where(eq(agents.id, input.preferredAgentId))
        .then((rows) => rows[0] ?? null);
      if (agent?.companyId === input.companyId && agent.status !== "terminated") {
        return agent.id;
      }
    }

    const recipe = input.recipeVersion ? toRecipeVersion(input.recipeVersion) : null;
    const preferredRole =
      input.phase === "direction" || input.phase === "measurement"
        ? recipe?.directorRouting.preferredRole ?? recipe?.workerRouting[input.phase] ?? "ceo"
        : recipe?.workerRouting[input.phase] ?? null;
    if (!preferredRole) return null;
    const agent = await findAgentByRole(input.companyId, [preferredRole], database);
    return agent?.id ?? null;
  }

  async function getPrimaryOutputsForRun(goalRunId: string, database: Pick<Db, "select"> = db) {
    return database
      .select()
      .from(issueWorkProducts)
      .where(and(eq(issueWorkProducts.goalRunId, goalRunId), eq(issueWorkProducts.isPrimary, true)))
      .orderBy(desc(issueWorkProducts.updatedAt), desc(issueWorkProducts.createdAt));
  }

  async function hasScoreboardSnapshotForRun(goalId: string, goalRunId: string, database: Pick<Db, "select"> = db) {
    const snapshot = await database
      .select({ id: goalScoreboardSnapshots.id })
      .from(goalScoreboardSnapshots)
      .where(and(eq(goalScoreboardSnapshots.goalId, goalId), eq(goalScoreboardSnapshots.goalRunId, goalRunId)))
      .then((rows) => rows[0] ?? null);
    return Boolean(snapshot);
  }

  async function ensureScoreboardSnapshot(goalId: string, goalRunId: string, database: Db = db) {
    const existing = await hasScoreboardSnapshotForRun(goalId, goalRunId, database);
    if (existing) return;
    const scoreboard = await database
      .select()
      .from(goalScoreboards)
      .where(eq(goalScoreboards.goalId, goalId))
      .then((rows) => rows[0] ?? null);
    if (!scoreboard) return;
    await database.insert(goalScoreboardSnapshots).values({
      companyId: scoreboard.companyId,
      goalId,
      goalRunId,
      summary: scoreboard.summary,
      metrics: scoreboard.metrics,
      capturedAt: new Date(),
      createdAt: new Date(),
    });
  }

  async function resolveMeasurementReadiness(goalId: string, goalRunId: string, startedAt: Date | null) {
    const [scoreboard, runbookUpdatedAt] = await Promise.all([
      db
        .select({
          updatedAt: goalScoreboards.updatedAt,
        })
        .from(goalScoreboards)
        .where(eq(goalScoreboards.goalId, goalId))
        .then((rows) => rows[0] ?? null),
      db
        .select({
          updatedAt: sql<Date | null>`max(${runbooks.updatedAt})`.as("updatedAt"),
        })
        .from(runbooks)
        .where(and(eq(runbooks.scopeType, "goal"), eq(runbooks.scopeId, goalId)))
        .then((rows) => rows[0]?.updatedAt ?? null),
    ]);

    const threshold = startedAt ?? new Date(0);
    const scoreboardUpdatedAt = normalizeTimestamp(scoreboard?.updatedAt ?? null);
    const runbookUpdatedAtDate = normalizeTimestamp(runbookUpdatedAt);
    return {
      scoreboardReady: Boolean(scoreboardUpdatedAt && scoreboardUpdatedAt >= threshold),
      runbookReady: Boolean(runbookUpdatedAtDate && runbookUpdatedAtDate >= threshold),
      scoreboardSnapshotted: await hasScoreboardSnapshotForRun(goalId, goalRunId),
    };
  }

  async function resolveGoalRunWakeTarget(
    goalRunId: string,
    options?: { preferredAgentId?: string | null; database?: Pick<Db, "select"> },
  ): Promise<GoalLoopWakeTarget | null> {
    const database = options?.database ?? db;
    const run = await getGoalRunById(goalRunId, database);
    if (!run) return null;
    const goal = await ensureGoal(run.goalId);
    const phaseIssue = await getGoalRunPhaseIssue(goalRunId, database);
    if (!phaseIssue || !phaseIssue.goalRunPhase) return null;
    const recipeVersion = await getRecipeVersionForRun(run.recipeVersionId, database);
    const directorAgentId = await resolvePreferredAgentForPhase({
      companyId: goal.companyId,
      phase: "direction",
      recipeVersion,
      preferredAgentId: null,
      database,
    });

    const inferredAgentId = await resolvePreferredAgentForPhase({
      companyId: goal.companyId,
      phase: phaseIssue.goalRunPhase as GoalRunPhase,
      recipeVersion,
      preferredAgentId: options?.preferredAgentId ?? null,
      database,
    });

    const humanDecisionRequired = run.status === "needs_human_decision" || phaseIssue.status === "blocked";
    const agentId = humanDecisionRequired
      ? directorAgentId ?? phaseIssue.assigneeAgentId ?? inferredAgentId
      : phaseIssue.assigneeAgentId ?? inferredAgentId;
    const reason =
      humanDecisionRequired
        ? "human_decision"
        : phaseIssue.goalRunPhase === "direction" || phaseIssue.goalRunPhase === "measurement"
          ? "director_phase"
          : phaseIssue.assigneeAgentId
            ? "assigned_issue"
            : "preferred_worker";

    return {
      companyId: goal.companyId,
      goalId: goal.id,
      goalRunId: run.id,
      goalRunPhase: phaseIssue.goalRunPhase as GoalRunPhase,
      issueId: phaseIssue.id,
      agentId,
      reason,
    };
  }

  async function resolveGoalLoopWakeTargetForAgent(
    agentId: string,
    options?: { database?: Pick<Db, "select"> },
  ): Promise<GoalLoopWakeTarget | null> {
    const database = options?.database ?? db;
    const agent = await database
      .select({
        id: agents.id,
        companyId: agents.companyId,
        role: agents.role,
        status: agents.status,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .then((rows) => rows[0] ?? null);
    if (!agent || agent.status === "terminated") return null;
    const company = await ensureCompany(agent.companyId);
    if (company.defaultGoalMode !== "goal_loop") return null;

    const assignedIssue = await database
      .select({
        id: issues.id,
        goalId: issues.goalId,
        goalRunId: issues.goalRunId,
        goalRunPhase: issues.goalRunPhase,
        status: issues.status,
        priority: issues.priority,
        createdAt: issues.createdAt,
      })
      .from(issues)
      .innerJoin(goals, eq(goals.id, issues.goalId))
      .where(
        and(
          eq(issues.companyId, agent.companyId),
          eq(issues.assigneeAgentId, agent.id),
          inArray(issues.status, [...ACTIONABLE_PHASE_ISSUE_STATUSES]),
          eq(goals.mode, "goal_loop"),
        ),
      )
      .orderBy(
        sql`case when ${issues.status} = 'in_progress' then 0 when ${issues.status} = 'todo' then 1 else 2 end`,
        sql`case ${issues.priority}
              when 'critical' then 0
              when 'high' then 1
              when 'medium' then 2
              else 3
            end`,
        asc(issues.createdAt),
      )
      .then((rows) => rows[0] ?? null);
    if (assignedIssue?.goalId && assignedIssue.goalRunId && assignedIssue.goalRunPhase) {
      return {
        companyId: agent.companyId,
        goalId: assignedIssue.goalId,
        goalRunId: assignedIssue.goalRunId,
        goalRunPhase: assignedIssue.goalRunPhase as GoalRunPhase,
        issueId: assignedIssue.id,
        agentId: agent.id,
        reason: "assigned_issue",
      };
    }

    const activeRuns = await database
      .select({
        id: goalRuns.id,
        goalId: goalRuns.goalId,
        currentPhase: goalRuns.currentPhase,
        status: goalRuns.status,
        createdAt: goalRuns.createdAt,
      })
      .from(goalRuns)
      .innerJoin(goals, eq(goals.id, goalRuns.goalId))
      .where(and(eq(goalRuns.companyId, agent.companyId), inArray(goalRuns.status, [...ACTIVE_GOAL_RUN_STATUSES]), eq(goals.mode, "goal_loop")))
      .orderBy(
        sql`case when ${goalRuns.status} = 'needs_human_decision' then 0 when ${goalRuns.currentPhase} = 'direction' then 1 when ${goalRuns.currentPhase} = 'measurement' then 2 else 3 end`,
        desc(goalRuns.createdAt),
      );

    for (const run of activeRuns) {
      const target = await resolveGoalRunWakeTarget(run.id, {
        preferredAgentId: agent.id,
        database,
      });
      if (!target) continue;
      if (target.agentId === agent.id) return target;
    }

    return null;
  }

  async function completeGoalRunPhase(
    run: typeof goalRuns.$inferSelect,
    issue: typeof issues.$inferSelect,
    actor: ActorInfo,
  ) {
    const recipeVersion = await getRecipeVersionForRun(run.recipeVersionId);
    const now = new Date();
    if (issue.status !== "done") {
      await db
        .update(issues)
        .set({
          status: "done",
          completedAt: issue.completedAt ?? now,
          updatedAt: now,
        })
        .where(eq(issues.id, issue.id));
    }

    if (issue.goalRunPhase === "measurement") {
      await ensureScoreboardSnapshot(run.goalId, run.id);
      await releasePhaseLeases(run.goalId, run.id, issue.goalRunPhase as GoalRunPhase);
      const [updated] = await db
        .update(goalRuns)
        .set({
          status: "succeeded",
          failureSummary: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(goalRuns.id, run.id))
        .returning();
      await resumeQueuedGoalRunsForGoal(run.goalId, actor);
      return {
        run: toGoalRun(updated),
        nextIssue: null,
      };
    }

    const nextPhase = nextPhaseForRun({
      phase: issue.goalRunPhase as GoalRunPhase,
      createsPrimaryOutput: recipeVersion?.createsPrimaryOutput ?? false,
    });
    await releasePhaseLeases(run.goalId, run.id, issue.goalRunPhase as GoalRunPhase);
    if (!nextPhase) {
      const [updated] = await db
        .update(goalRuns)
        .set({
          status: "succeeded",
          failureSummary: null,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(goalRuns.id, run.id))
        .returning();
      await resumeQueuedGoalRunsForGoal(run.goalId, actor);
      return {
        run: toGoalRun(updated),
        nextIssue: null,
      };
    }

    const started = await startGoalRunPhase({
      goalRunId: run.id,
      phase: nextPhase,
      actor,
    });
    await resumeQueuedGoalRunsForGoal(run.goalId, actor);
    return {
      run: started.run,
      nextIssue: started.issue,
    };
  }

  async function releasePhaseLeases(goalId: string, goalRunId: string, phase: GoalRunPhase, database: Db = db) {
    const resourceKeyPrefix = `goal:${goalId}:${phase}:`;
    await database
      .update(resourceLeases)
      .set({
        status: "released",
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(resourceLeases.goalRunId, goalRunId),
          eq(resourceLeases.status, "active"),
          sql`${resourceLeases.resourceKey} like ${`${resourceKeyPrefix}%`}`,
        ),
      );
  }

  async function acquirePhaseLease(input: {
    companyId: string;
    goalId: string;
    goalRunId: string;
    phase: GoalRunPhase;
    issueId: string | null;
    database?: Db;
  }) {
    const database = input.database ?? db;
    const leaseMode = input.phase === "direction" || input.phase === "measurement" ? "shared_read" : "exclusive_write";
    const resourceKey = `goal:${input.goalId}:${input.phase}:primary`;
    const conflicting = await database
      .select()
      .from(resourceLeases)
      .where(
        and(
          eq(resourceLeases.companyId, input.companyId),
          eq(resourceLeases.resourceKey, resourceKey),
          eq(resourceLeases.status, "active"),
          ne(resourceLeases.goalRunId, input.goalRunId),
        ),
      );

    const hasConflict = conflicting.some((lease) =>
      leaseMode === "exclusive_write" || lease.mode === "exclusive_write");
    if (hasConflict) {
      return {
        acquired: false as const,
        resourceKey,
        mode: leaseMode,
        conflictingRunId: conflicting[0]?.goalRunId ?? null,
      };
    }

    const existing = await database
      .select()
      .from(resourceLeases)
      .where(
        and(
          eq(resourceLeases.companyId, input.companyId),
          eq(resourceLeases.goalRunId, input.goalRunId),
          eq(resourceLeases.resourceKey, resourceKey),
          eq(resourceLeases.status, "active"),
        ),
      )
      .then((rows) => rows[0] ?? null);
    if (!existing) {
      await database.insert(resourceLeases).values({
        companyId: input.companyId,
        goalId: input.goalId,
        goalRunId: input.goalRunId,
        issueId: input.issueId,
        resourceKey,
        mode: leaseMode,
        status: "active",
        reason: `phase:${input.phase}`,
        acquiredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      acquired: true as const,
      resourceKey,
      mode: leaseMode,
      conflictingRunId: null,
    };
  }

  async function createIssueForRunPhase(input: {
    companyId: string;
    goalId: string;
    goalTitle: string;
    goalDescription: string | null;
    goalRunId: string;
    phase: GoalRunPhase;
    recipeVersion: typeof recipeVersions.$inferSelect | null;
    briefBody: string | null;
    actor: ActorInfo;
  }) {
    const assigneeAgentId = await resolvePreferredAgentForPhase({
      companyId: input.companyId,
      phase: input.phase,
      recipeVersion: input.recipeVersion,
    });
    return issueSvc.create(input.companyId, {
      title: `${input.phase.replaceAll("_", " ")}: ${input.goalTitle}`,
      description: input.briefBody ?? input.goalDescription ?? null,
      status: "todo",
      priority: "medium",
      assigneeAgentId,
      goalId: input.goalId,
      goalRunId: input.goalRunId,
      goalRunPhase: input.phase,
      originKind: phaseOriginKind(input.phase),
      originId: input.goalRunId,
      originRunId: input.goalRunId,
      requestDepth: 0,
      createdByAgentId: input.actor.agentId ?? null,
      createdByUserId: input.actor.userId ?? null,
    });
  }

  async function startGoalRunPhase(input: {
    goalRunId: string;
    phase: GoalRunPhase;
    actor: ActorInfo;
    database?: Db;
  }) {
    const database = input.database ?? db;
    const run = await getGoalRunById(input.goalRunId, database);
    if (!run) throw notFound("Goal run not found");
    const goal = await ensureGoal(run.goalId);
    const recipeVersion = await getRecipeVersionForRun(run.recipeVersionId, database);
    const brief = await database
      .select({
        body: documents.latestBody,
      })
      .from(goalBriefs)
      .innerJoin(documents, eq(goalBriefs.documentId, documents.id))
      .where(eq(goalBriefs.goalId, goal.id))
      .then((rows) => rows[0] ?? null);

    const lease = await acquirePhaseLease({
      companyId: goal.companyId,
      goalId: goal.id,
      goalRunId: run.id,
      phase: input.phase,
      issueId: null,
      database,
    });

    if (!lease.acquired) {
      const [queuedRun] = await database
        .update(goalRuns)
        .set({
          currentPhase: input.phase,
          latestIssueId: null,
          status: "queued",
          failureSummary: `Waiting for resource lease on ${lease.resourceKey}`,
          updatedAt: new Date(),
        })
        .where(eq(goalRuns.id, run.id))
        .returning();
      return {
        run: toGoalRun(queuedRun),
        issue: null,
      };
    }

    const issue = await createIssueForRunPhase({
      companyId: goal.companyId,
      goalId: goal.id,
      goalTitle: goal.title,
      goalDescription: goal.description ?? null,
      goalRunId: run.id,
      phase: input.phase,
      recipeVersion,
      briefBody: brief?.body ?? null,
      actor: input.actor,
    });

    await database
      .update(resourceLeases)
      .set({
        issueId: issue.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(resourceLeases.goalRunId, run.id),
          eq(resourceLeases.resourceKey, lease.resourceKey),
          eq(resourceLeases.status, "active"),
        ),
      );

    const [runningRun] = await database
      .update(goalRuns)
      .set({
        currentPhase: input.phase,
        latestIssueId: issue.id,
        status: input.phase === "measurement" ? "waiting_measurement" : "running",
        failureSummary: null,
        startedAt: run.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(goalRuns.id, run.id))
      .returning();

    return {
      run: toGoalRun(runningRun),
      issue,
    };
  }

  async function resumeQueuedGoalRunsForGoal(goalId: string, actor: ActorInfo = {}) {
    const queuedRuns = await db
      .select()
      .from(goalRuns)
      .where(and(eq(goalRuns.goalId, goalId), eq(goalRuns.status, "queued")))
      .orderBy(asc(goalRuns.createdAt));
    const resumed: Array<{ run: GoalRun; issueId: string | null }> = [];
    for (const queuedRun of queuedRuns) {
      const started = await startGoalRunPhase({
        goalRunId: queuedRun.id,
        phase: queuedRun.currentPhase as GoalRunPhase,
        actor,
      });
      resumed.push({
        run: started.run,
        issueId: started.issue?.id ?? null,
      });
      if (!started.issue) break;
    }
    return resumed;
  }

  async function validateGoalRunIssueStatusChange(issueId: string, nextStatus: string) {
    if (nextStatus !== "done") return;
    const issue = await getGoalLoopIssue(issueId);
    if (!issue?.goalRunId || !issue.goalRunPhase) return;

    const run = await getGoalRunById(issue.goalRunId);
    if (!run) return;
    const recipeVersion = await getRecipeVersionForRun(run.recipeVersionId);
    const primaryOutputs = await getPrimaryOutputsForRun(run.id);
    const hasVerifiedPrimary = primaryOutputs.some((output) => output.outputStatus === "verified");

    if (issue.goalRunPhase === "verification" && !hasVerifiedPrimary) {
      throw unprocessable("Verification phase cannot complete until a primary output is verified");
    }

    if (issue.goalRunPhase === "measurement" && recipeVersion?.createsPrimaryOutput) {
      if (!hasVerifiedPrimary) {
        throw unprocessable("Measurement phase cannot complete until a primary output is verified");
      }
      const readiness = await resolveMeasurementReadiness(run.goalId, run.id, run.startedAt ?? null);
      if (!readiness.scoreboardReady) {
        throw unprocessable("Measurement phase requires the goal scoreboard to be updated after the run started");
      }
      if (!readiness.runbookReady) {
        throw unprocessable("Measurement phase requires a goal runbook update after the run started");
      }
    }
  }

  async function syncGoalRunForIssue(issueId: string, actor: ActorInfo = {}) {
    const issue = await getGoalLoopIssue(issueId);
    if (!issue?.goalRunId || !issue.goalRunPhase) {
      return null;
    }

    const run = await getGoalRunById(issue.goalRunId);
    if (!run) return null;
    const recipeVersion = await getRecipeVersionForRun(run.recipeVersionId);
    const recipe = recipeVersion ? toRecipeVersion(recipeVersion) : null;
    const primaryOutputs = await getPrimaryOutputsForRun(run.id);
    const hasVerifiedPrimary = primaryOutputs.some((output) => output.outputStatus === "verified");
    const shippedPrimary = primaryOutputs.find((output) =>
      output.outputStatus === "verified"
      || output.outputStatus === "shipped_pending_verification"
      || output.outputStatus === "needs_human_verification"
      || output.outputStatus === "verification_failed");

    if (issue.status === "blocked") {
      const [updated] = await db
        .update(goalRuns)
        .set({
          status: "needs_human_decision",
          failureSummary: `Phase "${issue.goalRunPhase}" is blocked`,
          updatedAt: new Date(),
        })
        .where(eq(goalRuns.id, run.id))
        .returning();
      return {
        run: toGoalRun(updated),
        nextIssue: null,
      };
    }

    if (issue.status === "cancelled") {
      await releasePhaseLeases(run.goalId, run.id, issue.goalRunPhase as GoalRunPhase);
      const [updated] = await db
        .update(goalRuns)
        .set({
          status: "cancelled",
          failureSummary: `Phase "${issue.goalRunPhase}" was cancelled`,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(goalRuns.id, run.id))
        .returning();
      await resumeQueuedGoalRunsForGoal(run.goalId, actor);
      return {
        run: toGoalRun(updated),
        nextIssue: null,
      };
    }

    const issueDocumentKeys = await listIssueDocumentKeys(issue.id);
    const childIssues = await listGoalRunChildIssues(issue.id);
    const hasDirectionArtifact = issueDocumentKeys.length > 0 || childIssues.length > 0;
    const productionReady =
      issue.goalRunPhase === "production"
        && (
          issue.status === "done"
          || (recipe?.createsPrimaryOutput
            ? Boolean(shippedPrimary && (shippedPrimary.url || shippedPrimary.proofUrl || shippedPrimary.shippedAt))
            : childIssues.some((child) => child.status === "done"))
        );
    const latestVerification = primaryOutputs.length === 0
      ? null
      : await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.goalRunId, run.id))
        .orderBy(desc(verificationRuns.createdAt))
        .then((rows) => rows[0] ?? null);
    const measurementReadiness = issue.goalRunPhase === "measurement"
      ? await resolveMeasurementReadiness(run.goalId, run.id, run.startedAt ?? null)
      : null;

    if (issue.goalRunPhase === "verification" && latestVerification) {
      const verdict = latestVerification.verdict as VerificationRun["verdict"];
      if (verdict === "failed" || verdict === "retryable") {
        await releasePhaseLeases(run.goalId, run.id, issue.goalRunPhase as GoalRunPhase);
        const [updated] = await db
          .update(goalRuns)
          .set({
            status: "failed",
            failureSummary: latestVerification.summary ?? "Verification failed",
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(goalRuns.id, run.id))
          .returning();
        return {
          run: toGoalRun(updated),
          nextIssue: null,
        };
      }
      if (
        verdict === "needs_human_decision"
        || verdict === "ambiguous_result"
        || verdict === "blocked_missing_access"
      ) {
        const [updated] = await db
          .update(goalRuns)
          .set({
            status: "needs_human_decision",
            failureSummary: latestVerification.summary ?? "Verification requires human review",
            updatedAt: new Date(),
          })
          .where(eq(goalRuns.id, run.id))
          .returning();
        if (issue.status !== "blocked") {
          await db
            .update(issues)
            .set({
              status: "blocked",
              updatedAt: new Date(),
            })
            .where(eq(issues.id, issue.id));
        }
        return {
          run: toGoalRun(updated),
          nextIssue: null,
        };
      }
    }

    const phaseCompleted =
      issue.status === "done"
      || (issue.goalRunPhase === "direction" && hasDirectionArtifact)
      || productionReady
      || (issue.goalRunPhase === "verification" && hasVerifiedPrimary)
      || (
        issue.goalRunPhase === "measurement"
        && (
          (!recipe?.verificationPolicy.primaryOutputRequired || hasVerifiedPrimary)
          && Boolean(measurementReadiness?.scoreboardReady)
          && Boolean(measurementReadiness?.runbookReady)
          && (recipe?.measurementCadence ?? "immediate") === "immediate"
        )
      );

    if (!phaseCompleted) {
      return {
        run: toGoalRun(run),
        nextIssue: null,
      };
    }

    return completeGoalRunPhase(run, issue, actor);
  }

  async function getGoalRuntimeCostSummary(goalId: string, activeRunId: string | null) {
    const [phaseRows, totals, verifiedOutputCountRow, runStats] = await Promise.all([
      db
        .select({
          phase: costEvents.goalRunPhase,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(eq(costEvents.goalId, goalId))
        .groupBy(costEvents.goalRunPhase),
      db
        .select({
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          activeRunCostCents: activeRunId
            ? sql<number>`coalesce(sum(case when ${costEvents.goalRunId} = ${activeRunId} then ${costEvents.costCents} else 0 end), 0)::int`
            : sql<number>`0::int`,
        })
        .from(costEvents)
        .where(eq(costEvents.goalId, goalId))
        .then((rows) => rows[0] ?? null),
      db
        .select({
          verifiedOutputCount: sql<number>`count(*)::int`,
        })
        .from(issueWorkProducts)
        .where(and(eq(issueWorkProducts.goalId, goalId), eq(issueWorkProducts.outputStatus, "verified")))
        .then((rows) => rows[0] ?? null),
      db
        .select({
          runCount: sql<number>`count(*)::int`,
          successfulRunCount: sql<number>`coalesce(sum(case when ${goalRuns.status} = 'succeeded' then 1 else 0 end), 0)::int`,
          failedRunCount: sql<number>`coalesce(sum(case when ${goalRuns.status} in ('failed', 'cancelled', 'needs_human_decision') then 1 else 0 end), 0)::int`,
        })
        .from(goalRuns)
        .where(eq(goalRuns.goalId, goalId))
        .then((rows) => rows[0] ?? null),
    ]);

    const byPhase: Record<GoalRunPhase, number> = {
      direction: 0,
      production: 0,
      verification: 0,
      measurement: 0,
    };
    for (const row of phaseRows) {
      if (row.phase && row.phase in byPhase) {
        byPhase[row.phase as GoalRunPhase] = Number(row.totalCostCents ?? 0);
      }
    }

    const totalCostCents = Number(totals?.totalCostCents ?? 0);
    const verifiedOutputCount = Number(verifiedOutputCountRow?.verifiedOutputCount ?? 0);
    return {
      totalCostCents,
      activeRunCostCents: Number(totals?.activeRunCostCents ?? 0),
      byPhase,
      costPerVerifiedOutputCents: verifiedOutputCount > 0 ? Math.round(totalCostCents / verifiedOutputCount) : null,
      runCount: Number(runStats?.runCount ?? 0),
      successfulRunCount: Number(runStats?.successfulRunCount ?? 0),
      failedRunCount: Number(runStats?.failedRunCount ?? 0),
    };
  }

  async function queueGoalRunInternal(
    goalId: string,
    input: { recipeVersionId?: string | null; requestedPhase?: string | null; force?: boolean },
    database: Db = db,
  ) {
    const goal = await ensureGoal(goalId);
    if (goal.mode !== "goal_loop") {
      throw unprocessable("Goal must be in goal_loop mode before execution");
    }
    const brief = await database
      .select({
        recipeVersionId: goalBriefs.recipeVersionId,
        status: goalBriefs.status,
        finishCriteria: goalBriefs.finishCriteria,
        accessChecklist: goalBriefs.accessChecklist,
      })
      .from(goalBriefs)
      .where(eq(goalBriefs.goalId, goalId))
      .then((rows) => rows[0] ?? null);
    if (!brief) {
      throw unprocessable("Goal cannot execute without a goal brief");
    }
    const recipeVersionId = input.recipeVersionId ?? brief.recipeVersionId ?? null;
    if (!recipeVersionId) {
      throw unprocessable("Goal cannot execute without a bound recipe version");
    }
    if (brief.status !== "ready") {
      throw unprocessable("Goal brief must be ready before execution");
    }
    if (asRecordArray(brief.finishCriteria).length === 0) {
      throw unprocessable("Goal brief must define at least one finish criterion before execution");
    }
    const accessChecklist = asRecordArray(brief.accessChecklist);
    const blockingItem = accessChecklist.find((item) => item.status !== "ready");
    if (blockingItem) {
      throw unprocessable("Goal brief access checklist must be fully ready before execution");
    }
    if (!input.force) {
      const activeRun = await database
        .select({ id: goalRuns.id })
        .from(goalRuns)
        .where(and(eq(goalRuns.goalId, goalId), inArray(goalRuns.status, [...ACTIVE_GOAL_RUN_STATUSES])))
        .then((rows) => rows[0] ?? null);
      if (activeRun) {
        throw unprocessable("Goal already has an active run");
      }
    }
    return database
      .insert(goalRuns)
      .values({
        companyId: goal.companyId,
        goalId,
        recipeVersionId,
        currentPhase: input.requestedPhase ?? "direction",
        status: "queued",
      })
      .returning()
      .then((rows) => toGoalRun(rows[0]));
  }

  return {
    getContextPack: async (companyId: string) => {
      await ensureCompany(companyId);
      const rows = await db
        .select({
          key: contextPacks.key,
          title: contextPacks.title,
          latestBody: documents.latestBody,
          orderIndex: contextPacks.orderIndex,
          updatedAt: contextPacks.updatedAt,
        })
        .from(contextPacks)
        .innerJoin(documents, eq(contextPacks.documentId, documents.id))
        .where(eq(contextPacks.companyId, companyId))
        .orderBy(asc(contextPacks.orderIndex), asc(contextPacks.createdAt));
      return toContextPack(companyId, rows);
    },

    putContextPack: async (
      companyId: string,
      input: { sections: Array<{ key: string; title: string; body: string; orderIndex?: number }> },
      actor: ActorInfo,
    ) => {
      await ensureCompany(companyId);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: contextPacks.id,
            key: contextPacks.key,
            title: contextPacks.title,
            orderIndex: contextPacks.orderIndex,
            updatedAt: contextPacks.updatedAt,
            documentId: contextPacks.documentId,
            latestBody: documents.latestBody,
          })
          .from(contextPacks)
          .innerJoin(documents, eq(contextPacks.documentId, documents.id))
          .where(eq(contextPacks.companyId, companyId));
        const existingByKey = new Map(existing.map((row) => [row.key, row]));
        const retainedKeys = new Set<string>();
        const now = new Date();

        for (const [index, section] of input.sections.entries()) {
          const existingRow = existingByKey.get(section.key) ?? null;
          const orderIndex = section.orderIndex ?? index;
          const document = await writeDocument(tx, {
            companyId,
            documentId: existingRow?.documentId ?? null,
            title: section.title,
            body: section.body,
            actor,
          });
          retainedKeys.add(section.key);

          if (existingRow) {
            await tx
              .update(contextPacks)
              .set({
                title: section.title,
                orderIndex,
                updatedAt: now,
              })
              .where(eq(contextPacks.id, existingRow.id));
          } else {
            await tx.insert(contextPacks).values({
              companyId,
              key: section.key,
              title: section.title,
              orderIndex,
              documentId: document.id,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        const removedDocumentIds = existing
          .filter((row) => !retainedKeys.has(row.key))
          .map((row) => row.documentId);
        if (removedDocumentIds.length > 0) {
          await tx.delete(documents).where(inArray(documents.id, removedDocumentIds));
        }

        const rows = await tx
          .select({
            key: contextPacks.key,
            title: contextPacks.title,
            latestBody: documents.latestBody,
            orderIndex: contextPacks.orderIndex,
            updatedAt: contextPacks.updatedAt,
          })
          .from(contextPacks)
          .innerJoin(documents, eq(contextPacks.documentId, documents.id))
          .where(eq(contextPacks.companyId, companyId))
          .orderBy(asc(contextPacks.orderIndex), asc(contextPacks.createdAt));
        return toContextPack(companyId, rows);
      });
    },

    getRunbook: async (companyId: string, scopeType: "company" | "goal", scopeId: string) => {
      if (scopeType === "company") {
        await ensureCompany(companyId);
      } else {
        const goal = await ensureGoal(scopeId);
        if (goal.companyId !== companyId) throw notFound("Goal not found");
      }

      const rows = await db
        .select({
          id: runbooks.id,
          title: runbooks.title,
          latestBody: documents.latestBody,
          orderIndex: runbooks.orderIndex,
          updatedAt: runbooks.updatedAt,
        })
        .from(runbooks)
        .innerJoin(documents, eq(runbooks.documentId, documents.id))
        .where(and(eq(runbooks.companyId, companyId), eq(runbooks.scopeType, scopeType), eq(runbooks.scopeId, scopeId)))
        .orderBy(asc(runbooks.orderIndex), asc(runbooks.createdAt));
      return toRunbook(companyId, scopeType, scopeId, rows);
    },

    putRunbook: async (
      companyId: string,
      scopeType: "company" | "goal",
      scopeId: string,
      input: { entries: Array<{ id?: string; title: string; body: string; orderIndex?: number }> },
      actor: ActorInfo,
    ) => {
      if (scopeType === "company") {
        await ensureCompany(companyId);
      } else {
        const goal = await ensureGoal(scopeId);
        if (goal.companyId !== companyId) throw notFound("Goal not found");
      }

      const runbook = await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: runbooks.id,
            documentId: runbooks.documentId,
          })
          .from(runbooks)
          .where(and(eq(runbooks.companyId, companyId), eq(runbooks.scopeType, scopeType), eq(runbooks.scopeId, scopeId)));
        const existingById = new Map(existing.map((row) => [row.id, row]));
        const retainedIds = new Set<string>();
        const now = new Date();

        for (const [index, entry] of input.entries.entries()) {
          const existingRow = entry.id ? existingById.get(entry.id) ?? null : null;
          const orderIndex = entry.orderIndex ?? index;
          const document = await writeDocument(tx, {
            companyId,
            documentId: existingRow?.documentId ?? null,
            title: entry.title,
            body: entry.body,
            actor,
          });

          if (existingRow) {
            retainedIds.add(existingRow.id);
            await tx
              .update(runbooks)
              .set({
                title: entry.title,
                orderIndex,
                updatedAt: now,
              })
              .where(eq(runbooks.id, existingRow.id));
          } else {
            const [created] = await tx
              .insert(runbooks)
              .values({
                companyId,
                scopeType,
                scopeId,
                title: entry.title,
                orderIndex,
                documentId: document.id,
                createdAt: now,
                updatedAt: now,
              })
              .returning({ id: runbooks.id });
            retainedIds.add(created.id);
          }
        }

        const removedDocumentIds = existing
          .filter((row) => !retainedIds.has(row.id))
          .map((row) => row.documentId);
        if (removedDocumentIds.length > 0) {
          await tx.delete(documents).where(inArray(documents.id, removedDocumentIds));
        }

        const rows = await tx
          .select({
            id: runbooks.id,
            title: runbooks.title,
            latestBody: documents.latestBody,
            orderIndex: runbooks.orderIndex,
            updatedAt: runbooks.updatedAt,
          })
          .from(runbooks)
          .innerJoin(documents, eq(runbooks.documentId, documents.id))
          .where(and(eq(runbooks.companyId, companyId), eq(runbooks.scopeType, scopeType), eq(runbooks.scopeId, scopeId)))
          .orderBy(asc(runbooks.orderIndex), asc(runbooks.createdAt));
        return toRunbook(companyId, scopeType, scopeId, rows);
      });
      if (scopeType === "goal") {
        const activeRun = await getLatestActiveGoalRun(scopeId);
        if (activeRun?.latestIssueId) {
          await syncGoalRunForIssue(activeRun.latestIssueId, actor);
        }
      }
      return runbook;
    },

    listRecipes: async (companyId: string) => {
      await ensureCompany(companyId);
      await ensureSystemRecipes(companyId);
      const recipeRows = await db
        .select()
        .from(recipes)
        .where(eq(recipes.companyId, companyId))
        .orderBy(desc(recipes.updatedAt), asc(recipes.name));
      const recipeIds = recipeRows.map((row) => row.id);
      const versionRows = recipeIds.length === 0
        ? []
        : await db
          .select()
          .from(recipeVersions)
          .where(inArray(recipeVersions.recipeId, recipeIds))
          .orderBy(desc(recipeVersions.version), desc(recipeVersions.createdAt));
      const latestByRecipeId = new Map<string, typeof recipeVersions.$inferSelect>();
      for (const row of versionRows) {
        if (!latestByRecipeId.has(row.recipeId)) latestByRecipeId.set(row.recipeId, row);
      }
      return recipeRows.map((row) => {
        const latest = latestByRecipeId.get(row.id) ?? null;
        return {
          ...toRecipe(row, latest?.id ?? null),
          latestVersion: latest ? toRecipeVersion(latest) : null,
        };
      });
    },

    getRecipeById: async (recipeId: string) => {
      const recipe = await db
        .select()
        .from(recipes)
        .where(eq(recipes.id, recipeId))
        .then((rows) => rows[0] ?? null);
      if (!recipe) return null;
      const latest = await db
        .select()
        .from(recipeVersions)
        .where(eq(recipeVersions.recipeId, recipe.id))
        .orderBy(desc(recipeVersions.version), desc(recipeVersions.createdAt))
        .then((rows) => rows[0] ?? null);
      return {
        ...toRecipe(recipe, latest?.id ?? null),
        latestVersion: latest ? toRecipeVersion(latest) : null,
      };
    },

    createRecipe: async (
      companyId: string,
      input: {
        slug: string;
        name: string;
        description?: string | null;
        source?: string;
        initialVersion: {
          title: string;
          description?: string | null;
          definition?: Record<string, unknown> | null;
          requiredSkillKeys?: string[];
          outputType?: string;
          createsPrimaryOutput?: boolean;
          verificationPolicy?: RecipeVersion["verificationPolicy"];
          measurementCadence?: RecipeVersion["measurementCadence"];
          directorRouting?: RecipeVersion["directorRouting"];
          workerRouting?: RecipeVersion["workerRouting"];
          requiredResources?: string[];
        };
      },
    ) => {
      await ensureCompany(companyId);
      return db.transaction(async (tx) => {
        const now = new Date();
        const [recipe] = await tx
          .insert(recipes)
          .values({
            companyId,
            slug: input.slug,
            name: input.name,
            description: input.description ?? null,
            source: input.source ?? "company",
            status: "active",
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        const [version] = await tx
          .insert(recipeVersions)
          .values({
            companyId,
            recipeId: recipe.id,
            version: 1,
            title: input.initialVersion.title,
            description: input.initialVersion.description ?? null,
            definition: buildRecipeVersionDefinition({
              definition: input.initialVersion.definition ?? {},
              outputType: (input.initialVersion.outputType ?? "other") as RecipeVersion["outputType"],
              createsPrimaryOutput: input.initialVersion.createsPrimaryOutput ?? true,
              verificationPolicy: input.initialVersion.verificationPolicy,
              measurementCadence: input.initialVersion.measurementCadence,
              directorRouting: input.initialVersion.directorRouting,
              workerRouting: input.initialVersion.workerRouting,
              requiredResources: input.initialVersion.requiredResources,
            }),
            requiredSkillKeys: input.initialVersion.requiredSkillKeys ?? [],
            outputType: input.initialVersion.outputType ?? "other",
            createsPrimaryOutput: input.initialVersion.createsPrimaryOutput ?? true,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        return {
          ...toRecipe(recipe, version.id),
          latestVersion: toRecipeVersion(version),
        };
      });
    },

    updateRecipe: async (
      recipeId: string,
      input: {
        name?: string;
        description?: string | null;
        status?: string;
        createVersion?: {
          title: string;
          description?: string | null;
          definition?: Record<string, unknown> | null;
          requiredSkillKeys?: string[];
          outputType?: string;
          createsPrimaryOutput?: boolean;
          verificationPolicy?: RecipeVersion["verificationPolicy"];
          measurementCadence?: RecipeVersion["measurementCadence"];
          directorRouting?: RecipeVersion["directorRouting"];
          workerRouting?: RecipeVersion["workerRouting"];
          requiredResources?: string[];
        };
      },
    ) => {
      return db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(recipes)
          .where(eq(recipes.id, recipeId))
          .then((rows) => rows[0] ?? null);
        if (!existing) throw notFound("Recipe not found");

        const now = new Date();
        const [updatedRecipe] = await tx
          .update(recipes)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description ?? null } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            updatedAt: now,
          })
          .where(eq(recipes.id, recipeId))
          .returning();

        let latestVersion = await tx
          .select()
          .from(recipeVersions)
          .where(eq(recipeVersions.recipeId, recipeId))
          .orderBy(desc(recipeVersions.version), desc(recipeVersions.createdAt))
          .then((rows) => rows[0] ?? null);

        if (input.createVersion) {
          const nextVersion = (latestVersion?.version ?? 0) + 1;
          [latestVersion] = await tx
            .insert(recipeVersions)
            .values({
              companyId: existing.companyId,
              recipeId,
              version: nextVersion,
              title: input.createVersion.title,
              description: input.createVersion.description ?? null,
              definition: buildRecipeVersionDefinition({
                definition: input.createVersion.definition ?? {},
                outputType: (input.createVersion.outputType ?? "other") as RecipeVersion["outputType"],
                createsPrimaryOutput: input.createVersion.createsPrimaryOutput ?? true,
                verificationPolicy: input.createVersion.verificationPolicy,
                measurementCadence: input.createVersion.measurementCadence,
                directorRouting: input.createVersion.directorRouting,
                workerRouting: input.createVersion.workerRouting,
                requiredResources: input.createVersion.requiredResources,
              }),
              requiredSkillKeys: input.createVersion.requiredSkillKeys ?? [],
              outputType: input.createVersion.outputType ?? "other",
              createsPrimaryOutput: input.createVersion.createsPrimaryOutput ?? true,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
        }

        return {
          ...toRecipe(updatedRecipe, latestVersion?.id ?? null),
          latestVersion: latestVersion ? toRecipeVersion(latestVersion) : null,
        };
      });
    },

    getGoalBrief: async (goalId: string) => {
      await ensureGoal(goalId);
      const row = await db
        .select({
          id: goalBriefs.id,
          companyId: goalBriefs.companyId,
          goalId: goalBriefs.goalId,
          status: goalBriefs.status,
          recipeId: goalBriefs.recipeId,
          recipeVersionId: goalBriefs.recipeVersionId,
          latestBody: documents.latestBody,
          finishLine: goalBriefs.finishLine,
          kpiFamily: goalBriefs.kpiFamily,
          timeframe: goalBriefs.timeframe,
          currentStateSummary: goalBriefs.currentStateSummary,
          finishCriteria: goalBriefs.finishCriteria,
          accessChecklist: goalBriefs.accessChecklist,
          launchChecklist: goalBriefs.launchChecklist,
          createdAt: goalBriefs.createdAt,
          updatedAt: goalBriefs.updatedAt,
        })
        .from(goalBriefs)
        .innerJoin(documents, eq(goalBriefs.documentId, documents.id))
        .where(eq(goalBriefs.goalId, goalId))
        .then((rows) => rows[0] ?? null);
      return row ? toGoalBrief(row) : null;
    },

    putGoalBrief: async (
      goalId: string,
      input: {
        status?: string;
        recipeId?: string | null;
        recipeVersionId?: string | null;
        body: string;
        finishLine?: string | null;
        kpiFamily?: string | null;
        timeframe?: string | null;
        currentStateSummary?: string | null;
        finishCriteria?: Array<Record<string, unknown>>;
        accessChecklist?: Array<Record<string, unknown>>;
        launchChecklist?: string[];
      },
      actor: ActorInfo,
    ) => {
      const goal = await ensureGoal(goalId);
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: goalBriefs.id,
            documentId: goalBriefs.documentId,
          })
          .from(goalBriefs)
          .where(eq(goalBriefs.goalId, goalId))
          .then((rows) => rows[0] ?? null);
        const now = new Date();
        const document = await writeDocument(tx, {
          companyId: goal.companyId,
          documentId: existing?.documentId ?? null,
          title: `Goal Brief: ${goalId}`,
          body: input.body,
          actor,
        });

        let row;
        if (existing) {
          [row] = await tx
            .update(goalBriefs)
            .set({
              status: input.status ?? "draft",
              recipeId: input.recipeId ?? null,
              recipeVersionId: input.recipeVersionId ?? null,
              finishLine: input.finishLine ?? null,
              kpiFamily: input.kpiFamily ?? null,
              timeframe: input.timeframe ?? null,
              currentStateSummary: input.currentStateSummary ?? null,
              finishCriteria: input.finishCriteria ?? [],
              accessChecklist: input.accessChecklist ?? [],
              launchChecklist: input.launchChecklist ?? [],
              updatedAt: now,
            })
            .where(eq(goalBriefs.id, existing.id))
            .returning();
        } else {
          [row] = await tx
            .insert(goalBriefs)
            .values({
              companyId: goal.companyId,
              goalId,
              documentId: document.id,
              status: input.status ?? "draft",
              recipeId: input.recipeId ?? null,
              recipeVersionId: input.recipeVersionId ?? null,
              finishLine: input.finishLine ?? null,
              kpiFamily: input.kpiFamily ?? null,
              timeframe: input.timeframe ?? null,
              currentStateSummary: input.currentStateSummary ?? null,
              finishCriteria: input.finishCriteria ?? [],
              accessChecklist: input.accessChecklist ?? [],
              launchChecklist: input.launchChecklist ?? [],
              createdAt: now,
              updatedAt: now,
            })
            .returning();
        }

        return toGoalBrief({
          ...row,
          latestBody: input.body,
        });
      });
    },

    getGoalScoreboard: async (goalId: string) => {
      await ensureGoal(goalId);
      const row = await db
        .select()
        .from(goalScoreboards)
        .where(eq(goalScoreboards.goalId, goalId))
        .then((rows) => rows[0] ?? null);
      return row ? toGoalScoreboard(row) : null;
    },

    putGoalScoreboard: async (
      goalId: string,
      input: { summary?: string | null; metrics: Array<Record<string, unknown>> },
    ) => {
      const goal = await ensureGoal(goalId);
      const scoreboard = await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(goalScoreboards)
          .where(eq(goalScoreboards.goalId, goalId))
          .then((rows) => rows[0] ?? null);
        const now = new Date();
        const row = existing
          ? await tx
            .update(goalScoreboards)
            .set({
              summary: input.summary ?? null,
              metrics: input.metrics,
              updatedAt: now,
            })
            .where(eq(goalScoreboards.id, existing.id))
            .returning()
            .then((rows) => rows[0] ?? null)
          : await tx
            .insert(goalScoreboards)
            .values({
              companyId: goal.companyId,
              goalId,
              summary: input.summary ?? null,
              metrics: input.metrics,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .then((rows) => rows[0] ?? null);
        if (!row) throw notFound("Goal scoreboard not found");
        return toGoalScoreboard(row);
      });
      const activeRun = await getLatestActiveGoalRun(goalId);
      if (activeRun?.latestIssueId) {
        await syncGoalRunForIssue(activeRun.latestIssueId);
      }
      return scoreboard;
    },

    getGoalRuntime: async (goalId: string): Promise<GoalRuntime> => {
      const goal = await ensureGoal(goalId);
      const [brief, scoreboard, runbook, activeRunRow, latestRunRow, outputRows] = await Promise.all([
        db
          .select({
            id: goalBriefs.id,
            companyId: goalBriefs.companyId,
            goalId: goalBriefs.goalId,
            status: goalBriefs.status,
            recipeId: goalBriefs.recipeId,
            recipeVersionId: goalBriefs.recipeVersionId,
            latestBody: documents.latestBody,
            finishLine: goalBriefs.finishLine,
            kpiFamily: goalBriefs.kpiFamily,
            timeframe: goalBriefs.timeframe,
            currentStateSummary: goalBriefs.currentStateSummary,
            finishCriteria: goalBriefs.finishCriteria,
            accessChecklist: goalBriefs.accessChecklist,
            launchChecklist: goalBriefs.launchChecklist,
            createdAt: goalBriefs.createdAt,
            updatedAt: goalBriefs.updatedAt,
          })
          .from(goalBriefs)
          .innerJoin(documents, eq(goalBriefs.documentId, documents.id))
          .where(eq(goalBriefs.goalId, goalId))
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(goalScoreboards)
          .where(eq(goalScoreboards.goalId, goalId))
          .then((rows) => rows[0] ?? null),
        db
          .select({
            id: runbooks.id,
            title: runbooks.title,
            latestBody: documents.latestBody,
            orderIndex: runbooks.orderIndex,
            updatedAt: runbooks.updatedAt,
          })
          .from(runbooks)
          .innerJoin(documents, eq(runbooks.documentId, documents.id))
          .where(and(eq(runbooks.companyId, goal.companyId), eq(runbooks.scopeType, "goal"), eq(runbooks.scopeId, goalId)))
          .orderBy(asc(runbooks.orderIndex), asc(runbooks.createdAt)),
        db
          .select()
          .from(goalRuns)
          .where(and(eq(goalRuns.goalId, goalId), inArray(goalRuns.status, [...ACTIVE_GOAL_RUN_STATUSES])))
          .orderBy(desc(goalRuns.createdAt))
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(goalRuns)
          .where(eq(goalRuns.goalId, goalId))
          .orderBy(desc(goalRuns.createdAt))
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(issueWorkProducts)
          .where(eq(issueWorkProducts.goalId, goalId)),
      ]);
      const costs = await getGoalRuntimeCostSummary(goalId, activeRunRow?.id ?? null);
      const activeRun = activeRunRow ? toGoalRun(activeRunRow) : null;
      const nextWakeTarget = activeRunRow ? await resolveGoalRunWakeTarget(activeRunRow.id) : null;
      const activeWorkerIssueCount = activeRunRow
        ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(issues)
          .where(
            and(
              eq(issues.goalRunId, activeRunRow.id),
              inArray(issues.status, ["todo", "in_progress", "blocked"]),
              ...(activeRunRow.latestIssueId ? [ne(issues.id, activeRunRow.latestIssueId)] : []),
            ),
          )
          .then((rows) => rows[0]?.count ?? 0)
        : 0;

      return {
        goalId,
        brief: brief ? toGoalBrief(brief) : null,
        activeRun,
        latestRun: latestRunRow ? toGoalRun(latestRunRow) : null,
        scoreboard: scoreboard ? toGoalScoreboard(scoreboard) : null,
        runbook: toRunbook(goal.companyId, "goal", goalId, runbook),
        actionableIssueId: nextWakeTarget?.issueId ?? activeRun?.latestIssueId ?? null,
        humanDecisionRequired: activeRun?.status === "needs_human_decision",
        blockedBy: activeRun?.status === "needs_human_decision" ? activeRun.failureSummary : null,
        nextWakeTarget: nextWakeTarget
          ? {
            agentId: nextWakeTarget.agentId,
            issueId: nextWakeTarget.issueId,
            goalRunId: nextWakeTarget.goalRunId,
            goalRunPhase: nextWakeTarget.goalRunPhase,
            reason: nextWakeTarget.reason,
          }
          : null,
        activeWorkerIssueCount,
        outputsPendingVerification: outputRows.filter((row) =>
          row.outputStatus === "shipped_pending_verification"
          || row.outputStatus === "verification_failed"
          || row.outputStatus === "needs_human_verification").length,
        verifiedOutputCount: outputRows.filter((row) => row.outputStatus === "verified").length,
        costs,
      };
    },

    getCompanyGoalLoopHealth: async (companyId: string): Promise<GoalLoopHealthSummary> => {
      await ensureCompany(companyId);
      const activeRunRows = await db
        .select({
          goalId: goalRuns.goalId,
          goalTitle: goals.title,
          goalRunId: goalRuns.id,
          status: goalRuns.status,
          currentPhase: goalRuns.currentPhase,
          latestIssueId: goalRuns.latestIssueId,
          blockedBy: goalRuns.failureSummary,
          latestIssueTitle: issues.title,
          latestIssueStatus: issues.status,
          latestIssueAssigneeAgentId: issues.assigneeAgentId,
          latestIssueExecutionRunId: issues.executionRunId,
        })
        .from(goalRuns)
        .innerJoin(goals, eq(goals.id, goalRuns.goalId))
        .leftJoin(issues, eq(issues.id, goalRuns.latestIssueId))
        .where(
          and(
            eq(goalRuns.companyId, companyId),
            eq(goals.mode, "goal_loop"),
            inArray(goalRuns.status, [...ACTIVE_GOAL_RUN_STATUSES]),
          ),
        )
        .orderBy(desc(goalRuns.createdAt));

      const runs = await Promise.all(
        activeRunRows.map(async (row) => {
          const nextWakeTarget = await resolveGoalRunWakeTarget(row.goalRunId);
          return {
            goalId: row.goalId,
            goalTitle: row.goalTitle,
            goalRunId: row.goalRunId,
            status: row.status as GoalRun["status"],
            currentPhase: row.currentPhase as GoalRunPhase,
            latestIssueId: row.latestIssueId,
            latestIssueTitle: row.latestIssueTitle ?? null,
            latestIssueStatus: row.latestIssueStatus ?? null,
            latestIssueAssigneeAgentId: row.latestIssueAssigneeAgentId ?? null,
            latestIssueExecutionRunId: row.latestIssueExecutionRunId ?? null,
            blockedBy: row.status === "needs_human_decision" ? row.blockedBy ?? null : null,
            nextWakeTargetAgentId: nextWakeTarget?.agentId ?? null,
          };
        }),
      );

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [genericHeartbeatRunsLastHour, skippedWakeupsLastHour] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(heartbeatRuns)
          .where(
            and(
              eq(heartbeatRuns.companyId, companyId),
              ne(heartbeatRuns.status, "queued"),
              gte(heartbeatRuns.startedAt, oneHourAgo),
              sql`${heartbeatRuns.goalRunId} is null`,
              sql`${heartbeatRuns.goalId} is null`,
              sql`coalesce(${heartbeatRuns.contextSnapshot}->>'issueId', '') = ''`,
            ),
          )
          .then((rows) => rows[0]?.count ?? 0),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(agentWakeupRequests)
          .where(
            and(
              eq(agentWakeupRequests.companyId, companyId),
              eq(agentWakeupRequests.status, "skipped"),
              eq(agentWakeupRequests.reason, "no_actionable_goal_work"),
              gte(agentWakeupRequests.createdAt, oneHourAgo),
            ),
          )
          .then((rows) => rows[0]?.count ?? 0),
      ]);

      return {
        companyId,
        generatedAt: new Date(),
        activeRunCount: runs.length,
        blockedRunCount: runs.filter((run) => run.status === "needs_human_decision").length,
        needsWakeCount: runs.filter((run) =>
          run.status !== "needs_human_decision"
          && run.latestIssueId
          && (run.latestIssueStatus === "todo" || run.latestIssueStatus === "in_progress")
          && !run.latestIssueExecutionRunId).length,
        orphanedRunCount: runs.filter((run) =>
          !run.latestIssueId
          || (run.status !== "needs_human_decision" && !run.nextWakeTargetAgentId)).length,
        genericHeartbeatRunsLastHour: Number(genericHeartbeatRunsLastHour ?? 0),
        skippedWakeupsLastHour: Number(skippedWakeupsLastHour ?? 0),
        runs,
      };
    },

    queueGoalRun: async (
      goalId: string,
      input: { recipeVersionId?: string | null; requestedPhase?: string | null; force?: boolean },
    ) => queueGoalRunInternal(goalId, input),

    executeGoalRun: async (
      goalId: string,
      input: { recipeVersionId?: string | null; requestedPhase?: string | null; force?: boolean },
      actor: ActorInfo,
    ) => {
      const queuedRun = await queueGoalRunInternal(goalId, input);
      return startGoalRunPhase({
        goalRunId: queuedRun.id,
        phase: queuedRun.currentPhase,
        actor,
      });
    },

    listGoalRuns: async (goalId: string) => {
      await ensureGoal(goalId);
      const rows = await db
        .select()
        .from(goalRuns)
        .where(eq(goalRuns.goalId, goalId))
        .orderBy(desc(goalRuns.createdAt));
      return rows.map(toGoalRun);
    },

    getGoalRun: async (goalRunId: string) => {
      const row = await getGoalRunById(goalRunId);
      return row ? toGoalRun(row) : null;
    },

    validateGoalRunIssueStatusChange,

    syncGoalRunForIssue,

    resolveGoalRunWakeTarget,

    resolveGoalLoopWakeTargetForAgent,

    listGoalOutputs: async (goalId: string) => {
      await ensureGoal(goalId);
      const rows = await db
        .select()
        .from(issueWorkProducts)
        .where(eq(issueWorkProducts.goalId, goalId))
        .orderBy(desc(issueWorkProducts.updatedAt), desc(issueWorkProducts.createdAt));
      return rows.map(toOutputSummary);
    },

    listGoalVerifications: async (goalId: string) => {
      await ensureGoal(goalId);
      const rows = await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.goalId, goalId))
        .orderBy(desc(verificationRuns.createdAt));
      return rows.map(toVerificationRun);
    },

    listOutputVerifications: async (outputId: string) => {
      const rows = await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.outputId, outputId))
        .orderBy(desc(verificationRuns.createdAt));
      return rows.map(toVerificationRun);
    },

    getVerificationRun: async (verificationRunId: string) => {
      const row = await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.id, verificationRunId))
        .then((rows) => rows[0] ?? null);
      return row ? toVerificationRun(row) : null;
    },

    createVerificationRun: async (
      outputId: string,
      input: {
        verdict: VerificationRun["verdict"];
        summary?: string | null;
        proofPayload?: Record<string, unknown> | null;
      },
    ) => {
      const output = await db
        .select()
        .from(issueWorkProducts)
        .where(eq(issueWorkProducts.id, outputId))
        .then((rows) => rows[0] ?? null);
      if (!output) throw notFound("Output not found");
      if (!output.goalId || !output.goalRunId) {
        throw unprocessable("Only goal-loop outputs can be verified");
      }

      const now = new Date();
      const [verification] = await db
        .insert(verificationRuns)
        .values({
          companyId: output.companyId,
          goalId: output.goalId,
          goalRunId: output.goalRunId,
          outputId: output.id,
          verdict: input.verdict,
          summary: input.summary ?? null,
          proofPayload: input.proofPayload ?? null,
          startedAt: now,
          finishedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      const nextOutputStatus =
        input.verdict === "passed"
          ? "verified"
          : input.verdict === "needs_human_decision" || input.verdict === "ambiguous_result"
            ? "needs_human_verification"
            : input.verdict === "pending"
              ? "shipped_pending_verification"
              : "verification_failed";

      await db
        .update(issueWorkProducts)
        .set({
          outputStatus: nextOutputStatus,
          verificationRunId: verification.id,
          verificationSummary: input.summary ?? null,
          verifiedAt: input.verdict === "passed" ? now : null,
          shippedAt: output.shippedAt ?? now,
          updatedAt: now,
        })
        .where(eq(issueWorkProducts.id, output.id));

      const result = toVerificationRun(verification);
      await syncGoalRunForIssue(output.issueId);
      return result;
    },

    updateVerificationRun: async (
      verificationRunId: string,
      input: {
        verdict?: VerificationRun["verdict"];
        summary?: string | null;
        proofPayload?: Record<string, unknown> | null;
      },
    ) => {
      const existing = await db
        .select()
        .from(verificationRuns)
        .where(eq(verificationRuns.id, verificationRunId))
        .then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Verification run not found");

      const now = new Date();
      const [verification] = await db
        .update(verificationRuns)
        .set({
          ...(input.verdict !== undefined ? { verdict: input.verdict } : {}),
          ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
          ...(input.proofPayload !== undefined ? { proofPayload: input.proofPayload ?? null } : {}),
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(verificationRuns.id, verificationRunId))
        .returning();

      const output = await db
        .select()
        .from(issueWorkProducts)
        .where(eq(issueWorkProducts.id, verification.outputId))
        .then((rows) => rows[0] ?? null);
      if (output) {
        const verdict = verification.verdict as VerificationRun["verdict"];
        const nextOutputStatus =
          verdict === "passed"
            ? "verified"
            : verdict === "needs_human_decision" || verdict === "ambiguous_result"
              ? "needs_human_verification"
              : verdict === "pending"
                ? "shipped_pending_verification"
                : "verification_failed";
        await db
          .update(issueWorkProducts)
          .set({
            outputStatus: nextOutputStatus,
            verificationRunId: verification.id,
            verificationSummary: verification.summary ?? null,
            verifiedAt: verdict === "passed" ? now : null,
            shippedAt: output.shippedAt ?? now,
            updatedAt: now,
          })
          .where(eq(issueWorkProducts.id, output.id));
      }

      const result = toVerificationRun(verification);
      if (output?.issueId) {
        await syncGoalRunForIssue(output.issueId);
      }
      return result;
    },

    listResourceLeases: async (
      companyId: string,
      filters?: {
        goalId?: string;
        goalRunId?: string;
        mode?: string;
        status?: string;
      },
    ) => {
      await ensureCompany(companyId);
      const conditions: ReturnType<typeof eq>[] = [eq(resourceLeases.companyId, companyId)];
      if (filters?.goalId) conditions.push(eq(resourceLeases.goalId, filters.goalId));
      if (filters?.goalRunId) conditions.push(eq(resourceLeases.goalRunId, filters.goalRunId));
      if (filters?.mode) conditions.push(eq(resourceLeases.mode, filters.mode));
      if (filters?.status) conditions.push(eq(resourceLeases.status, filters.status));
      const rows = await db
        .select()
        .from(resourceLeases)
        .where(and(...conditions))
        .orderBy(desc(resourceLeases.updatedAt), desc(resourceLeases.createdAt));
      return rows.map(toResourceLease);
    },
  };
}
