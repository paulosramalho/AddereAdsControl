import prisma from "../../lib/prisma.js";
import { runJob } from "./runner.js";
import { collectAds } from "../ads/collection.js";
import { collectInstagram } from "../instagram/collection.js";
import { analyzeInstagram } from "../instagram/analysis.js";
import { generateTrending } from "../content/trending.js";
import { generateSuggestions } from "../content/suggestions.js";
import { generateBoost } from "../content/boost.js";
import { generateWeeklyReport } from "../reports/weekly.js";

function brtDateStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Belem" });
}

function brtMondayStr() {
  const brtStr = new Date().toLocaleString("en-US", { timeZone: "America/Belem" });
  const d = new Date(brtStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString("en-CA");
}

async function lastSuccessDate(clientId, jobName) {
  const exec = await prisma.jobExecution.findFirst({
    where: { clientId, jobName, status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  if (!exec) return null;
  return exec.startedAt.toLocaleDateString("en-CA", { timeZone: "America/Belem" });
}

const DAILY_JOBS = [
  { name: "ads-collection",       fn: collectAds },
  { name: "instagram-collection", fn: collectInstagram },
  { name: "post-analysis",        fn: analyzeInstagram },
  { name: "trending-suggestions", fn: generateTrending },
  { name: "content-suggestions",  fn: generateSuggestions },
  { name: "boost-suggestions",    fn: generateBoost },
];

export async function runCatchUp() {
  let clients;
  try {
    clients = await prisma.client.findMany({ where: { status: "ACTIVE" } });
  } catch (err) {
    console.error("[catchUp] erro ao carregar clientes:", err.message);
    return;
  }

  const today = brtDateStr();
  const weekStart = brtMondayStr();

  for (const client of clients) {
    for (const { name, fn } of DAILY_JOBS) {
      try {
        const last = await lastSuccessDate(client.id, name);
        if (last !== today) {
          console.log(`[catchUp][${client.slug}] ${name} (último: ${last ?? "nunca"})`);
          runJob(client.id, name, () => fn(client)).catch((e) =>
            console.error(`[catchUp][${client.slug}] ${name}:`, e.message)
          );
        }
      } catch (err) {
        console.error(`[catchUp][${client.slug}] ${name}:`, err.message);
      }
    }

    try {
      const last = await lastSuccessDate(client.id, "weekly-report");
      if (!last || last < weekStart) {
        console.log(`[catchUp][${client.slug}] weekly-report`);
        runJob(client.id, "weekly-report", () => generateWeeklyReport(client)).catch((e) =>
          console.error(`[catchUp][${client.slug}] weekly-report:`, e.message)
        );
      }
    } catch (err) {
      console.error(`[catchUp][${client.slug}] weekly-report:`, err.message);
    }
  }
}
