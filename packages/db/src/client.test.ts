import { createHash } from "node:crypto";
import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  applyPendingMigrations,
  inspectMigrations,
} from "./client.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./test-embedded-postgres.js";

const cleanups: Array<() => Promise<void>> = [];
const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

async function createTempDatabase(): Promise<string> {
  const db = await startEmbeddedPostgresTestDatabase("paperclip-db-client-");
  cleanups.push(db.cleanup);
  return db.connectionString;
}

async function migrationHash(migrationFile: string): Promise<string> {
  const content = await fs.promises.readFile(
    new URL(`./migrations/${migrationFile}`, import.meta.url),
    "utf8",
  );
  return createHash("sha256").update(content).digest("hex");
}

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    await cleanup?.();
  }
});

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres migration tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("applyPendingMigrations", () => {
  it(
    "applies an inserted earlier migration without replaying later legacy migrations",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const richMagnetoHash = await migrationHash("0030_rich_magneto.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${richMagnetoHash}'`,
        );
        await sql.unsafe(`DROP TABLE "company_logos"`);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0030_rich_magneto.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const rows = await verifySql.unsafe<{ table_name: string }[]>(
          `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('company_logos', 'execution_workspaces')
            ORDER BY table_name
          `,
        );
        expect(rows.map((row) => row.table_name)).toEqual([
          "company_logos",
          "execution_workspaces",
        ]);
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0044 safely when its schema changes already exist",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const illegalToadHash = await migrationHash("0044_illegal_toad.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${illegalToadHash}'`,
        );

        const columns = await sql.unsafe<{ column_name: string }[]>(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'instance_settings'
              AND column_name = 'general'
          `,
        );
        expect(columns).toHaveLength(1);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0044_illegal_toad.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");
    },
    20_000,
  );

  it(
    "enforces a unique board_api_keys.key_hash after migration 0044",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        await sql.unsafe(`
          INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
          VALUES ('user-1', 'User One', 'user@example.com', true, now(), now())
        `);
        await sql.unsafe(`
          INSERT INTO "board_api_keys" ("id", "user_id", "name", "key_hash", "created_at")
          VALUES ('00000000-0000-0000-0000-000000000001', 'user-1', 'Key One', 'dup-hash', now())
        `);
        await expect(
          sql.unsafe(`
            INSERT INTO "board_api_keys" ("id", "user_id", "name", "key_hash", "created_at")
            VALUES ('00000000-0000-0000-0000-000000000002', 'user-1', 'Key Two', 'dup-hash', now())
          `),
        ).rejects.toThrow();
      } finally {
        await sql.end();
      }
    },
    20_000,
  );

  it(
    "replays migration 0046 safely when document revision columns already exist",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const smoothSentinelsHash = await migrationHash("0046_smooth_sentinels.sql");

        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${smoothSentinelsHash}'`,
        );

        const columns = await sql.unsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
          `
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_revisions'
              AND column_name IN ('title', 'format')
            ORDER BY column_name
          `,
        );
        expect(columns).toHaveLength(2);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0046_smooth_sentinels.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const columns = await verifySql.unsafe<{ column_name: string; is_nullable: string; column_default: string | null }[]>(
          `
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'document_revisions'
              AND column_name IN ('title', 'format')
            ORDER BY column_name
          `,
        );
        expect(columns).toEqual([
          expect.objectContaining({
            column_name: "format",
            is_nullable: "NO",
          }),
          expect.objectContaining({
            column_name: "title",
            is_nullable: "YES",
          }),
        ]);
        expect(columns[0]?.column_default).toContain("'markdown'");
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );

  it(
    "applies migration 0047 by backfilling legacy companies and goals to classic while keeping new-company default goal_loop",
    async () => {
      const connectionString = await createTempDatabase();

      await applyPendingMigrations(connectionString);

      const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        await sql.unsafe(`
          INSERT INTO "companies" (
            "id",
            "name",
            "issue_prefix",
            "require_board_approval_for_new_agents",
            "default_goal_mode",
            "created_at",
            "updated_at"
          )
          VALUES (
            '11111111-1111-4111-8111-111111111111',
            'Legacy Co',
            'LEG',
            false,
            'classic',
            now(),
            now()
          )
        `);
        await sql.unsafe(`
          INSERT INTO "goals" (
            "id",
            "company_id",
            "title",
            "description",
            "level",
            "status",
            "mode",
            "created_at",
            "updated_at"
          )
          VALUES
            (
              '22222222-2222-4222-8222-222222222222',
              '11111111-1111-4111-8111-111111111111',
              'Legacy company goal',
              'Classic root goal',
              'company',
              'active',
              'classic',
              now(),
              now()
            ),
            (
              '33333333-3333-4333-8333-333333333333',
              '11111111-1111-4111-8111-111111111111',
              'Legacy team goal',
              'Classic team goal',
              'team',
              'active',
              'classic',
              now(),
              now()
            )
        `);

        const goalLoopHash = await migrationHash("0047_puzzling_red_wolf.sql");
        await sql.unsafe(
          `DELETE FROM "drizzle"."__drizzle_migrations" WHERE hash = '${goalLoopHash}'`,
        );

        await sql.unsafe(`DROP TABLE IF EXISTS "verification_runs" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "resource_leases" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "runbooks" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "goal_scoreboard_snapshots" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "goal_scoreboards" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "goal_runs" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "goal_briefs" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "recipe_versions" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "recipes" CASCADE`);
        await sql.unsafe(`DROP TABLE IF EXISTS "context_packs" CASCADE`);

        await sql.unsafe(`ALTER TABLE "issues" DROP COLUMN IF EXISTS "goal_run_phase"`);
        await sql.unsafe(`ALTER TABLE "issues" DROP COLUMN IF EXISTS "goal_run_id"`);

        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "verified_at"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "shipped_at"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "verification_summary"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "verification_run_id"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "proof_url"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "output_status"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "output_type"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "goal_run_id"`);
        await sql.unsafe(`ALTER TABLE "issue_work_products" DROP COLUMN IF EXISTS "goal_id"`);

        await sql.unsafe(`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "recipe_version_id"`);
        await sql.unsafe(`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "goal_run_phase"`);
        await sql.unsafe(`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "goal_run_id"`);
        await sql.unsafe(`ALTER TABLE "heartbeat_runs" DROP COLUMN IF EXISTS "goal_id"`);

        await sql.unsafe(`ALTER TABLE "cost_events" DROP COLUMN IF EXISTS "recipe_version_id"`);
        await sql.unsafe(`ALTER TABLE "cost_events" DROP COLUMN IF EXISTS "goal_run_phase"`);
        await sql.unsafe(`ALTER TABLE "cost_events" DROP COLUMN IF EXISTS "goal_run_id"`);

        await sql.unsafe(`ALTER TABLE "goals" DROP COLUMN IF EXISTS "current_state_summary"`);
        await sql.unsafe(`ALTER TABLE "goals" DROP COLUMN IF EXISTS "timeframe"`);
        await sql.unsafe(`ALTER TABLE "goals" DROP COLUMN IF EXISTS "kpi_family"`);
        await sql.unsafe(`ALTER TABLE "goals" DROP COLUMN IF EXISTS "mode"`);

        await sql.unsafe(`ALTER TABLE "companies" DROP COLUMN IF EXISTS "default_goal_mode"`);
      } finally {
        await sql.end();
      }

      const pendingState = await inspectMigrations(connectionString);
      expect(pendingState).toMatchObject({
        status: "needsMigrations",
        pendingMigrations: ["0047_puzzling_red_wolf.sql"],
        reason: "pending-migrations",
      });

      await applyPendingMigrations(connectionString);

      const finalState = await inspectMigrations(connectionString);
      expect(finalState.status).toBe("upToDate");

      const verifySql = postgres(connectionString, { max: 1, onnotice: () => {} });
      try {
        const companyModes = await verifySql.unsafe<{ id: string; default_goal_mode: string }[]>(`
          SELECT id, default_goal_mode
          FROM companies
          ORDER BY id
        `);
        expect(companyModes).toContainEqual({
          id: "11111111-1111-4111-8111-111111111111",
          default_goal_mode: "classic",
        });

        const goalModes = await verifySql.unsafe<{ id: string; mode: string }[]>(`
          SELECT id, mode
          FROM goals
          WHERE company_id = '11111111-1111-4111-8111-111111111111'
          ORDER BY id
        `);
        expect(goalModes).toEqual([
          { id: "22222222-2222-4222-8222-222222222222", mode: "classic" },
          { id: "33333333-3333-4333-8333-333333333333", mode: "classic" },
        ]);

        await verifySql.unsafe(`
          INSERT INTO "companies" (
            "id",
            "name",
            "issue_prefix",
            "require_board_approval_for_new_agents",
            "created_at",
            "updated_at"
          )
          VALUES (
            '44444444-4444-4444-8444-444444444444',
            'New Goal Loop Co',
            'NEW',
            false,
            now(),
            now()
          )
        `);
        const [newCompany] = await verifySql.unsafe<{ default_goal_mode: string }[]>(`
          SELECT default_goal_mode
          FROM companies
          WHERE id = '44444444-4444-4444-8444-444444444444'
        `);
        expect(newCompany?.default_goal_mode).toBe("goal_loop");

        const goalLoopTables = await verifySql.unsafe<{ table_name: string }[]>(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name IN (
              'context_packs',
              'goal_briefs',
              'goal_runs',
              'goal_scoreboards',
              'goal_scoreboard_snapshots',
              'recipes',
              'recipe_versions',
              'runbooks',
              'resource_leases',
              'verification_runs'
            )
          ORDER BY table_name
        `);
        expect(goalLoopTables.map((row) => row.table_name)).toEqual([
          "context_packs",
          "goal_briefs",
          "goal_runs",
          "goal_scoreboard_snapshots",
          "goal_scoreboards",
          "recipe_versions",
          "recipes",
          "resource_leases",
          "runbooks",
          "verification_runs",
        ]);
      } finally {
        await verifySql.end();
      }
    },
    20_000,
  );
});
