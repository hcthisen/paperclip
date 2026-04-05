import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, goals, heartbeatRuns, issues, projects } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { agentService } from "./agents.js";
import { companyService } from "./companies.js";
import { goalLoopService } from "./goal-loop.js";
import { goalService } from "./goals.js";

type ActorInfo = {
  agentId?: string | null;
  userId?: string | null;
};

export type TitanClawsGoalKey =
  | "website_email_capture"
  | "email_list_growth"
  | "social_audience_growth"
  | "brand_consistency"
  | "product_validation"
  | "prototype_supplier_pipeline";

export type TitanClawsArchiveDisposition =
  | "context_fact"
  | "goal_current_state"
  | "runbook_next_action"
  | "parking_lot_reference";

export interface TitanClawsArchiveIssueClassification {
  goalKey: TitanClawsGoalKey | null;
  disposition: TitanClawsArchiveDisposition;
  reasons: string[];
}

export interface TitanClawsArchivedIssue {
  id: string;
  identifier: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string | null;
  projectName: string | null;
  goalId: string | null;
  goalTitle: string | null;
  assigneeAgentId: string | null;
  assigneeAgentName: string | null;
  updatedAt: Date;
  classification: TitanClawsArchiveIssueClassification;
}

export interface TitanClawsArchivedProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  goalId: string | null;
  goalTitle: string | null;
  openIssueCount: number;
  pausedAt: Date | null;
}

export interface TitanClawsArchivedGoal {
  id: string;
  title: string;
  description: string | null;
  level: string;
  status: string;
  mode: string | null;
}

export interface TitanClawsArchivedAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  pauseReason: string | null;
  pausedAt: Date | null;
  heartbeatEnabled: boolean;
  intervalSec: number;
  wakeOnDemand: boolean;
  maxConcurrentRuns: number;
}

export interface TitanClawsArchivedHeartbeatRun {
  id: string;
  agentId: string;
  agentName: string | null;
  status: string;
  invocationSource: string;
  goalId: string | null;
  goalTitle: string | null;
  goalRunId: string | null;
  goalRunPhase: string | null;
  issueId: string | null;
  issueTitle: string | null;
  createdAt: Date;
  startedAt: Date | null;
}

export interface TitanClawsGoalBacklogSummary {
  goalKey: TitanClawsGoalKey;
  goalTitle: string;
  openIssueCount: number;
  issueIdentifiers: string[];
}

export interface TitanClawsCutoverArchive {
  generatedAt: Date;
  company: {
    id: string;
    name: string;
    status: string;
    issuePrefix: string;
    issueCounter: number;
    defaultGoalMode: string | null;
  };
  legacyGoals: TitanClawsArchivedGoal[];
  existingGoalLoopGoals: TitanClawsArchivedGoal[];
  projects: TitanClawsArchivedProject[];
  agents: TitanClawsArchivedAgent[];
  activeHeartbeatRuns: TitanClawsArchivedHeartbeatRun[];
  openIssues: TitanClawsArchivedIssue[];
  backlogByGoal: TitanClawsGoalBacklogSummary[];
  parkedIssueCount: number;
  recommendations: {
    firstGoalKey: TitanClawsGoalKey;
    firstGoalTitle: string;
    agentIdsToPause: string[];
  };
}

export interface TitanClawsCutoverGoalSeed {
  key: TitanClawsGoalKey;
  title: string;
  status: "active" | "planned";
  briefStatus: "ready" | "draft";
  recipeSlug: "website_repair" | "social_growth" | "supplier_outreach";
  description: string;
  finishLine: string;
  kpiFamily: string;
  timeframe: string;
  currentStateSummary: string;
  body: string;
  finishCriteria: Array<{ id: string; label: string; description?: string | null }>;
  accessChecklist: Array<{ key: string; label: string; status: "ready" | "pending" | "blocked"; notes?: string | null }>;
  launchChecklist: string[];
  runbookEntries: Array<{ title: string; body: string }>;
  scoreboardSummary: string;
  scoreboardMetrics: Array<{ key: string; label: string; value: string | number | boolean | null; notes?: string | null }>;
}

export interface TitanClawsCutoverDefinition {
  companyName: string;
  firstGoalKey: TitanClawsGoalKey;
  firstGoalTitle: string;
  contextPackSections: Array<{ key: string; title: string; body: string; orderIndex: number }>;
  companyRunbookEntries: Array<{ title: string; body: string; orderIndex: number }>;
  goals: TitanClawsCutoverGoalSeed[];
}

export interface TitanClawsCutoverApplyOptions {
  actor: ActorInfo;
  pauseClassicAgents?: boolean;
  launchFirstGoal?: boolean;
}

