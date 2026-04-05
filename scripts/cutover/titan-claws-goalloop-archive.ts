import path from "node:path";
import { createDb } from "../../packages/db/src/client.ts";
import {
  buildTitanClawsCutoverDefinition,
  goalLoopCutoverService,
  type TitanClawsArchivedIssue,
} from "../../server/src/services/goal-loop-cutover.ts";
import {
  booleanArg,
  parseArgs,
  requireStringArg,
  writeJsonFile,
  writeTextFile,
} from "./titan-claws-goalloop-lib.ts";

function renderIssue(issue: TitanClawsArchivedIssue) {
  const identifier = issue.identifier ?? issue.id;
  const destination = issue.classification.goalKey ?? "parking_lot";
  return `- ${identifier}: ${issue.title} [${issue.status}] -> ${destination} / ${issue.classification.disposition}`;
}

function renderSummary(input: {
  archive: Awaited<ReturnType<ReturnType<typeof goalLoopCutoverService>["buildTitanClawsCutoverArchive"]>>;
  definition: ReturnType<typeof buildTitanClawsCutoverDefinition>;
}) {
  const { archive, definition } = input;
  return [
    "# Titan Claws GoalLoop Archive",
    "",
    `Generated: ${archive.generatedAt.toISOString()}`,
    `Company: ${archive.company.name} (${archive.company.id})`,
    `Current default goal mode: ${archive.company.defaultGoalMode ?? "null"}`,
    "",
    "## Snapshot",
    `- Legacy classic goals: ${archive.legacyGoals.length}`,
    `- Existing goal-loop goals: ${archive.existingGoalLoopGoals.length}`,
    `- Open classic issues archived: ${archive.openIssues.length}`,
    `- Active classic heartbeat runs: ${archive.activeHeartbeatRuns.length}`,
    `- Agents recommended for pause: ${archive.recommendations.agentIdsToPause.length}`,
    `- First GoalLoop goal: ${definition.firstGoalTitle}`,
    "",
    "## Goal backlog mapping",
    ...archive.backlogByGoal.map((entry) => `- ${entry.goalTitle}: ${entry.openIssueCount} archived open issue(s)`),
    `- Parking lot: ${archive.parkedIssueCount} archived open issue(s)`,
    "",
    "## Open classic issues",
    ...(archive.openIssues.length > 0 ? archive.openIssues.map(renderIssue) : ["- None"]),
    "",
    "## Launch order",
    ...definition.goals.map((goal, index) => `- ${index + 1}. ${goal.title} (${goal.briefStatus})`),
    "",
    "## Notes",
    "- This archive is non-secret operational state. Keep rollback bundles and config copies outside the repo.",
    "- Treat the JSON files in this folder as the source material for the cutover repo note and VPS bundle.",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = requireStringArg(args, "db-url");
  const companyId = requireStringArg(args, "company-id");
  const outDir = requireStringArg(args, "out-dir");
  const jsonOnly = booleanArg(args, "json");

  const db = createDb(dbUrl);
  const svc = goalLoopCutoverService(db);
  const archive = await svc.buildTitanClawsCutoverArchive(companyId);
  const definition = buildTitanClawsCutoverDefinition(archive);

  if (jsonOnly) {
    console.log(
      JSON.stringify(
        {
          archive,
          definition,
        },
        null,
        2,
      ),
    );
    return;
  }

  await writeJsonFile(path.join(outDir, "archive.json"), archive);
  await writeJsonFile(path.join(outDir, "cutover-definition.json"), definition);
  await writeTextFile(path.join(outDir, "SUMMARY.md"), renderSummary({ archive, definition }));

  console.log(`Titan Claws archive written to ${outDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
