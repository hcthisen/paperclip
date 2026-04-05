import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { goalLoopApi } from "../api/goal-loop";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { GoalProperties } from "../components/GoalProperties";
import { GoalTree } from "../components/GoalTree";
import { InlineEditor } from "../components/InlineEditor";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { usePanel } from "../context/PanelContext";
import { queryKeys } from "../lib/queryKeys";
import { projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Plus, Save, ShieldCheck } from "lucide-react";

function safeJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function GoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const { data: goal, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.detail(goalId!),
    queryFn: () => goalsApi.get(goalId!),
    enabled: Boolean(goalId),
  });
  const resolvedCompanyId = goal?.companyId ?? selectedCompanyId;

  const { data: allGoals = [] } = useQuery({
    queryKey: queryKeys.goals.list(resolvedCompanyId!),
    queryFn: () => goalsApi.list(resolvedCompanyId!),
    enabled: Boolean(resolvedCompanyId),
  });
  const { data: allProjects = [] } = useQuery({
    queryKey: queryKeys.projects.list(resolvedCompanyId!),
    queryFn: () => projectsApi.list(resolvedCompanyId!),
    enabled: Boolean(resolvedCompanyId),
  });
  const { data: allAgents = [] } = useQuery({
    queryKey: queryKeys.agents.list(resolvedCompanyId!),
    queryFn: () => agentsApi.list(resolvedCompanyId!),
    enabled: Boolean(resolvedCompanyId),
  });

  const goalLoopEnabled = goal?.mode === "goal_loop";
  const { data: brief } = useQuery({
    queryKey: queryKeys.goals.brief(goalId!),
    queryFn: () => goalLoopApi.getGoalBrief(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: runtime } = useQuery({
    queryKey: queryKeys.goals.runtime(goalId!),
    queryFn: () => goalLoopApi.getGoalRuntime(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: runs = [] } = useQuery({
    queryKey: queryKeys.goals.runs(goalId!),
    queryFn: () => goalLoopApi.listGoalRuns(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: outputs = [] } = useQuery({
    queryKey: queryKeys.goals.outputs(goalId!),
    queryFn: () => goalLoopApi.listGoalOutputs(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: verifications = [] } = useQuery({
    queryKey: queryKeys.goals.verifications(goalId!),
    queryFn: () => goalLoopApi.listGoalVerifications(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: runbook } = useQuery({
    queryKey: queryKeys.goals.runbook(goalId!),
    queryFn: () => goalLoopApi.getGoalRunbook(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: scoreboard } = useQuery({
    queryKey: queryKeys.goals.scoreboard(goalId!),
    queryFn: () => goalLoopApi.getGoalScoreboard(goalId!),
    enabled: Boolean(goalLoopEnabled && goalId),
  });
  const { data: recipes = [] } = useQuery({
    queryKey: queryKeys.goalLoop.recipes(resolvedCompanyId!),
    queryFn: () => goalLoopApi.listRecipes(resolvedCompanyId!),
    enabled: Boolean(goalLoopEnabled && resolvedCompanyId),
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", resolvedCompanyId, "goal", goalId],
    queryFn: () => activityApi.list(resolvedCompanyId!, { entityType: "goal", entityId: goalId! }),
    enabled: Boolean(resolvedCompanyId && goalId),
  });

  const [briefBody, setBriefBody] = useState("");
  const [briefStatus, setBriefStatus] = useState("draft");
  const [briefFinishLine, setBriefFinishLine] = useState("");
  const [briefCurrentState, setBriefCurrentState] = useState("");
  const [briefFinishCriteriaJson, setBriefFinishCriteriaJson] = useState("[]");
  const [briefAccessJson, setBriefAccessJson] = useState("[]");
  const [briefLaunchChecklist, setBriefLaunchChecklist] = useState("");
  const [recipeVersionId, setRecipeVersionId] = useState("");
  const [scoreboardSummary, setScoreboardSummary] = useState("");
  const [scoreboardMetricsJson, setScoreboardMetricsJson] = useState("[]");
  const [runbookJson, setRunbookJson] = useState("[]");
  const [wakeMessage, setWakeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!goal?.companyId || goal.companyId === selectedCompanyId) return;
    setSelectedCompanyId(goal.companyId, { source: "route_sync" });
  }, [goal?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Goals", href: "/goals" },
      { label: goal?.title ?? goalId ?? "Goal" },
    ]);
  }, [goal, goalId, setBreadcrumbs]);

  useEffect(() => {
    if (!goal) return;
    openPanel(<GoalProperties goal={goal} onUpdate={(data) => updateGoal.mutate(data)} />);
    return () => closePanel();
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setBriefBody(brief?.body ?? "");
    setBriefStatus(brief?.status ?? "draft");
    setBriefFinishLine(brief?.finishLine ?? "");
    setBriefCurrentState(brief?.currentStateSummary ?? "");
    setBriefFinishCriteriaJson(JSON.stringify(brief?.finishCriteria ?? [], null, 2));
    setBriefAccessJson(JSON.stringify(brief?.accessChecklist ?? [], null, 2));
    setBriefLaunchChecklist((brief?.launchChecklist ?? []).join("\n"));
    setRecipeVersionId(brief?.recipeVersionId ?? "");
  }, [brief]);

  useEffect(() => {
    setScoreboardSummary(scoreboard?.summary ?? "");
    setScoreboardMetricsJson(JSON.stringify(scoreboard?.metrics ?? [], null, 2));
  }, [scoreboard]);

  useEffect(() => {
    setRunbookJson(JSON.stringify(runbook?.entries ?? [], null, 2));
  }, [runbook]);

  const updateGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) => goalsApi.update(goalId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(goalId!) });
      if (resolvedCompanyId) queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(resolvedCompanyId) });
    },
  });

  const saveBrief = useMutation({
    mutationFn: () => {
      const selectedRecipe = recipes.find((entry) => String((entry as { latestVersion?: { id?: string } | null }).latestVersion?.id ?? "") === recipeVersionId) ?? null;
      return goalLoopApi.putGoalBrief(goalId!, {
        status: briefStatus,
        recipeId: selectedRecipe?.id ?? null,
        recipeVersionId: recipeVersionId || null,
        body: briefBody,
        finishLine: briefFinishLine || null,
        currentStateSummary: briefCurrentState || null,
        finishCriteria: safeJson(briefFinishCriteriaJson, []),
        accessChecklist: safeJson(briefAccessJson, []),
        launchChecklist: briefLaunchChecklist.split("\n").map((line) => line.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.brief(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
    },
  });

  const saveScoreboard = useMutation({
    mutationFn: () => goalLoopApi.putGoalScoreboard(goalId!, { summary: scoreboardSummary || null, metrics: safeJson(scoreboardMetricsJson, []) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.scoreboard(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
      if (resolvedCompanyId) queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(resolvedCompanyId) });
    },
  });

  const saveRunbook = useMutation({
    mutationFn: () => goalLoopApi.putGoalRunbook(goalId!, { entries: safeJson(runbookJson, []) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runbook(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
    },
  });

  const executeGoal = useMutation({
    mutationFn: () => goalLoopApi.executeGoal(goalId!, {}),
    onSuccess: () => {
      setWakeMessage(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runs(goalId!) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(resolvedCompanyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(resolvedCompanyId) });
      }
    },
  });

  const wakeGoalRun = useMutation({
    mutationFn: () => goalLoopApi.wakeGoalRun(runtime?.activeRun?.id ?? ""),
    onSuccess: (result) => {
      setWakeMessage(
        result.status === "queued"
          ? "Goal wake queued."
          : result.reason === "no_actionable_goal_work"
            ? "No actionable goal work is available right now."
            : "Goal wake was skipped.",
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runs(goalId!) });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.goalLoop.health(resolvedCompanyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(resolvedCompanyId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(resolvedCompanyId) });
      }
    },
  });

  const verifyOutput = useMutation({
    mutationFn: (input: { outputId: string; verdict: string; summary: string }) =>
      goalLoopApi.createOutputVerification(input.outputId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.outputs(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.verifications(goalId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.runtime(goalId!) });
      if (resolvedCompanyId) queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(resolvedCompanyId) });
    },
  });

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!goal) return null;

  const childGoals = allGoals.filter((entry) => entry.parentId === goal.id);
  const linkedProjects = allProjects.filter((project) => {
    if (!goalId) return false;
    return project.goalId === goalId || project.goalIds.includes(goalId) || project.goals.some((goalRef) => goalRef.id === goalId);
  });
  const agentName = (agentId: string | null | undefined) =>
    agentId ? allAgents.find((agent) => agent.id === agentId)?.name ?? null : null;
  const nextWakeAgentName = agentName(runtime?.nextWakeTarget?.agentId ?? null);

  if (!goalLoopEnabled) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-muted-foreground">{goal.level}</span>
            <StatusBadge status={goal.status} />
            <StatusBadge status={goal.mode ?? "classic"} />
          </div>
          <InlineEditor value={goal.title} onSave={(title) => updateGoal.mutate({ title })} as="h2" className="text-xl font-bold" />
          <InlineEditor
            value={goal.description ?? ""}
            onSave={(description) => updateGoal.mutate({ description })}
            as="p"
            className="text-sm text-muted-foreground"
            placeholder="Add a description..."
            multiline
          />
        </div>
        <Tabs defaultValue="children">
          <TabsList>
            <TabsTrigger value="children">Sub-Goals ({childGoals.length})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({linkedProjects.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="children" className="mt-4 space-y-3">
            <Button size="sm" variant="outline" onClick={() => openNewGoal({ parentId: goalId })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Sub Goal
            </Button>
            {childGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sub-goals.</p>
            ) : (
              <GoalTree goals={childGoals} goalLink={(entry) => `/goals/${entry.id}`} />
            )}
          </TabsContent>
          <TabsContent value="projects" className="mt-4">
            {linkedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked projects.</p>
            ) : (
              <div className="border border-border">
                {linkedProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={projectUrl(project)}
                    className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div>
                      <div className="font-medium">{project.name}</div>
                      <div className="text-sm text-muted-foreground">{project.description ?? "No description"}</div>
                    </div>
                    <StatusBadge status={project.status} />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">{goal.level}</span>
          <StatusBadge status={goal.status} />
          <StatusBadge status={goal.mode ?? "goal_loop"} />
          {runtime?.activeRun ? <StatusBadge status={runtime.activeRun.status} /> : null}
        </div>
        <InlineEditor value={goal.title} onSave={(title) => updateGoal.mutate({ title })} as="h2" className="text-xl font-bold" />
        <InlineEditor
          value={goal.description ?? ""}
          onSave={(description) => updateGoal.mutate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Brief</div>
          <div className="mt-2 text-2xl font-semibold">{brief?.status ?? "missing"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{brief?.accessChecklist.length ?? 0} access checks</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Current Phase</div>
          <div className="mt-2 text-2xl font-semibold">{runtime?.activeRun?.currentPhase ?? "idle"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{runtime?.activeRun?.status ?? "No active run"}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Outputs</div>
          <div className="mt-2 text-2xl font-semibold">{runtime?.verifiedOutputCount ?? 0}</div>
          <div className="mt-1 text-xs text-muted-foreground">{runtime?.outputsPendingVerification ?? 0} pending verification</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost / Verified</div>
          <div className="mt-2 text-2xl font-semibold">
            {runtime?.costs.costPerVerifiedOutputCents != null ? `$${(runtime.costs.costPerVerifiedOutputCents / 100).toFixed(2)}` : "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">${((runtime?.costs.totalCostCents ?? 0) / 100).toFixed(2)} total tracked</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-medium">Goal Loop Runtime</div>
            <div className="text-sm text-muted-foreground">
              Goal-loop wakes should route to concrete work or stop with an explicit blocker.
            </div>
          </div>
          <Button
            onClick={() => wakeGoalRun.mutate()}
            disabled={!runtime?.activeRun || wakeGoalRun.isPending}
            variant="outline"
          >
            <Play className="mr-1.5 h-4 w-4" />
            {wakeGoalRun.isPending ? "Waking..." : "Wake Goal"}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border border-border/70 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Actionable Issue</div>
            <div className="mt-2 font-medium">
              {runtime?.actionableIssueId ? (
                <Link to={`/issues/${runtime.actionableIssueId}`} className="underline underline-offset-2">
                  {runtime.actionableIssueId}
                </Link>
              ) : (
                "None"
              )}
            </div>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Next Wake Target</div>
            <div className="mt-2 font-medium">
              {runtime?.nextWakeTarget
                ? `${nextWakeAgentName ?? runtime.nextWakeTarget.agentId ?? "Unassigned"} · ${runtime.nextWakeTarget.goalRunPhase ?? "unknown"}`
                : "No runnable target"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {runtime?.nextWakeTarget?.reason ?? "Waiting for the next actionable phase"}
            </div>
          </div>
          <div className="rounded-md border border-border/70 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Worker Queue</div>
            <div className="mt-2 font-medium">{runtime?.activeWorkerIssueCount ?? 0} active worker issues</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {runtime?.humanDecisionRequired ? "Human decision required before this goal can continue." : "Ready to keep progressing when work is actionable."}
            </div>
          </div>
        </div>
        {runtime?.humanDecisionRequired ? (
          <div className="mt-4 rounded-md border border-amber-300/60 bg-amber-50/80 p-3 text-sm text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="font-medium">Blocked by human decision</div>
            <div className="mt-1">{runtime.blockedBy ?? "This goal is waiting for a human to clear a blocker."}</div>
          </div>
        ) : null}
        {wakeMessage ? (
          <div className="mt-3 text-sm text-muted-foreground">{wakeMessage}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <div className="font-medium">Launch the next goal run</div>
          <div className="text-sm text-muted-foreground">Runs advance across direction, production, verification, and measurement.</div>
        </div>
        <Button onClick={() => executeGoal.mutate()} disabled={executeGoal.isPending || brief?.status !== "ready"}>
          <Play className="mr-1.5 h-4 w-4" />
          {executeGoal.isPending ? "Launching..." : "Launch Run"}
        </Button>
      </div>

      <Tabs defaultValue="brief">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="brief">Brief</TabsTrigger>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="outputs">Outputs</TabsTrigger>
          <TabsTrigger value="scoreboard">Scoreboard</TabsTrigger>
          <TabsTrigger value="runbook">Runbook</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="brief" className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Recipe Version</span>
            <select
              value={recipeVersionId}
              onChange={(event) => setRecipeVersionId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a recipe</option>
              {recipes.map((entry) => {
                const latestVersion = (entry as { latestVersion?: { id?: string; title?: string } | null }).latestVersion;
                if (!latestVersion?.id) return null;
                return (
                  <option key={latestVersion.id} value={latestVersion.id}>
                    {entry.name} · {latestVersion.title ?? latestVersion.id}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
            <select
              value={briefStatus}
              onChange={(event) => setBriefStatus(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="draft">draft</option>
              <option value="ready">ready</option>
            </select>
          </label>
          <input
            value={briefFinishLine}
            onChange={(event) => setBriefFinishLine(event.target.value)}
            placeholder="Finish line"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={briefCurrentState}
            onChange={(event) => setBriefCurrentState(event.target.value)}
            rows={4}
            placeholder="Current state summary"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={briefBody}
            onChange={(event) => setBriefBody(event.target.value)}
            rows={10}
            placeholder="Goal brief body"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={briefFinishCriteriaJson}
            onChange={(event) => setBriefFinishCriteriaJson(event.target.value)}
            rows={8}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={briefAccessJson}
            onChange={(event) => setBriefAccessJson(event.target.value)}
            rows={8}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={briefLaunchChecklist}
            onChange={(event) => setBriefLaunchChecklist(event.target.value)}
            rows={6}
            placeholder="One launch checklist item per line"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={() => saveBrief.mutate()} disabled={saveBrief.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {saveBrief.isPending ? "Saving..." : "Save Brief"}
          </Button>
        </TabsContent>

        <TabsContent value="runs" className="mt-4 space-y-3">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goal runs yet.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={run.status} />
                  <StatusBadge status={run.currentPhase} />
                  {run.latestIssueId ? <Link to={`/issues/${run.latestIssueId}`} className="text-sm underline underline-offset-2">Latest issue</Link> : null}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"} · Finished: {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "—"}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="outputs" className="mt-4 space-y-3">
          {outputs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outputs recorded yet.</p>
          ) : (
            outputs.map((output) => (
              <div key={output.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{output.title}</span>
                      {output.outputStatus ? <StatusBadge status={output.outputStatus} /> : null}
                      {output.outputType ? <StatusBadge status={output.outputType} /> : null}
                      {output.isPrimary ? <StatusBadge status="primary" /> : null}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {output.url ? <a href={output.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Open output</a> : "No URL recorded"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => verifyOutput.mutate({ outputId: output.id, verdict: "passed", summary: "Verified in board UI" })} disabled={verifyOutput.isPending}>
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Verify
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => verifyOutput.mutate({ outputId: output.id, verdict: "failed", summary: "Verification failed in board UI" })} disabled={verifyOutput.isPending}>
                      Fail
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => verifyOutput.mutate({ outputId: output.id, verdict: "needs_human_decision", summary: "Needs human review" })} disabled={verifyOutput.isPending}>
                      Review
                    </Button>
                  </div>
                </div>
                {(verifications.filter((verification) => verification.outputId === output.id)).length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    {verifications
                      .filter((verification) => verification.outputId === output.id)
                      .map((verification) => (
                        <div key={verification.id}>
                          <span className="font-medium text-foreground">{verification.verdict}</span>
                          {" · "}
                          {verification.summary ?? "No summary"}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="scoreboard" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            {Object.entries(runtime?.costs.byPhase ?? {}).map(([phase, cents]) => (
              <div key={phase} className="flex items-center justify-between py-1">
                <span className="capitalize">{phase}</span>
                <span>${((Number(cents) ?? 0) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <textarea
            value={scoreboardSummary}
            onChange={(event) => setScoreboardSummary(event.target.value)}
            rows={5}
            placeholder="Scoreboard summary"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={scoreboardMetricsJson}
            onChange={(event) => setScoreboardMetricsJson(event.target.value)}
            rows={10}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={() => saveScoreboard.mutate()} disabled={saveScoreboard.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {saveScoreboard.isPending ? "Saving..." : "Save Scoreboard"}
          </Button>
        </TabsContent>

        <TabsContent value="runbook" className="mt-4 space-y-4">
          <textarea
            value={runbookJson}
            onChange={(event) => setRunbookJson(event.target.value)}
            rows={14}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={() => saveRunbook.mutate()} disabled={saveRunbook.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {saveRunbook.isPending ? "Saving..." : "Save Runbook"}
          </Button>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goal activity yet.</p>
          ) : (
            activity.map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium">{event.action}</div>
                <div className="text-sm text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Button size="sm" variant="outline" onClick={() => openNewGoal({ parentId: goalId })}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Sub Goal
      </Button>
    </div>
  );
}