export interface TitanClawsCutoverApplyResult {
  archive: TitanClawsCutoverArchive;
  definition: TitanClawsCutoverDefinition;
  companyId: string;
  defaultGoalMode: string | null;
  pausedAgentIds: string[];
  goals: Array<{
    key: TitanClawsGoalKey;
    goalId: string;
    title: string;
    status: string;
    briefStatus: string;
  }>;
  firstLaunch:
    | {
        goalId: string;
        runId: string;
        issueId: string | null;
        phase: string;
        status: string;
      }
    | null;
}

const OPEN_ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked"] as const;
const ACTIVE_HEARTBEAT_RUN_STATUSES = ["queued", "running"] as const;
const FIRST_GOAL_KEY: TitanClawsGoalKey = "website_email_capture";

const GOAL_TITLES: Record<TitanClawsGoalKey, string> = {
  website_email_capture: "Website and email capture conversion",
  email_list_growth: "Email list growth and nurture",
  social_audience_growth: "Social audience growth",
  brand_consistency: "Brand consistency across touchpoints",
  product_validation: "Product-market-fit and pre-sell validation",
  prototype_supplier_pipeline: "Prototype and supplier quote pipeline",
};

const GOAL_ORDER: TitanClawsGoalKey[] = [
  "website_email_capture",
  "email_list_growth",
  "social_audience_growth",
  "brand_consistency",
  "product_validation",
  "prototype_supplier_pipeline",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeText(...parts: Array<string | null | undefined>) {
  return parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function readHeartbeatPolicy(runtimeConfig: Record<string, unknown> | null | undefined) {
  const heartbeat = isRecord(runtimeConfig?.heartbeat) ? runtimeConfig.heartbeat : {};
  return {
    enabled: asBoolean(heartbeat.enabled, true),
    intervalSec: Math.max(0, asNumber(heartbeat.intervalSec, 0)),
    wakeOnDemand: asBoolean(
      heartbeat.wakeOnDemand ?? heartbeat.wakeOnAssignment ?? heartbeat.wakeOnAutomation,
      true,
    ),
    maxConcurrentRuns: Math.max(1, Math.floor(asNumber(heartbeat.maxConcurrentRuns, 1))),
  };
}

export function classifyTitanClawsIssue(input: {
  title: string;
  description?: string | null;
  projectName?: string | null;
  goalTitle?: string | null;
  status: string;
}): TitanClawsArchiveIssueClassification {
  const haystack = normalizeText(input.title, input.description, input.projectName, input.goalTitle);
  const reasons: string[] = [];

  const websiteSignals = [
    "website",
    "wordpress",
    "homepage",
    "landing page",
    "landing",
    "popup",
    "cta",
    "opt-in",
    "email capture",
    "email popup",
    "lead capture",
    "form",
    "titanclaws.com",
    "conversion",
  ];
  const emailSignals = [
    "email list",
    "subscriber",
    "subscribers",
    "newsletter",
    "welcome sequence",
    "weekly send",
    "lead magnet",
    "email nurture",
    "campaign",
  ];
  const socialSignals = [
    "social",
    "some",
    "instagram",
    "facebook",
    "tiktok",
    "batch",
    "reel",
    "post schedule",
    "content calendar",
  ];
  const brandSignals = [
    "brand",
    "branding",
    "touchpoint",
    "logo",
    "voice",
    "identity",
    "visual qa",
    "visual polish",
  ];
  const productValidationSignals = [
    "product-market fit",
    "product market fit",
    "pre-sell",
    "presell",
    "validate",
    "validation",
    "offer",
    "batch sale",
    "first batch",
  ];
  const prototypeSignals = [
    "prototype",
    "supplier",
    "manufact",
    "sample",
    "quote",
    "factory",
    "materials",
    "packaging",
  ];

  let goalKey: TitanClawsGoalKey | null = null;
  if (includesAny(haystack, websiteSignals)) {
    goalKey = "website_email_capture";
    reasons.push("matched website/email capture signals");
  } else if (includesAny(haystack, emailSignals)) {
    goalKey = "email_list_growth";
    reasons.push("matched email list growth signals");
  } else if (includesAny(haystack, prototypeSignals)) {
    goalKey = "prototype_supplier_pipeline";
    reasons.push("matched prototype or supplier signals");
  } else if (includesAny(haystack, productValidationSignals)) {
    goalKey = "product_validation";
    reasons.push("matched product validation signals");
  } else if (includesAny(haystack, socialSignals)) {
    goalKey = "social_audience_growth";
    reasons.push("matched social growth signals");
  } else if (includesAny(haystack, brandSignals)) {
    goalKey = "brand_consistency";
    reasons.push("matched brand consistency signals");
  }

  if (!goalKey) {
    return {
      goalKey: null,
      disposition: "parking_lot_reference",
      reasons: ["no confident GoalLoop destination"],
    };
  }

  if (input.status === "blocked") {
    return {
      goalKey,
      disposition: "goal_current_state",
      reasons: [...reasons, "blocked issue should inform current-state risk"],
    };
  }

  if (
    includesAny(haystack, [
      "access",
      "credential",
      "credentials",
      "login",
      "connected",
      "connection",
      "site access",
      "account access",
      "environment",
    ])
  ) {
    return {
      goalKey,
      disposition: "context_fact",
      reasons: [...reasons, "issue reads like an access or environment fact"],
    };
  }

  return {
    goalKey,
    disposition: "runbook_next_action",
    reasons: [...reasons, "open work should seed next-action runbook"],
  };
}

function formatArchivedIssueLine(issue: TitanClawsArchivedIssue) {
  const identifier = issue.identifier ?? issue.id;
  return `- ${identifier}: ${issue.title} (${issue.status})`;
}

function summarizeCurrentState(issuesForGoal: TitanClawsArchivedIssue[]) {
  if (issuesForGoal.length === 0) {
    return "No open classic issues are mapped here; the first GoalLoop run should establish a fresh baseline.";
  }
  const head = issuesForGoal.slice(0, 3).map((issue) => issue.title).join("; ");
  return `Archived classic work still points here: ${head}.`;
}

function buildGoalBriefBody(input: {
  title: string;
  focusLines: string[];
  mappedIssues: TitanClawsArchivedIssue[];
  parkingLotCount?: number;
}) {
  const issueLines =
    input.mappedIssues.length > 0
      ? input.mappedIssues.slice(0, 5).map(formatArchivedIssueLine)
      : ["- No archived classic issues were mapped directly to this goal."];
  const parkingLotLine =
    typeof input.parkingLotCount === "number" && input.parkingLotCount > 0
      ? [`- ${input.parkingLotCount} archived issues remain in the parking lot for later review.`]
      : [];

  return [
    `# ${input.title}`,
    "",
    "## Goal focus",
    ...input.focusLines.map((line) => `- ${line}`),
    "",
    "## Archived classic work to review",
    ...issueLines,
    ...parkingLotLine,
    "",
    "## Execution rule",
    "- GoalLoop runs should produce verifiable external changes and update the scoreboard and runbook before success.",
  ].join("\n");
}

function buildGoalRunbookEntries(input: {
  title: string;
  mappedIssues: TitanClawsArchivedIssue[];
  verificationLine: string;
  measurementLine: string;
}) {
  const nextActionBody = input.mappedIssues.length > 0
    ? [
      "- Review the archived classic issues before the first run.",
      ...input.mappedIssues.slice(0, 5).map(formatArchivedIssueLine),
      "- Convert only the highest-value item into the first verified GoalLoop output.",
    ].join("\n")
    : [
      "- Establish the current baseline from the live surface before making new changes.",
      "- Record the first deliberate next action here before launching another run.",
    ].join("\n");

  return [
    {
      title: `${input.title}: next actions`,
      body: nextActionBody,
    },
    {
      title: `${input.title}: verification`,
      body: `- ${input.verificationLine}\n- Do not mark the run successful until proof is stored in the output ledger.`,
    },
    {
      title: `${input.title}: measurement`,
      body: `- ${input.measurementLine}\n- Update the scoreboard and the next action before launching another run.`,
    },
  ];
}

function buildGoalSeeds(archive: TitanClawsCutoverArchive): TitanClawsCutoverGoalSeed[] {
  const issuesByGoal = new Map<TitanClawsGoalKey, TitanClawsArchivedIssue[]>();
  for (const issue of archive.openIssues) {
    if (!issue.classification.goalKey) continue;
    const list = issuesByGoal.get(issue.classification.goalKey) ?? [];
    list.push(issue);
    issuesByGoal.set(issue.classification.goalKey, list);
  }

  const parkedIssues = archive.openIssues.filter((issue) => issue.classification.goalKey === null);

  const issueCountMetric = (goalKey: TitanClawsGoalKey) =>
    archive.backlogByGoal.find((entry) => entry.goalKey === goalKey)?.openIssueCount ?? 0;

  return [
    {
      key: "website_email_capture",
      title: GOAL_TITLES.website_email_capture,
      status: "active",
      briefStatus: "ready",
      recipeSlug: "website_repair",
      description: "Improve titanclaws.com conversion surfaces with proof-backed website changes.",
      finishLine: "The website and popup funnel produce a verified improvement with proof on titanclaws.com.",
      kpiFamily: "website_conversion",
      timeframe: "first monitored relaunch window",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("website_email_capture") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.website_email_capture,
        focusLines: [
          "Repair the most important email-capture friction on titanclaws.com first.",
          "Keep the first launch narrow enough to observe behavior and verify safely.",
          "Prefer popup, CTA, and form fixes over broad redesign work in the first run.",
        ],
        mappedIssues: issuesByGoal.get("website_email_capture") ?? [],
        parkingLotCount: parkedIssues.length,
      }),
      finishCriteria: [
        {
          id: "site-proof",
          label: "A primary website output is shipped and verified on titanclaws.com.",
        },
        {
          id: "scoreboard",
          label: "The scoreboard records the current conversion baseline or a measurable improvement.",
        },
      ],
      accessChecklist: [
        { key: "wordpress", label: "WordPress access for titanclaws.com", status: "ready" },
        { key: "gohighlevel", label: "GoHighLevel email capture access", status: "ready" },
      ],
      launchChecklist: [
        "Confirm classic agents are paused before launch.",
        "Confirm the output proof URL can be captured on titanclaws.com.",
      ],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.website_email_capture,
        mappedIssues: issuesByGoal.get("website_email_capture") ?? [],
        verificationLine: "Capture the live page URL and visual proof for the changed popup, CTA, or form surface.",
        measurementLine: "Record the current subscriber or submit baseline and note whether the change improves the funnel.",
      }),
      scoreboardSummary: "Website/email capture relaunch baseline.",
      scoreboardMetrics: [
        { key: "archived_open_issue_count", label: "Archived classic issues", value: issueCountMetric("website_email_capture") },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "ready_for_first_launch" },
      ],
    },
    {
      key: "email_list_growth",
      title: GOAL_TITLES.email_list_growth,
      status: "planned",
      briefStatus: "ready",
      recipeSlug: "social_growth",
      description: "Grow and nurture the email list using GoHighLevel-connected capture and sending surfaces.",
      finishLine: "The email program has a verified lead-capture or nurture output and a measurable list-growth baseline.",
      kpiFamily: "email_growth",
      timeframe: "post-website relaunch",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("email_list_growth") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.email_list_growth,
        focusLines: [
          "Turn captured traffic into subscribers and subscriber activity.",
          "Use the existing GoHighLevel connection instead of building a new email stack.",
        ],
        mappedIssues: issuesByGoal.get("email_list_growth") ?? [],
      }),
      finishCriteria: [
        {
          id: "capture-or-send",
          label: "A lead-capture or nurture artifact is shipped and verified through the connected email stack.",
        },
      ],
      accessChecklist: [
        { key: "gohighlevel", label: "GoHighLevel account access", status: "ready" },
        { key: "website_capture", label: "Website capture forms available", status: "ready" },
      ],
      launchChecklist: ["Review the website conversion baseline before launching nurture work."],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.email_list_growth,
        mappedIssues: issuesByGoal.get("email_list_growth") ?? [],
        verificationLine: "Capture proof of the live form, automation, or email artifact in GoHighLevel.",
        measurementLine: "Update subscriber, opt-in, or send-performance metrics after each run.",
      }),
      scoreboardSummary: "Email list growth baseline.",
      scoreboardMetrics: [
        { key: "archived_open_issue_count", label: "Archived classic issues", value: issueCountMetric("email_list_growth") },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "queued_after_website_goal" },
      ],
    },
    {
      key: "social_audience_growth",
      title: GOAL_TITLES.social_audience_growth,
      status: "planned",
      briefStatus: "ready",
      recipeSlug: "social_growth",
      description: "Run the Titan Claws social publishing loop with verified batch outputs and measurement.",
      finishLine: "A social batch is shipped with proof and the audience-growth scoreboard is updated.",
      kpiFamily: "social_growth",
      timeframe: "weekly batching loop",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("social_audience_growth") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.social_audience_growth,
        focusLines: [
          "Resume social work only after the website relaunch is stable.",
          "Use verified scheduled posts or published content as the proof of progress.",
        ],
        mappedIssues: issuesByGoal.get("social_audience_growth") ?? [],
      }),
      finishCriteria: [
        { id: "scheduled-batch", label: "A batch of social content is scheduled or published with proof." },
      ],
      accessChecklist: [
        { key: "gohighlevel_social", label: "GoHighLevel social scheduling access", status: "ready" },
      ],
      launchChecklist: ["Confirm brand and website priorities are not blocked before relaunching social output."],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.social_audience_growth,
        mappedIssues: issuesByGoal.get("social_audience_growth") ?? [],
        verificationLine: "Capture scheduling proof or live post URLs for the shipped batch.",
        measurementLine: "Update follower, reach, or engagement metrics after each scheduled batch.",
      }),
      scoreboardSummary: "Social growth baseline.",
      scoreboardMetrics: [
        { key: "archived_open_issue_count", label: "Archived classic issues", value: issueCountMetric("social_audience_growth") },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "queued_after_email_goal" },
      ],
    },
    {
      key: "brand_consistency",
      title: GOAL_TITLES.brand_consistency,
      status: "planned",
      briefStatus: "ready",
      recipeSlug: "website_repair",
      description: "Keep the Titan Claws brand consistent across website, email, and social surfaces.",
      finishLine: "A cross-surface brand improvement ships with proof and the runbook captures the new standard.",
      kpiFamily: "brand_consistency",
      timeframe: "after core acquisition loops are stable",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("brand_consistency") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.brand_consistency,
        focusLines: [
          "Treat brand work as a system of standards, not a one-off polish pass.",
          "Every shipped improvement should feed the company runbook and visual rules.",
        ],
        mappedIssues: issuesByGoal.get("brand_consistency") ?? [],
      }),
      finishCriteria: [
        { id: "brand-proof", label: "A live brand-facing surface is updated and verified." },
      ],
      accessChecklist: [
        { key: "website", label: "Website editing access", status: "ready" },
        { key: "social", label: "Social scheduling access", status: "ready" },
      ],
      launchChecklist: ["Review any archived visual QA items before launch."],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.brand_consistency,
        mappedIssues: issuesByGoal.get("brand_consistency") ?? [],
        verificationLine: "Capture before/after proof for every live touchpoint change.",
        measurementLine: "Document which brand rules improved clarity or trust and carry them forward.",
      }),
      scoreboardSummary: "Brand consistency baseline.",
      scoreboardMetrics: [
        { key: "archived_open_issue_count", label: "Archived classic issues", value: issueCountMetric("brand_consistency") },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "queued_after_social_goal" },
      ],
    },
    {
      key: "product_validation",
      title: GOAL_TITLES.product_validation,
      status: "planned",
      briefStatus: "draft",
      recipeSlug: "supplier_outreach",
      description: "Validate demand and pre-sell the Titan Claws offer before scaling product work.",
      finishLine: "The validation loop ships a verified offer or outreach output and records demand signals.",
      kpiFamily: "product_validation",
      timeframe: "after acquisition loops are stable",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("product_validation") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.product_validation,
        focusLines: [
          "Do not scale prototype or supplier work until the offer and demand signal are explicit.",
          "This brief stays draft until the board confirms the current product-validation surface.",
        ],
        mappedIssues: issuesByGoal.get("product_validation") ?? [],
      }),
      finishCriteria: [
        { id: "offer-proof", label: "A validation or pre-sell artifact is shipped and verified." },
      ],
      accessChecklist: [
        { key: "offer_surface", label: "Confirmed product validation surface", status: "pending" },
        { key: "payment_or_capture", label: "Lead or payment capture path", status: "pending" },
      ],
      launchChecklist: ["Board review required before moving this goal from draft to ready."],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.product_validation,
        mappedIssues: issuesByGoal.get("product_validation") ?? [],
        verificationLine: "Capture proof of the live validation surface or outreach output.",
        measurementLine: "Record responses, leads, or pre-sell signals after each run.",
      }),
      scoreboardSummary: "Product validation baseline.",
      scoreboardMetrics: [
        { key: "archived_open_issue_count", label: "Archived classic issues", value: issueCountMetric("product_validation") },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "awaiting_board_review" },
      ],
    },
    {
      key: "prototype_supplier_pipeline",
      title: GOAL_TITLES.prototype_supplier_pipeline,
      status: "planned",
      briefStatus: "draft",
      recipeSlug: "supplier_outreach",
      description: "Move from concept to prototype and supplier quote only after validation inputs are clear.",
      finishLine: "A supplier or prototype output is verified and the next sourcing decision is recorded.",
      kpiFamily: "supplier_pipeline",
      timeframe: "after product validation",
      currentStateSummary: summarizeCurrentState(issuesByGoal.get("prototype_supplier_pipeline") ?? []),
      body: buildGoalBriefBody({
        title: GOAL_TITLES.prototype_supplier_pipeline,
        focusLines: [
          "Treat prototype and supplier work as a downstream loop after product validation is real.",
          "This brief stays draft until sourcing access and constraints are confirmed.",
        ],
        mappedIssues: issuesByGoal.get("prototype_supplier_pipeline") ?? [],
      }),
      finishCriteria: [
        { id: "supplier-proof", label: "A supplier quote, outreach, or prototype artifact is verified." },
      ],
      accessChecklist: [
        { key: "supplier_contacts", label: "Supplier contact source or list", status: "pending" },
        { key: "prototype_constraints", label: "Prototype spec or sourcing constraints", status: "pending" },
      ],
      launchChecklist: ["Board review required before moving this goal from draft to ready."],
      runbookEntries: buildGoalRunbookEntries({
        title: GOAL_TITLES.prototype_supplier_pipeline,
        mappedIssues: issuesByGoal.get("prototype_supplier_pipeline") ?? [],
        verificationLine: "Capture proof of supplier outreach, quote, or prototype artifact.",
        measurementLine: "Record supplier response rate, quote quality, and next sourcing decisions.",
      }),
      scoreboardSummary: "Prototype and supplier baseline.",
      scoreboardMetrics: [
        {
          key: "archived_open_issue_count",
          label: "Archived classic issues",
          value: issueCountMetric("prototype_supplier_pipeline"),
        },
        { key: "verified_outputs", label: "Verified outputs", value: 0 },
        { key: "launch_status", label: "Launch status", value: "awaiting_board_review" },
      ],
    },
  ];
}

