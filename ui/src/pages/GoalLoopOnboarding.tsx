import { useMemo, useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companiesApi } from "../api/companies";
import { goalLoopApi } from "../api/goal-loop";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Rocket } from "lucide-react";

function toChecklist(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({
      key: `item_${index + 1}`,
      label,
      status: "ready",
      notes: null,
    }));
}

function toFinishCriteria(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((label, index) => ({
      id: `criterion-${index + 1}`,
      label,
      description: null,
    }));
}

export function GoalLoopOnboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const { companies, setSelectedCompanyId } = useCompany();
  const { openOnboarding } = useDialog();

  const matchedCompany = useMemo(
    () =>
      companyPrefix
        ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
        : null,
    [companies, companyPrefix],
  );

  const [step, setStep] = useState(matchedCompany ? 2 : 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(matchedCompany?.id ?? null);
  const [companyName, setCompanyName] = useState(matchedCompany?.name ?? "");
  const [contextMission, setContextMission] = useState("");
  const [contextCustomer, setContextCustomer] = useState("");
  const [contextConstraints, setContextConstraints] = useState("");
  const [goalTitle, setGoalTitle] = useState("Ship a measurable outcome");
  const [goalDescription, setGoalDescription] = useState("");
  const [goalTimeframe, setGoalTimeframe] = useState("30 days");
  const [goalKpiFamily, setGoalKpiFamily] = useState("growth");
  const [finishLine, setFinishLine] = useState("");
  const [briefBody, setBriefBody] = useState("");
  const [currentStateSummary, setCurrentStateSummary] = useState("");
  const [finishCriteria, setFinishCriteria] = useState("");
  const [accessChecklist, setAccessChecklist] = useState("Analytics access\nPublishing access");
  const [launchChecklist, setLaunchChecklist] = useState("Start first run\nReview outputs\nUpdate scoreboard and runbook");
  const [selectedRecipeVersionId, setSelectedRecipeVersionId] = useState("");

  const { data: recipes = [] } = useQuery({
    queryKey: queryKeys.goalLoop.recipes(companyId ?? "__pending__"),
    queryFn: () => goalLoopApi.listRecipes(companyId!),
    enabled: Boolean(companyId),
  });

  async function handleNext() {
    setError(null);
    if (step === 1) {
      if (!companyName.trim()) return;
      setSubmitting(true);
      try {
        const company = await companiesApi.create({ name: companyName.trim() });
        setCompanyId(company.id);
        setSelectedCompanyId(company.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create company");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep((current) => Math.min(current + 1, 6));
  }

  async function handleLaunch() {
    if (!companyId) return;
    setSubmitting(true);
    setError(null);
    try {
      await goalLoopApi.putContextPack(companyId, {
        sections: [
          { key: "mission", title: "Mission", body: contextMission, orderIndex: 0 },
          { key: "customer", title: "Customer", body: contextCustomer, orderIndex: 1 },
          { key: "constraints", title: "Constraints", body: contextConstraints, orderIndex: 2 },
        ],
      });

      const goal = await goalsApi.create(companyId, {
        title: goalTitle,
        description: goalDescription || null,
        level: "company",
        status: "active",
        mode: "goal_loop",
        timeframe: goalTimeframe || null,
        kpiFamily: goalKpiFamily || null,
        currentStateSummary: currentStateSummary || null,
      });

      const selectedRecipe = recipes.find(
        (entry) => String((entry as { latestVersion?: { id?: string } | null }).latestVersion?.id ?? "") === selectedRecipeVersionId,
      ) ?? null;

      await goalLoopApi.putGoalBrief(goal.id, {
        status: "ready",
        recipeId: selectedRecipe?.id ?? null,
        recipeVersionId: selectedRecipeVersionId || null,
        body: briefBody,
        finishLine: finishLine || null,
        kpiFamily: goalKpiFamily || null,
        timeframe: goalTimeframe || null,
        currentStateSummary: currentStateSummary || null,
        finishCriteria: toFinishCriteria(finishCriteria),
        accessChecklist: toChecklist(accessChecklist),
        launchChecklist: launchChecklist.split("\n").map((line) => line.trim()).filter(Boolean),
      });

      await goalLoopApi.putGoalScoreboard(goal.id, {
        summary: "Baseline captured before first goal-loop measurement.",
        metrics: [],
      });

      await goalLoopApi.putGoalRunbook(goal.id, {
        entries: [
          {
            title: "Next action after launch",
            body: "Review the first run, verify the primary output, update the scoreboard, and record the next action here.",
            orderIndex: 0,
          },
        ],
      });

      await goalLoopApi.executeGoal(goal.id, {});

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.list(companyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(companyId) }),
      ]);
      setSelectedCompanyId(companyId);
      navigate(`/goals/${goal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch goal loop");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-10">
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">Goal Loop Onboarding</p>
            <h1 className="mt-2 text-3xl font-semibold">Build the company around the outcome first</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              This flow creates a goal-loop company context, binds a recipe, launches the first run, and leaves the older
              agent-and-task setup available as the advanced classic path.
            </p>
          </div>
          <Button variant="outline" onClick={() => openOnboarding(matchedCompany ? { initialStep: 2, companyId: matchedCompany.id } : {})}>
            Open Classic Setup
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {["Company", "Context", "Goal", "Brief", "Recipe", "Launch"].map((label, index) => (
            <span
              key={label}
              className={`rounded-full px-3 py-1 ${step === index + 1 ? "bg-foreground text-background" : "border border-border"}`}
            >
              {index + 1}. {label}
            </span>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {step === 1 ? (
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Company name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-3">
              <textarea value={contextMission} onChange={(event) => setContextMission(event.target.value)} rows={8} placeholder="Mission and objective context" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={contextCustomer} onChange={(event) => setContextCustomer(event.target.value)} rows={8} placeholder="Customer and market context" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={contextConstraints} onChange={(event) => setContextConstraints(event.target.value)} rows={8} placeholder="Constraints, policies, and resources" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="Goal title" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <input value={goalTimeframe} onChange={(event) => setGoalTimeframe(event.target.value)} placeholder="Timeframe" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <input value={goalKpiFamily} onChange={(event) => setGoalKpiFamily(event.target.value)} placeholder="KPI family" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} rows={6} placeholder="Goal description" className="md:col-span-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <input value={finishLine} onChange={(event) => setFinishLine(event.target.value)} placeholder="Finish line" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={currentStateSummary} onChange={(event) => setCurrentStateSummary(event.target.value)} rows={4} placeholder="Current state summary" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={briefBody} onChange={(event) => setBriefBody(event.target.value)} rows={10} placeholder="Goal brief body" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={finishCriteria} onChange={(event) => setFinishCriteria(event.target.value)} rows={6} placeholder="One finish criterion per line" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={accessChecklist} onChange={(event) => setAccessChecklist(event.target.value)} rows={6} placeholder="One access checklist item per line" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <select
                value={selectedRecipeVersionId}
                onChange={(event) => setSelectedRecipeVersionId(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select a recipe version</option>
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
              <textarea value={launchChecklist} onChange={(event) => setLaunchChecklist(event.target.value)} rows={8} placeholder="One launch checklist item per line" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>
          ) : null}

          {step === 6 ? (
            <div className="rounded-xl border border-border bg-background p-5">
              <div className="text-sm font-medium">{companyName || matchedCompany?.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">{goalTitle}</div>
              <div className="mt-4 text-sm text-muted-foreground">
                Launching will save the context pack, create a goal-loop goal, write the brief, seed the scoreboard and runbook,
                and start the first goal run.
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div>
            {step > (matchedCompany ? 2 : 1) ? (
              <Button variant="ghost" onClick={() => setStep((current) => Math.max(current - 1, matchedCompany ? 2 : 1))} disabled={submitting}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {step < 6 ? (
              <Button onClick={() => void handleNext()} disabled={submitting || (step === 5 && !selectedRecipeVersionId)}>
                <ArrowRight className="mr-1.5 h-4 w-4" />
                {submitting ? "Working..." : "Next"}
              </Button>
            ) : (
              <Button onClick={() => void handleLaunch()} disabled={submitting}>
                <Rocket className="mr-1.5 h-4 w-4" />
                {submitting ? "Launching..." : "Launch Goal Loop"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
