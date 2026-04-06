/**
 * GHL Social Planner Statistics Fetcher
 * Usage: npx tsx scripts/ghl-social-stats.ts
 *
 * Requires GHL_PRIVATE_INTEGRATION_TOKEN and GHL_LOCATION_ID in .env
 *
 * API details:
 *   Base URL: https://services.leadconnectorhq.com
 *   Accounts: GET  /social-media-posting/{locationId}/accounts
 *   Posts:    POST /social-media-posting/{locationId}/posts/list?skip=0&limit=50
 *   Stats:    POST /social-media-posting/statistics?locationId={locationId}
 *   All require: Authorization: Bearer <token>, Version: 2021-07-28
 *
 * Note: The /statistics endpoint returns 400 if no posts have been published yet
 *       (GHL server-side bug: "Cannot read properties of undefined (reading 'startDate')").
 *       Once posts are published and analytics data accumulates, it will return 7-day stats.
 */

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const TOKEN = process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BASE_URL = "https://services.leadconnectorhq.com";

if (!TOKEN || !LOCATION_ID) {
  console.error("Missing GHL_PRIVATE_INTEGRATION_TOKEN or GHL_LOCATION_ID in .env");
  process.exit(1);
}

const headers: Record<string, string> = {
  Authorization: `Bearer ${TOKEN}`,
  Version: "2021-07-28",
  "Content-Type": "application/json",
};

// ── Types ──

interface SocialAccount {
  id: string;
  profileId: string;
  name: string;
  avatar: string;
  platform: string;
  type: string;
  expire: string;
  isExpired: boolean;
  originId: string;
  hasStatisticsPermissions: boolean;
  buildingStatistics: boolean;
  deleted: boolean;
}

interface SocialPost {
  _id: string;
  platform: string;
  status: string;
  summary: string;
  scheduleDate: string | null;
  publishedAt: string | null;
  accountIds: string[];
  media: { url: string; type: string }[];
  createdAt: string;
}

interface SocialStats {
  results: {
    dayRange: string[];
    totals: {
      posts: number;
      likes: number;
      followers: number;
      impressions: number;
      comments: number;
    };
    postPerformance: {
      posts: Record<string, number[]>;
      impressions: number[];
      likes: number[];
      comments: number[];
    };
    breakdowns: {
      posts: { total: number; totalChange: number; platforms: Record<string, { value: number; change: number }> };
      impressions: { total: number; totalChange: number; platforms: Record<string, { value: number; change: number }> };
      reach: { total: number; totalChange: number; platforms: Record<string, { value: number; change: number }> };
      engagement: Record<string, { likes: number; comments: number; shares: number; change: number }>;
    };
    platformTotals: Record<string, Record<string, { total: number; series: number[] }>>;
    demographics: {
      gender: { totals: Record<string, { total: number; percentage: number }> };
      age: { totals: Record<string, number> };
    };
  };
  message: string;
  traceId: string;
}

// ── API calls ──

