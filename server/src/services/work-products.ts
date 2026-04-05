import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issueWorkProducts } from "@paperclipai/db";
import type { IssueWorkProduct } from "@paperclipai/shared";

type IssueWorkProductRow = typeof issueWorkProducts.$inferSelect;

function normalizeGoalLoopPatch(
  patch: Partial<typeof issueWorkProducts.$inferInsert>,
  existing?: IssueWorkProductRow | null,
): Partial<typeof issueWorkProducts.$inferInsert> {
  const nextGoalId = patch.goalId !== undefined ? patch.goalId : (existing?.goalId ?? null);
  const nextGoalRunId = patch.goalRunId !== undefined ? patch.goalRunId : (existing?.goalRunId ?? null);
  const nextOutputType = patch.outputType !== undefined ? patch.outputType : (existing?.outputType ?? null);
  if (!nextGoalId && !nextGoalRunId && !nextOutputType) {
    return patch;
  }

  const now = new Date();
  const nextUrl = patch.url !== undefined ? patch.url : (existing?.url ?? null);
  const nextProofUrl = patch.proofUrl !== undefined ? patch.proofUrl : (existing?.proofUrl ?? null);
  const nextVerificationRunId =
    patch.verificationRunId !== undefined ? patch.verificationRunId : (existing?.verificationRunId ?? null);
  const nextVerifiedAt = patch.verifiedAt !== undefined ? patch.verifiedAt : (existing?.verifiedAt ?? null);

  const normalized: Partial<typeof issueWorkProducts.$inferInsert> = {
    ...patch,
    ...(nextGoalId !== undefined ? { goalId: nextGoalId } : {}),
    ...(nextGoalRunId !== undefined ? { goalRunId: nextGoalRunId } : {}),
  };

  if (normalized.outputStatus === undefined) {
    if (nextVerificationRunId || nextVerifiedAt) {
      normalized.outputStatus = "verified";
    } else if (nextUrl || nextProofUrl) {
      normalized.outputStatus = "shipped_pending_verification";
    } else if (nextOutputType) {
      normalized.outputStatus = "generated_not_shipped";
    }
  }

  if (normalized.outputStatus === "verified" && normalized.verifiedAt === undefined) {
    normalized.verifiedAt = existing?.verifiedAt ?? now;
  }
  if (
    (normalized.outputStatus === "shipped_pending_verification" || normalized.outputStatus === "verified")
    && normalized.shippedAt === undefined
  ) {
    normalized.shippedAt = existing?.shippedAt ?? now;
  }

  return normalized;
}

function toIssueWorkProduct(row: IssueWorkProductRow): IssueWorkProduct {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId ?? null,
    issueId: row.issueId,
    goalId: row.goalId ?? null,
    goalRunId: row.goalRunId ?? null,
    executionWorkspaceId: row.executionWorkspaceId ?? null,
    runtimeServiceId: row.runtimeServiceId ?? null,
    type: row.type as IssueWorkProduct["type"],
    provider: row.provider,
    externalId: row.externalId ?? null,
    title: row.title,
    url: row.url ?? null,
    status: row.status,
    outputType: row.outputType as IssueWorkProduct["outputType"],
    outputStatus: row.outputStatus as IssueWorkProduct["outputStatus"],
    reviewState: row.reviewState as IssueWorkProduct["reviewState"],
    isPrimary: row.isPrimary,
    healthStatus: row.healthStatus as IssueWorkProduct["healthStatus"],
    summary: row.summary ?? null,
    proofUrl: row.proofUrl ?? null,
    verificationRunId: row.verificationRunId ?? null,
    verificationSummary: row.verificationSummary ?? null,
    shippedAt: row.shippedAt ?? null,
    verifiedAt: row.verifiedAt ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdByRunId: row.createdByRunId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function workProductService(db: Db) {
  return {
    listForIssue: async (issueId: string) => {
      const rows = await db
        .select()
        .from(issueWorkProducts)
        .where(eq(issueWorkProducts.issueId, issueId))
        .orderBy(desc(issueWorkProducts.isPrimary), desc(issueWorkProducts.updatedAt));
      return rows.map(toIssueWorkProduct);
    },

    getById: async (id: string) => {
      const row = await db
        .select()
        .from(issueWorkProducts)
        .where(eq(issueWorkProducts.id, id))
        .then((rows) => rows[0] ?? null);
      return row ? toIssueWorkProduct(row) : null;
    },

    createForIssue: async (issueId: string, companyId: string, data: Omit<typeof issueWorkProducts.$inferInsert, "issueId" | "companyId">) => {
      const normalizedData = normalizeGoalLoopPatch(data);
      const row = await db.transaction(async (tx) => {
        if (normalizedData.isPrimary) {
          await tx
            .update(issueWorkProducts)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(
              and(
                eq(issueWorkProducts.companyId, companyId),
                eq(issueWorkProducts.issueId, issueId),
                eq(issueWorkProducts.type, normalizedData.type ?? data.type),
              ),
            );
        }
        return await tx
          .insert(issueWorkProducts)
          .values({
            ...data,
            ...normalizedData,
            companyId,
            issueId,
          })
          .returning()
          .then((rows) => rows[0] ?? null);
      });
      return row ? toIssueWorkProduct(row) : null;
    },

    update: async (id: string, patch: Partial<typeof issueWorkProducts.$inferInsert>) => {
      const row = await db.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(issueWorkProducts)
          .where(eq(issueWorkProducts.id, id))
          .then((rows) => rows[0] ?? null);
        if (!existing) return null;
        const normalizedPatch = normalizeGoalLoopPatch(patch, existing);

        if (normalizedPatch.isPrimary === true) {
          await tx
            .update(issueWorkProducts)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(
              and(
                eq(issueWorkProducts.companyId, existing.companyId),
                eq(issueWorkProducts.issueId, existing.issueId),
                eq(issueWorkProducts.type, existing.type),
              ),
            );
        }

        return await tx
          .update(issueWorkProducts)
          .set({ ...normalizedPatch, updatedAt: new Date() })
          .where(eq(issueWorkProducts.id, id))
          .returning()
          .then((rows) => rows[0] ?? null);
      });
      return row ? toIssueWorkProduct(row) : null;
    },

    remove: async (id: string) => {
      const row = await db
        .delete(issueWorkProducts)
        .where(eq(issueWorkProducts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
      return row ? toIssueWorkProduct(row) : null;
    },
  };
}

export { toIssueWorkProduct };