export function buildTitanClawsCutoverDefinition(archive: TitanClawsCutoverArchive): TitanClawsCutoverDefinition {
  const pausedAgents = archive.agents.filter((agent) => agent.status === "paused").length;
  const classicAgents = archive.agents.length;
  const activeRuns = archive.activeHeartbeatRuns.length;

  const contextPackSections = [
    {
      key: "business-overview",
      title: "Business Overview",
      orderIndex: 0,
      body: [
        "- Titan Claws is operating a live WordPress site at https://titanclaws.com.",
        "- The business already has a connected GoHighLevel account for email capture and social scheduling.",
        "- The cutover objective is to stop treating classic issue traffic as the primary proof of progress and relaunch around verified GoalLoop outputs.",
      ].join("\n"),
    },
    {
      key: "cutover-state",
      title: "Cutover State",
      orderIndex: 1,
      body: [
        `- Legacy classic goals preserved: ${archive.legacyGoals.length}.`,
        `- Open classic issues archived for review: ${archive.openIssues.length}.`,
        `- Active or queued classic heartbeat runs at archive time: ${activeRuns}.`,
        `- Classic agents in scope for pause/review: ${classicAgents}.`,
        `- Classic agents already paused before cutover: ${pausedAgents}.`,
      ].join("\n"),
    },
    {
      key: "goal-loop-guardrails",
      title: "GoalLoop Guardrails",
      orderIndex: 2,
      body: [
        "- New Titan Claws work should enter through GoalLoop briefs and runbooks, not fresh classic issues.",
        "- Classic issues remain as archive history and must not be used as the source of truth after cutover.",
        "- The first GoalLoop launch is intentionally narrow: website and email capture conversion only.",
      ].join("\n"),
    },
    {
      key: "launch-order",
      title: "Launch Order",
      orderIndex: 3,
      body: GOAL_ORDER.map((goalKey, index) => `- ${index + 1}. ${GOAL_TITLES[goalKey]}`).join("\n"),
    },
  ];

  const companyRunbookEntries = [
    {
      title: "Titan Claws GoalLoop cutover guardrails",
      orderIndex: 0,
      body: [
        "- Pause classic heartbeats before launching GoalLoop work.",
        "- Do not create new assigned classic issues during the monitored relaunch window.",
        "- Keep the rollback bundle and archive bundle available until the first verified GoalLoop output succeeds.",
      ].join("\n"),
    },
    {
      title: "Titan Claws sequential launch order",
      orderIndex: 1,
      body: GOAL_ORDER.map((goalKey, index) => `- ${index + 1}. ${GOAL_TITLES[goalKey]}`).join("\n"),
    },
    {
      title: "Titan Claws monitoring checkpoints",
      orderIndex: 2,
      body: [
        "- Watch active goal runs, classic heartbeat runs, and resource leases together during relaunch.",
        "- Do not promote the next goal until the previous one has a verified primary output and a refreshed runbook.",
        "- Treat unresolved verification failures as a stop condition, not as background noise.",
      ].join("\n"),
    },
  ];

  return {
    companyName: archive.company.name,
    firstGoalKey: FIRST_GOAL_KEY,
    firstGoalTitle: GOAL_TITLES[FIRST_GOAL_KEY],
    contextPackSections,
    companyRunbookEntries,
    goals: buildGoalSeeds(archive),
  };
}

