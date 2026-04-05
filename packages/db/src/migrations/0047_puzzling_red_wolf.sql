CREATE TABLE "context_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"recipe_id" uuid,
	"recipe_version_id" uuid,
	"finish_line" text,
	"kpi_family" text,
	"timeframe" text,
	"current_state_summary" text,
	"finish_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"launch_checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"recipe_version_id" uuid,
	"current_phase" text DEFAULT 'direction' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"latest_issue_id" uuid,
	"measurement_due_at" timestamp with time zone,
	"failure_summary" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_scoreboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"goal_run_id" uuid,
	"summary" text,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_scoreboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"summary" text,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"definition" jsonb DEFAULT '{}'::jsonb,
	"required_skill_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_type" text DEFAULT 'other' NOT NULL,
	"creates_primary_output" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'company' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid,
	"goal_run_id" uuid,
	"issue_id" uuid,
	"resource_key" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"title" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"goal_run_id" uuid NOT NULL,
	"output_id" uuid NOT NULL,
	"verdict" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"proof_payload" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "default_goal_mode" text;--> statement-breakpoint
UPDATE "companies" SET "default_goal_mode" = 'classic' WHERE "default_goal_mode" IS NULL;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "default_goal_mode" SET DEFAULT 'goal_loop';--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "default_goal_mode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "goal_run_id" uuid;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "goal_run_phase" text;--> statement-breakpoint
ALTER TABLE "cost_events" ADD COLUMN "recipe_version_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "mode" text DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "kpi_family" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "timeframe" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "current_state_summary" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "goal_id" uuid;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "goal_run_id" uuid;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "goal_run_phase" text;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD COLUMN "recipe_version_id" uuid;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "goal_id" uuid;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "goal_run_id" uuid;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "output_type" text;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "output_status" text;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "proof_url" text;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "verification_run_id" uuid;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "verification_summary" text;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "goal_run_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "goal_run_phase" text;--> statement-breakpoint
ALTER TABLE "context_packs" ADD CONSTRAINT "context_packs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_packs" ADD CONSTRAINT "context_packs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_briefs" ADD CONSTRAINT "goal_briefs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_briefs" ADD CONSTRAINT "goal_briefs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_briefs" ADD CONSTRAINT "goal_briefs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_briefs" ADD CONSTRAINT "goal_briefs_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_briefs" ADD CONSTRAINT "goal_briefs_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_runs" ADD CONSTRAINT "goal_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_runs" ADD CONSTRAINT "goal_runs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_runs" ADD CONSTRAINT "goal_runs_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_scoreboard_snapshots" ADD CONSTRAINT "goal_scoreboard_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_scoreboard_snapshots" ADD CONSTRAINT "goal_scoreboard_snapshots_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_scoreboard_snapshots" ADD CONSTRAINT "goal_scoreboard_snapshots_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_scoreboards" ADD CONSTRAINT "goal_scoreboards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_scoreboards" ADD CONSTRAINT "goal_scoreboards_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_leases" ADD CONSTRAINT "resource_leases_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_leases" ADD CONSTRAINT "resource_leases_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_leases" ADD CONSTRAINT "resource_leases_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runbooks" ADD CONSTRAINT "runbooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runbooks" ADD CONSTRAINT "runbooks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "context_packs_company_order_idx" ON "context_packs" USING btree ("company_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "context_packs_company_key_uq" ON "context_packs" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "context_packs_document_uq" ON "context_packs" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_briefs_company_goal_uq" ON "goal_briefs" USING btree ("company_id","goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_briefs_document_uq" ON "goal_briefs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "goal_briefs_company_updated_idx" ON "goal_briefs" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE INDEX "goal_runs_company_goal_created_idx" ON "goal_runs" USING btree ("company_id","goal_id","created_at");--> statement-breakpoint
CREATE INDEX "goal_runs_company_status_idx" ON "goal_runs" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "goal_scoreboard_snapshots_company_goal_captured_idx" ON "goal_scoreboard_snapshots" USING btree ("company_id","goal_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_scoreboards_company_goal_uq" ON "goal_scoreboards" USING btree ("company_id","goal_id");--> statement-breakpoint
CREATE INDEX "goal_scoreboards_company_updated_idx" ON "goal_scoreboards" USING btree ("company_id","updated_at");--> statement-breakpoint
CREATE INDEX "recipe_versions_company_recipe_idx" ON "recipe_versions" USING btree ("company_id","recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_versions_recipe_version_uq" ON "recipe_versions" USING btree ("recipe_id","version");--> statement-breakpoint
CREATE INDEX "recipes_company_status_idx" ON "recipes" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_company_slug_uq" ON "recipes" USING btree ("company_id","slug");--> statement-breakpoint
CREATE INDEX "resource_leases_company_resource_status_idx" ON "resource_leases" USING btree ("company_id","resource_key","status");--> statement-breakpoint
CREATE INDEX "resource_leases_company_goal_run_idx" ON "resource_leases" USING btree ("company_id","goal_run_id","updated_at");--> statement-breakpoint
CREATE INDEX "runbooks_company_scope_updated_idx" ON "runbooks" USING btree ("company_id","scope_type","scope_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "runbooks_company_scope_order_uq" ON "runbooks" USING btree ("company_id","scope_type","scope_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "runbooks_document_uq" ON "runbooks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "verification_runs_goal_run_idx" ON "verification_runs" USING btree ("goal_run_id","created_at");--> statement-breakpoint
CREATE INDEX "verification_runs_output_idx" ON "verification_runs" USING btree ("output_id","created_at");--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_runs" ADD CONSTRAINT "heartbeat_runs_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_work_products" ADD CONSTRAINT "issue_work_products_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_goal_run_id_goal_runs_id_fk" FOREIGN KEY ("goal_run_id") REFERENCES "public"."goal_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_events_company_goal_run_idx" ON "cost_events" USING btree ("company_id","goal_run_id");--> statement-breakpoint
CREATE INDEX "heartbeat_runs_company_goal_run_idx" ON "heartbeat_runs" USING btree ("company_id","goal_run_id");--> statement-breakpoint
CREATE INDEX "issue_work_products_company_goal_run_idx" ON "issue_work_products" USING btree ("company_id","goal_run_id");--> statement-breakpoint
CREATE INDEX "issues_company_goal_run_idx" ON "issues" USING btree ("company_id","goal_run_id");
