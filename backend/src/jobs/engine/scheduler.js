import prisma from "../../lib/prisma.js";
import { runJob } from "./runner.js";
import { collectAds } from "../ads/collection.js";
import { collectInstagram } from "../instagram/collection.js";
import { analyzeInstagram } from "../instagram/analysis.js";
import { generateTrending } from "../content/trending.js";
import { generateSuggestions } from "../content/suggestions.js";
import { generateBoost } from "../content/boost.js";
import { generateWeeklyReport } from "../reports/weekly.js";
import { publishScheduledPosts } from "../instagram/publisher.js";

const lastRun = new Map();
const key = (clientId, job) => `${clientId}:${job}`;
const hoursSince = (clientId, job) => {
  const t = lastRun.get(key(clientId, job));
  return t ? (Date.now() - t) / 3_600_000 : Infinity;
};
const markRan = (clientId, job) => lastRun.set(key(clientId, job), Date.now());

function brtHour() {
  return Number(
    new Date().toLocaleString("en-US", { timeZone: "America/Belem", hour: "numeric", hour12: false })
  );
}
function brtDow() {
  return new Date().toLocaleString("en-US", { timeZone: "America/Belem", weekday: "short" });
}

const DAILY = [
  { job: "ads-collection",         hour: 2, fn: collectAds },
  { job: "instagram-collection",   hour: 1, fn: collectInstagram },
  { job: "post-analysis",          hour: 3, fn: analyzeInstagram },
  { job: "trending-suggestions",   hour: 4, fn: generateTrending },
  { job: "content-suggestions",    hour: 5, fn: generateSuggestions },
  { job: "boost-suggestions",      hour: 6, fn: generateBoost },
];

async function tick() {
  let clients;
  try {
    clients = await prisma.client.findMany({ where: { status: "ACTIVE" } });
  } catch (err) {
    console.error("[scheduler] erro ao carregar clientes:", err.message);
    return;
  }

  const hour = brtHour();
  const dow = brtDow();

  for (const client of clients) {
    const cid = client.id;

    for (const { job, hour: h, fn } of DAILY) {
      if (hour === h && hoursSince(cid, job) > 20) {
        markRan(cid, job);
        runJob(cid, job, () => fn(client)).catch((e) =>
          console.error(`[scheduler][${client.slug}] ${job}:`, e.message)
        );
      }
    }

    if (dow === "Mon" && hour === 7 && hoursSince(cid, "weekly-report") > 20) {
      markRan(cid, "weekly-report");
      runJob(cid, "weekly-report", () => generateWeeklyReport(client)).catch((e) =>
        console.error(`[scheduler][${client.slug}] weekly-report:`, e.message)
      );
    }

    publishScheduledPosts(client).catch((e) =>
      console.error(`[scheduler][${client.slug}] publisher:`, e.message)
    );
  }
}

export function startScheduler() {
  setInterval(tick, 5 * 60 * 1000);
  console.log("[scheduler] iniciado — tick a cada 5 min");
}