export function goalLoopCutoverService(db: Db) {
  const companiesSvc = companyService(db);
  const agentsSvc = agentService(db);
  const goalsSvc = goalService(db);
  const goalLoopSvc = goalLoopService(db);

  async function buildTitanClawsCutoverArchive(companyId: string): Promise<TitanClawsCutoverArchive> {
    const company = await companiesSvc.getById(companyId);
    if (!company) throw notFound("Company not found");

    const [goalRows, projectRows, agentRows, openIssueRows, activeRunRows] = await Promise.all([
      db.select().from(goals).where(eq(goals.companyId, companyId)).orderBy(desc(goals.createdAt)),
      db.select().from(projects).where(eq(projects.companyId, companyId)).orderBy(desc(projects.updatedAt)),
      db.select().from(agents).where(eq(agents.companyId, companyId)).orderBy(desc(agents.updatedAt)),
      db
        .select({
          id: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          description: issues.description,
          status: issues.status,
          priority: issues.priority,
          projectId: issues.projectId,
          goalId: issues.goalId,
          assigneeAgentId: issues.assigneeAgentId,
          updatedAt: issues.updatedAt,
        })
        .from(issues)
        .where(and(eq(issues.companyId, companyId), inArray(issues.status, [...OPEN_ISSUE_STATUSES])))
        .orderBy(desc(issues.updatedAt), desc(issues.createdAt)),
      db
        .select()
        .from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.companyId, companyId), inArray(heartbeatRuns.status, [...ACTIVE_HEARTBEAT_RUN_STATUSES])))
        .orderBy(desc(heartbeatRuns.createdAt)),
    ]);

    const goalById = new Map(goalRows.map((goal) => [goal.id, goal]));
    const projectById = new Map(projectRows.map((project) => [project.id, project]));
    const agentById = new Map(agentRows.map((agent) => [agent.id, agent]));

    const openIssues: TitanClawsArchivedIssue[] = openIssueRows.map((issue) => {
      const project = issue.projectId ? projectById.get(issue.projectId) ?? null : null;
      const goal = issue.goalId ? goalById.get(issue.goalId) ?? null : null;
      const assignee = issue.assigneeAgentId ? agentById.get(issue.assigneeAgentId) ?? null : null;
      const classification = classifyTitanClawsIssue({
        title: issue.title,
        description: issue.description,
        projectName: project?.name ?? null,
        goalTitle: goal?.title ?? null,
        status: issue.status,
      });
      return {
        id: issue.id,
        identifier: issue.identifier ?? null,
        title: issue.title,
        description: issue.description ?? null,
        status: issue.status,
        priority: issue.priority,
        projectId: issue.projectId ?? null,
        projectName: project?.name ?? null,
        goalId: issue.goalId ?? null,
        goalTitle: goal?.title ?? null,
        assigneeAgentId: issue.assigneeAgentId ?? null,
        assigneeAgentName: assignee?.name ?? null,
        updatedAt: issue.updatedAt,
        classification,
      };
    });

    const backlogByGoal = GOAL_ORDER.map((goalKey) => {
      const related = openIssues.filter((issue) => issue.classification.goalKey === goalKey);
      return {
        goalKey,
        goalTitle: GOAL_TITLES[goalKey],
        openIssueCount: related.length,
        issueIdentifiers: related.map((issue) => issue.identifier ?? issue.id),
      };
    });

    const projectsWithOpenCounts: TitanClawsArchivedProject[] = projectRows.map((project) => {
      const mappedGoal = project.goalId ? goalById.get(project.goalId) ?? null : null;
      return {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        status: project.status,
        goalId: project.goalId ?? null,
        goalTitle: mappedGoal?.title ?? null,
        openIssueCount: openIssues.filter((issue) => issue.projectId === project.id).length,
        pausedAt: project.pausedAt ?? null,
      };
    });

    const archivedAgents: TitanClawsArchivedAgent[] = agentRows.map((agent) => {
      const heartbeat = readHeartbeatPolicy(agent.runtimeConfig);
      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status,
        pauseReason: agent.pauseReason ?? null,
        pausedAt: agent.pausedAt ?? null,
        heartbeatEnabled: heartbeat.enabled,
        intervalSec: heartbeat.intervalSec,
        wakeOnDemand: heartbeat.wakeOnDemand,
        maxConcurrentRuns: heartbeat.maxConcurrentRuns,
      };
    });

    const issueById = new Map(openIssues.map((issue) => [issue.id, issue]));
    const activeHeartbeatRuns: TitanClawsArchivedHeartbeatRun[] = activeRunRows.map((run) => {
      const agent = agentById.get(run.agentId) ?? null;
      const goal = run.goalId ? goalById.get(run.goalId) ?? null : null;
      const issueId = asString(isRecord(run.contextSnapshot) ? run.contextSnapshot.issueId : null);
      const issue = issueId ? issueById.get(issueId) ?? null : null;
      return {
        id: run.id,
        agentId: run.agentId,
        agentName: agent?.name ?? null,
        status: run.status,
        invocationSource: run.invocationSource,
        goalId: run.goalId ?? null,
        goalTitle: goal?.title ?? null,
        goalRunId: run.goalRunId ?? null,
        goalRunPhase: run.goalRunPhase ?? null,
        issueId,
        issueTitle: issue?.title ?? null,
        createdAt: run.createdAt,
        startedAt: run.startedAt ?? null,
      };
    });

    const legacyGoals: TitanClawsArchivedGoal[] = goalRows
      .filter((goal) => (goal.mode ?? "classic") === "classic")
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description ?? null,
        level: goal.level,
        status: goal.status,
        mode: goal.mode ?? "classic",
      }));

    const existingGoalLoopGoals: TitanClawsArchivedGoal[] = goalRows
      .filter((goal) => (goal.mode ?? "classic") !== "classic")
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description ?? null,
        level: goal.level,
        status: goal.status,
        mode: goal.mode ?? "goal_loop",
      }));

    return {
      generatedAt: new Date(),
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        issuePrefix: company.issuePrefix,
        issueCounter: company.issueCounter,
        defaultGoalMode: company.defaultGoalMode ?? null,
      },
      legacyGoals,
      existingGoalLoopGoals,
      projects: projectsWithOpenCounts,
      agents: archivedAgents,
      activeHeartbeatRuns,
      openIssues,
      backlogByGoal,
      parkedIssueCount: openIssues.filter((issue) => issue.classification.goalKey === null).length,
      recommendations: {
        firstGoalKey: FIRST_GOAL_KEY,
        firstGoalTitle: GOAL_TITLES[FIRST_GOAL_KEY],
        agentIdsToPause: archivedAgents
          .filter((agent) => agent.status !== "paused" && agent.status !== "terminated" && agent.status !== "pending_approval")
          .map((agent) => agent.id),
      },
    };
  }

  async function applyTitanClawsGoalLoopCutover(
    companyId: string,
    options: TitanClawsCutoverApplyOptions,
  ): Promise<TitanClawsCutoverApplyResult> {
    const archive = await buildTitanClawsCutoverArchive(companyId);
    const definition = buildTitanClawsCutoverDefinition(archive);

    const pausedAgentIds: string[] = [];
    if (options.pauseClassicAgents !== false) {
      for (const agentId of archive.recommendations.agentIdsToPause) {
        const paused = await agentsSvc.pause(agentId, "system");
        if (paused) pausedAgentIds.push(paused.id);
      }
    }

    const updatedCompany = await companiesSvc.update(companyId, {
      defaultGoalMode: "goal_loop",
    });
    if (!updatedCompany) throw notFound("Company not found");

    await goalLoopSvc.putContextPack(
      companyId,
      {
        sections: definition.contextPackSections,
      },
      options.actor,
    );

    await goalLoopSvc.putRunbook(
      companyId,
      "company",
      companyId,
      {
        entries: definition.companyRunbookEntries,
      },
      options.actor,
    );

    const recipes = await goalLoopSvc.listRecipes(companyId);
    const existingGoals = await goalsSvc.list(companyId);
    const createdOrUpdatedGoals: TitanClawsCutoverApplyResult["goals"] = [];

    for (const seed of definition.goals) {
      const existingGoal =
        existingGoals.find((goal) => goal.title === seed.title && (goal.mode ?? "classic") === "goal_loop") ?? null;

      const goal = existingGoal
        ? await goalsSvc.update(existingGoal.id, {
          description: seed.description,
          status: seed.status,
          mode: "goal_loop",
        })
        : await goalsSvc.create(companyId, {
          title: seed.title,
          description: seed.description,
          level: "team",
          parentId: null,
          ownerAgentId: null,
          status: seed.status,
          mode: "goal_loop",
        });

      if (!goal) throw notFound(`Failed to create or update goal: ${seed.title}`);

      const recipe = recipes.find((entry) => entry.slug === seed.recipeSlug);
      if (!recipe?.latestVersion) {
        throw notFound(`Recipe not found for cutover goal: ${seed.recipeSlug}`);
      }

      const brief = await goalLoopSvc.putGoalBrief(
        goal.id,
        {
          status: seed.briefStatus,
          recipeId: recipe.id,
          recipeVersionId: recipe.latestVersion.id,
          body: seed.body,
          finishLine: seed.finishLine,
          kpiFamily: seed.kpiFamily,
          timeframe: seed.timeframe,
          currentStateSummary: seed.currentStateSummary,
          finishCriteria: seed.finishCriteria,
          accessChecklist: seed.accessChecklist,
          launchChecklist: seed.launchChecklist,
        },
        options.actor,
      );

      await goalLoopSvc.putGoalScoreboard(goal.id, {
        summary: seed.scoreboardSummary,
        metrics: seed.scoreboardMetrics,
      });

      await goalLoopSvc.putRunbook(
        companyId,
        "goal",
        goal.id,
        {
          entries: seed.runbookEntries.map((entry, index) => ({
            title: entry.title,
            body: entry.body,
            orderIndex: index,
          })),
        },
        options.actor,
      );

      createdOrUpdatedGoals.push({
        key: seed.key,
        goalId: goal.id,
        title: seed.title,
        status: goal.status,
        briefStatus: brief.status,
      });
    }

    let firstLaunch: TitanClawsCutoverApplyResult["firstLaunch"] = null;
    if (options.launchFirstGoal) {
      const firstGoal = createdOrUpdatedGoals.find((goal) => goal.key === FIRST_GOAL_KEY);
      if (!firstGoal) throw notFound("First GoalLoop goal not found after cutover bootstrap");
      const launched = await goalLoopSvc.executeGoalRun(
        firstGoal.goalId,
        {
          requestedPhase: "direction",
        },
        options.actor,
      );
      firstLaunch = {
        goalId: firstGoal.goalId,
        runId: launched.run.id,
        issueId: launched.issue?.id ?? null,
        phase: launched.run.currentPhase,
        status: launched.run.status,
      };
    }

    return {
      archive,
      definition,
      companyId,
      defaultGoalMode: updatedCompany.defaultGoalMode ?? null,
      pausedAgentIds,
      goals: createdOrUpdatedGoals,
      firstLaunch,
    };
  }

  return {
    buildTitanClawsCutoverArchive,
    buildTitanClawsCutoverDefinition,
    applyTitanClawsGoalLoopCutover,
  };
}
