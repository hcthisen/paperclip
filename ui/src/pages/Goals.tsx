import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalTree } from "../components/GoalTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Target, Plus } from "lucide-react";

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Goals" }]);
  }, [setBreadcrumbs]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Target} message="Select a company to view goals." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          message="No goals yet."
          action="Add Goal"
          onAction={() => openNewGoal()}
        />
      )}

      {goals && goals.length > 0 && (
        <>
          <div className="flex items-center justify-start">
            <Button size="sm" variant="outline" onClick={() => openNewGoal()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Goal
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div>
              <GoalTree goals={goals} goalLink={(goal) => `/goals/${goal.id}`} />
            </div>
            <div className="space-y-3">
              {[...goals]
                .sort((a, b) => {
                  if (a.status === "active" && b.status !== "active") return -1;
                  if (a.status !== "active" && b.status === "active") return 1;
                  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                })
                .slice(0, 8)
                .map((goal) => (
                  <Link
                    key={goal.id}
                    to={`/goals/${goal.id}`}
                    className="block rounded-lg border border-border bg-card p-4 hover:bg-accent/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={goal.status} />
                      <StatusBadge status={goal.mode ?? "classic"} />
                    </div>
                    <div className="mt-2 font-medium">{goal.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {goal.level} goal
                      {goal.kpiFamily ? ` · ${goal.kpiFamily}` : ""}
                      {goal.timeframe ? ` · ${goal.timeframe}` : ""}
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
