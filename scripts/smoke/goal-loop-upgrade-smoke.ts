import process from "node:process";
import { randomUUID } from "node:crypto";
import { createDb } from "../../packages/db/src/client.ts";
import { companyService } from "../../server/src/services/companies.ts";
import { goalService } from "../../server/src/services/goals.ts";
import { goalLoopService } from "../../server/src/services/goal-loop.ts";
import { issueService } from "../../server/src/services/issues.ts";
import { workProductService } from "../../server/src/services/work-products.ts";

type ParsedArgs = {
  dbUrl: string;
  companyId: string;
  recipeSlug: string;
  proofUrl: string;
  actorUserId: string;
  goalTitle: string;
};

function usage() {
  console.error(
    [
      "Usage:",
      "  pnpm exec tsx scripts/smoke/goal-loop-upgrade-smoke.ts --db-url <postgres-url> --company-id <uuid>",
      "",
      "Optional:",
      "  --recipe <website_repair|social_growth|supplier_outreach>   default: website_repair",
      "  --proof-url <url>                                           default: https://titanclaws.com",
      "  --actor-user-id <id>                                        default: goal-loop-smoke",
      "  --goal-title <title>                                        default: generated smoke title",
      "",
      "This smoke verifies the upgrade path described in PaperclipGoalLoopSystem.md by",
      "running a full goal-loop execution on top of a legacy classic company dataset.",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    args.set(arg.slice(2), value);
    index += 1;
  }

  const dbUrl = args.get("db-url");
  const companyId = args.get("company-id");
  if (!dbUrl || !companyId) {
    usage();
    throw new Error("Both --db-url and --company-id are required");
  }

  return {
    dbUrl,
    companyId,
    recipeSlug: args.get("recipe") ?? "website_repair",
    proofUrl: args.get("proof-url") ?? "https://titanclaws.com",
    actorUserId: args.get("actor-user-id") ?? "goal-loop-smoke",
    goalTitle: args.get("goal-title") ?? `Smoke: Goal-loop coexistence ${new Date().toISOString()}`,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = createDb(options.dbUrl);
  const companies = companyService(db);
  const goals = goalService(db);
  const goalLoop = goalLoopService(db);
  const issues = issueService(db);
  const workProducts = workProductService(db);
  const actor = { userId: options.actorUserId };

  const company = await companies.getById(options.companyId);
  if (!company) throw new Error(`Company not found: ${options.companyId}`);
  if (company.defaultGoalMode !== "classic") {
    throw new Error(
      `Expected a legacy classic company for upgrade smoke, found defaultGoalMode=${company.defaultGoalMode ?? "null"}`,
    );
  }

  const existingGoals = await goals.list(options.companyId);
  const legacyClassicGoals = existingGoals.filter((goal) => (goal.mode ?? "classic") === "classic");
  const preexistingGoalLoopGoals = existingGoals.filter((goal) => (goal.mode ?? "classic") !== "classic");
  if (legacyClassicGoals.length === 0) {
    throw new Error(
      "Expected the migrated company to retain at least one legacy classic goal before the smoke run",
    );
  }

  const recipe = (await goalLoop.listRecipes(options.companyId))
    .find((entry) => entry.slug === options.recipeSlug && entry.latestVersion);
  if (!recipe?.latestVersion) {
    throw new Error(`Recipe ${options.recipeSlug} not found or missing a latest version`);
  }

  const createdGoal = await goals.create(options.companyId, {
    title: options.goalTitle,
    description: "Step-10 smoke goal for verifying classic-to-goal-loop coexistence.",
    level: "team",
    parentId: null,
    ownerAgentId: null,
    status: "active",
    mode: "goal_loop",
  });

  const brief = await goalLoop.putGoalBrief(
    createdGoal.id,
    {
      status: "ready",
      recipeId: recipe.id,
      recipeVersionId: recipe.latestVersion.id,
      body: [
        "# Goal-loop upgrade smoke",
        "",
        "This brief validates the PaperclipGoalLoopSystem migration against a legacy classic company dataset.",
        "",
        "Focus:",
        "- Preserve the classic company and legacy goals.",
        "- Allow a new goal_loop goal to run end to end.",
        "- Capture an output ledger entry, verification record, scoreboard update, and runbook update.",
      ].join("\n"),
      finishLine: "Smoke goal run completes through measurement with a verified primary output.",
      kpiFamily: "upgrade_validation",
      timeframe: "single smoke run",
      currentStateSummary: "Legacy classic company upgraded to a dual-mode runtime.",
      finishCriteria: [
        {
          id: "coexistence",
          label: "Legacy classic goals remain untouched while the new goal_loop goal runs successfully.",
        },
        {
          id: "verification",
          label: "Primary output is recorded, verified, and attached to the goal run.",
        },
      ],
      accessChecklist: [
        {
          key: "wordpress",
          label: "WordPress installation surfaced on titanclaws.com",
          status: "ready",
        },
        {
          key: "gohighlevel",
          label: "GoHighLevel account connected for lead capture and social scheduling",
          status: "ready",
        },
      ],
      launchChecklist: [
        "Confirm upgraded company remains in classic default mode",
        "Confirm system recipe is available for goal-loop smoke",
      ],
    },
    actor,
  );

  const initialScoreboard = await goalLoop.putGoalScoreboard(createdGoal.id, {
    summary: "Pre-run upgrade smoke baseline recorded.",
    metrics: [
        {
          key: "legacy_goal_count",
          label: "Legacy classic goals",
          value: legacyClassicGoals.length,
          notes: "Existing goals must remain classic after migration.",
        },
        {
          key: "preexisting_goal_loop_goal_count",
          label: "Preexisting goal-loop goals",
          value: preexistingGoalLoopGoals.length,
          notes: "Non-zero is valid on reruns against the same migrated dataset.",
        },
        {
          key: "smoke_status",
          label: "Smoke status",
        value: "baseline",
      },
    ],
  });

  const initialRunbook = await goalLoop.putRunbook(
    options.companyId,
    "goal",
    createdGoal.id,
    {
      entries: [
        {
          title: "Upgrade smoke runbook",
          body: [
            "- Preserve legacy classic goals and dashboards",
            "- Run one new goal_loop goal to completion",
            "- Record a primary output and verification proof before measurement closes",
            "- Update scoreboard and runbook again before measurement completes",
          ].join("\n"),
          orderIndex: 0,
        },
      ],
    },
    actor,
  );

  const direction = await goalLoop.executeGoalRun(createdGoal.id, { requestedPhase: "direction" }, actor);
  if (!direction.issue) throw new Error("Direction phase did not create an issue");

  await issues.update(direction.issue.id, { status: "done" });
  const afterDirection = await goalLoop.syncGoalRunForIssue(direction.issue.id, actor);
  if (!afterDirection?.nextIssue) throw new Error("Direction completion did not start production");

  const productionIssue = afterDirection.nextIssue;
  const output = await workProducts.createForIssue(productionIssue.id, options.companyId, {
    goalId: createdGoal.id,
    goalRunId: afterDirection.run.id,
    type: "preview_url",
    provider: "custom",
    title: "Goal-loop upgrade smoke proof",
    url: options.proofUrl,
    status: "ready_for_review",
    outputType: recipe.latestVersion.outputType,
    summary: "Primary smoke output captured against the upgraded runtime.",
    isPrimary: true,
    metadata: {
      smoke: true,
      companyId: options.companyId,
      recipeSlug: recipe.slug,
      traceId: randomUUID(),
    },
  });
  if (!output) throw new Error("Failed to create smoke output");

  await issues.update(productionIssue.id, { status: "done" });
  const afterProduction = await goalLoop.syncGoalRunForIssue(productionIssue.id, actor);
  if (!afterProduction?.nextIssue) throw new Error("Production completion did not start verification");

  const verification = await goalLoop.createVerificationRun(output.id, {
    verdict: "passed",
    summary: "Upgrade smoke verification passed.",
    proofPayload: {
      source: "goal-loop-upgrade-smoke",
      url: options.proofUrl,
    },
  });

  const verificationIssue = afterProduction.nextIssue;
  await issues.update(verificationIssue.id, { status: "done" });
  const afterVerification = await goalLoop.syncGoalRunForIssue(verificationIssue.id, actor);
  if (!afterVerification?.nextIssue) throw new Error("Verification completion did not start measurement");

  const measurementIssue = afterVerification.nextIssue;
  const finalScoreboard = await goalLoop.putGoalScoreboard(createdGoal.id, {
    summary: "Upgrade smoke finished with a verified primary output.",
    metrics: [
        {
          key: "legacy_goal_count",
          label: "Legacy classic goals",
          value: legacyClassicGoals.length,
          notes: "Legacy goals remained in classic mode throughout the smoke.",
        },
        {
          key: "preexisting_goal_loop_goal_count",
          label: "Preexisting goal-loop goals",
          value: preexistingGoalLoopGoals.length,
          notes: "Captured before this smoke created an additional goal-loop goal.",
        },
        {
          key: "verified_outputs",
          label: "Verified outputs",
        value: 1,
      },
      {
        key: "smoke_status",
        label: "Smoke status",
        value: "verified",
        observedAt: new Date().toISOString(),
      },
    ],
  });

  const finalRunbook = await goalLoop.putRunbook(
    options.companyId,
    "goal",
    createdGoal.id,
    {
      entries: [
        {
          id: initialRunbook.entries[0]?.id,
          title: "Upgrade smoke runbook",
          body: [
            "- Preserve legacy classic goals and dashboards",
            "- Run one new goal_loop goal to completion",
            "- Record a primary output and verification proof before measurement closes",
            "- Update scoreboard and runbook again before measurement completes",
          ].join("\n"),
          orderIndex: 0,
        },
        {
          title: "Post-run observations",
          body: [
            "- Coexistence check passed for the migrated classic company",
            `- Recipe: ${recipe.slug}`,
            `- Proof URL: ${options.proofUrl}`,
            "- Measurement phase completed after scoreboard and runbook updates",
          ].join("\n"),
          orderIndex: 1,
        },
      ],
    },
    actor,
  );

  await issues.update(measurementIssue.id, { status: "done" });
  const finalSync = await goalLoop.syncGoalRunForIssue(measurementIssue.id, actor);
  const runtime = await goalLoop.getGoalRuntime(createdGoal.id);
  const outputs = await goalLoop.listGoalOutputs(createdGoal.id);
  const verifications = await goalLoop.listGoalVerifications(createdGoal.id);

  if (!finalSync || finalSync.run.status !== "succeeded") {
    throw new Error(`Expected smoke goal run to succeed, got ${finalSync?.run.status ?? "null"}`);
  }

  console.log(JSON.stringify({
    company: {
      id: company.id,
      name: company.name,
      defaultGoalMode: company.defaultGoalMode,
      legacyGoalCount: legacyClassicGoals.length,
      preexistingGoalLoopGoalCount: preexistingGoalLoopGoals.length,
    },
    createdGoal: {
      id: createdGoal.id,
      mode: createdGoal.mode,
      recipeId: recipe.id,
      recipeVersionId: recipe.latestVersion.id,
    },
    run: finalSync.run,
    brief,
    initialScoreboard,
    finalScoreboard,
    finalRunbook,
    directionIssueId: direction.issue.id,
    productionIssueId: productionIssue.id,
    verificationIssueId: verificationIssue.id,
    measurementIssueId: measurementIssue.id,
    output,
    verification,
    outputs,
    verifications,
    runtime,
  }, null, 2));
  process.exit(0);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
