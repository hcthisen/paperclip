import { createDb } from "../../packages/db/src/client.ts";
import { buildTitanClawsCutoverDefinition, goalLoopCutoverService } from "../../server/src/services/goal-loop-cutover.ts";
import { goalLoopService } from "../../server/src/services/goal-loop.ts";
import { goalService } from "../../server/src/services/goals.ts";
import { booleanArg, parseArgs, requireStringArg } from "./titan-claws-goalloop-lib.ts";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = requireStringArg(args, "db-url");
  const companyId = requireStringArg(args, "company-id");
  const jsonOut = booleanArg(args, "json");

  const db = createDb(dbUrl);
  const cutoverSvc = goalLoopCutoverService(db);
  const goalLoopSvc = goalLoopService(db);
  const goalsSvc = goalService(db);

  const archive = await cutoverSvc.buildTitanClawsCutoverArchive(companyId);
  const definition = buildTitanClawsCutoverDefinition(archive);
  const allGoals = await goalsSvc.list(companyId);
  const leases = await goalLoopSvc.listResourceLeases(companyId, { status: "active" });

  const goalStatuses = await Promise.all(
    definition.goals.map(async (definitionGoal) => {
      const goal = allGoals.find(
        (candidate) => candidate.title === definitionGoal.title && (candidate.mode ?? "classic") === "goal_loop",
      );
      if (!goal) {
        return {
          title: definitionGoal.title,
          exists: false,
          status: null,
          briefStatus: null,
          activeRunStatus: null,
          latestRunStatus: null,
          outputsPendingVerification: 0,
          verifiedOutputCount: 0,
        };
      }

      const runtime = await goalLoopSvc.getGoalRuntime(goal.id);
      return {
        title: definitionGoal.title,
        exists: true,
        status: goal.status,
        briefStatus: runtime.brief?.status ?? null,
        activeRunStatus: runtime.activeRun?.status ?? null,
        latestRunStatus: runtime.latestRun?.status ?? null,
        outputsPendingVerification: runtime.outputsPendingVerification,
        verifiedOutputCount: runtime.verifiedOutputCount,
      };
    }),
  );

  const payload = {
    companyId,
    defaultGoalMode: archive.company.defaultGoalMode,
    legacyOpenIssueCount: archive.openIssues.length,
    activeClassicHeartbeatRuns: archive.activeHeartbeatRuns.length,
    pausedAgentCount: archive.agents.filter((agent) => agent.status === "paused").length,
    activeLeaseCount: leases.length,
    firstGoal: definition.firstGoalTitle,
    goals: goalStatuses,
  };

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(
    [
      "# Titan Claws GoalLoop Monitor",
      "",
      `- Company id: ${companyId}`,
      `- Default goal mode: ${payload.defaultGoalMode ?? "null"}`,
      `- Legacy open issues still visible: ${payload.legacyOpenIssueCount}`,
      `- Active classic heartbeat runs: ${payload.activeClassicHeartbeatRuns}`,
      `- Paused agents: ${payload.pausedAgentCount}`,
      `- Active GoalLoop leases: ${payload.activeLeaseCount}`,
      "",
      "## Goal status",
      ...payload.goals.map((goal) =>
        `- ${goal.title}: ${goal.exists ? `goal=${goal.status}, brief=${goal.briefStatus}, activeRun=${goal.activeRunStatus ?? "none"}, latestRun=${goal.latestRunStatus ?? "none"}, verified=${goal.verifiedOutputCount}, pendingVerification=${goal.outputsPendingVerification}` : "not created"}`,
      ),
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