async function getConnectedAccounts(): Promise<SocialAccount[]> {
  const res = await fetch(`${BASE_URL}/social-media-posting/${LOCATION_ID}/accounts`, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch accounts (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.results?.accounts ?? [];
}

async function getPosts(skip = 0, limit = 50): Promise<{ posts: SocialPost[]; count: number }> {
  const res = await fetch(
    `${BASE_URL}/social-media-posting/${LOCATION_ID}/posts/list?skip=${skip}&limit=${limit}`,
    { method: "POST", headers, body: JSON.stringify({}) },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch posts (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { posts: data.results?.posts ?? [], count: data.results?.count ?? 0 };
}

async function getStatistics(profileIds: string[], platforms?: string[]): Promise<SocialStats> {
  const body: Record<string, unknown> = { profileIds };
  if (platforms?.length) body.platforms = platforms;

  const res = await fetch(`${BASE_URL}/social-media-posting/statistics?locationId=${LOCATION_ID}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch statistics (${res.status}): ${text}`);
  }
  return res.json() as Promise<SocialStats>;
}

// ── Display ──

function printStats(stats: SocialStats) {
  const { totals, breakdowns, dayRange } = stats.results;

  console.log(`Period: ${dayRange[0]} - ${dayRange[dayRange.length - 1]} (last 7 days)\n`);

  console.log("--- Totals ---");
  console.log(`  Posts:       ${totals.posts}`);
  console.log(`  Likes:       ${totals.likes}`);
  console.log(`  Comments:    ${totals.comments}`);
  console.log(`  Impressions: ${totals.impressions}`);
  console.log(`  Followers:   ${totals.followers}`);
  console.log();

  console.log("--- Breakdowns (vs previous 7 days) ---");
  for (const metric of ["posts", "impressions", "reach"] as const) {
    const b = breakdowns[metric];
    const sign = b.totalChange >= 0 ? "+" : "";
    console.log(`  ${metric}: ${b.total} (${sign}${b.totalChange})`);
    for (const [platform, val] of Object.entries(b.platforms)) {
      const s = val.change >= 0 ? "+" : "";
      console.log(`    ${platform}: ${val.value} (${s}${val.change})`);
    }
  }
  console.log();

  console.log("--- Engagement by Platform ---");
  for (const [platform, eng] of Object.entries(breakdowns.engagement)) {
    console.log(`  ${platform}: ${eng.likes} likes, ${eng.comments} comments, ${eng.shares} shares (change: ${eng.change})`);
  }
  console.log();

  if (stats.results.demographics?.gender?.totals) {
    console.log("--- Demographics ---");
    const { gender, age } = stats.results.demographics;
    console.log("  Gender:");
    for (const [g, val] of Object.entries(gender.totals)) {
      console.log(`    ${g}: ${val.total} (${val.percentage}%)`);
    }
    if (age?.totals) {
      console.log("  Age:");
      for (const [range, count] of Object.entries(age.totals)) {
        console.log(`    ${range}: ${count}`);
      }
    }
  }
}

// ── Main ──

async function main() {
  console.log("=== GHL Social Planner — Titan Claws ===\n");

  // 1. Fetch connected accounts
  console.log("--- Connected Accounts ---");
  const accounts = await getConnectedAccounts();
  if (accounts.length === 0) {
    console.log("No connected social media accounts found.");
    return;
  }
  for (const acc of accounts) {
    const expiry = acc.isExpired ? "EXPIRED" : `expires ${acc.expire?.slice(0, 10)}`;
    const statsFlag = acc.hasStatisticsPermissions ? "stats OK" : "NO stats permission";
    console.log(`  ${acc.name} (${acc.platform}/${acc.type}) — ${expiry}, ${statsFlag}`);
    console.log(`    profileId: ${acc.profileId}`);
  }
  console.log();

  // 2. Fetch posts summary
  console.log("--- Posts Summary ---");
  const { posts, count } = await getPosts(0, 50);
  console.log(`  Total posts: ${count}`);
  const published = posts.filter((p) => p.status === "published");
  const scheduled = posts.filter((p) => p.status === "scheduled");
  const failed = posts.filter((p) => p.status === "failed");
  console.log(`  Published: ${published.length}, Scheduled: ${scheduled.length}, Failed: ${failed.length}`);
  if (published.length > 0) {
    console.log("\n  Recent published posts:");
    for (const p of published.slice(0, 5)) {
      console.log(`    [${p.publishedAt?.slice(0, 10)}] ${p.platform}: ${p.summary.slice(0, 80)}...`);
    }
  }
  if (scheduled.length > 0) {
    console.log("\n  Upcoming scheduled posts:");
    for (const p of scheduled.slice(0, 5)) {
      console.log(`    [${p.scheduleDate?.slice(0, 10)}] ${p.platform}: ${p.summary.slice(0, 80)}...`);
    }
  }
  console.log();

  // 3. Fetch statistics (only works once posts have been published)
  const profileIds = accounts.map((a) => a.profileId);
  console.log("--- Statistics (last 7 days) ---");
  try {
    const stats = await getStatistics(profileIds);
    console.log(`API: ${stats.message}\n`);
    printStats(stats);
    console.log("\n--- Raw Statistics JSON ---");
    console.log(JSON.stringify(stats.results, null, 2));
  } catch (err: any) {
    if (err.message.includes("startDate")) {
      console.log("  No statistics available yet — no posts have been published.");
      console.log("  Statistics will become available after posts are published and analytics data accumulates.");
      console.log("  (GHL needs published posts to compute 7-day analytics.)\n");
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
