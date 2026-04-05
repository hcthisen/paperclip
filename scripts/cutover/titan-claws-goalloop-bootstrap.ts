import { createDb } from "../../packages/db/src/client.ts";
import { buildTitanClawsCutoverDefinition, goalLoopCutoverService } from "../../server/src/services/goal-loop-cutover.ts";
import {
  booleanArg,
  optionalStringArg,
  parseArgs,
  requireStringArg,
  writeJsonFile,
} from "./titan-claws-goalloop-lib.ts";

function renderPreview(input: {
  companyId: string;
  definition: ReturnType<typeof buildTitanClawsCutoverDefinition>;
  pauseCount: number;
}) {
  const { definition, pauseCount } = input;
  return [
    "# Titan Claws GoalLoop Bootstrap Preview",
    "",
    `- Company id: ${input.companyId}`,
    `- First goal: ${definition.firstGoalTitle}`,
    `- Agents to pause: ${pauseCount}`,
    `- Goals to seed: ${definition.goals.length}`,
    "",
    "## Goals",
    ...definition.goals.map(
      (goal, index) =>
        `- ${index + 1}. ${goal.title} [goal status: ${goal.status}, brief: ${goal.briefStatus}, recipe: ${goal.recipeSlug}]`,
    ),
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = requireStringArg(args, "db-url");
  const companyId = requireStringArg(args, "company-id");
  const actorUserId = optionalStringArg(args, "actor-user-id") ?? "titan-claws-goalloop-cutover";
  const apply = booleanArg(args, "apply");
  const launchFirstGoal = booleanArg(args, "launch-first-goal");
  const jsonOut = booleanArg(args, "json");
  const outFile = optionalStringArg(args, "out-file");

  const db = createDb(dbUrl);
  const svc = goalLoopCutoverService(db);

  if (!apply) {
    const archive = await svc.buildTitanClawsCutoverArchive(companyId);
    const definition = buildTitanClawsCutoverDefinition(archive);
    const preview = {
      archive,
      definition,
      pauseAgentCount: archive.recommendations.agentIdsToPause.length,
    };

    if (outFile) {
      await writeJsonFile(outFile, preview);
    }

    if (jsonOut) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }

    console.log(renderPreview({ companyId, definition, pauseCount: archive.recommendations.agentIdsToPause.length }));
    return;
  }

  const result = await svc.applyTitanClawsGoalLoopCutover(companyId, {
    actor: { userId: actorUserId },
    launchFirstGoal,
  });

  if (outFile) {
    await writeJsonFile(outFile, result);
  }

  if (jsonOut) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    [
      `Cutover applied for ${result.companyId}.`,
      `Default goal mode: ${result.defaultGoalMode ?? "null"}`,
      `Paused classic agents: ${result.pausedAgentIds.length}`,
      `Goal-loop goals seeded: ${result.goals.length}`,
      launchFirstGoal && result.firstLaunch
        ? `First goal launched: ${result.firstLaunch.goalId} run ${result.firstLaunch.runId}`
        : "First goal launch not requested.",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
