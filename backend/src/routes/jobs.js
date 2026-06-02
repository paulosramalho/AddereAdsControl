import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { runJob } from "../jobs/engine/runner.js";
import { collectAds } from "../jobs/ads/collection.js";
import { collectInstagram } from "../jobs/instagram/collection.js";
import { analyzeInstagram } from "../jobs/instagram/analysis.js";
import { publishScheduledPosts } from "../jobs/instagram/publisher.js";
import { generateTrending } from "../jobs/content/trending.js";
import { generateSuggestions } from "../jobs/content/suggestions.js";
import { generateBoost } from "../jobs/content/boost.js";
import { generateWeeklyReport } from "../jobs/reports/weekly.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);

const JOB_MAP = {
  "ads-collection":        (client) => collectAds(client),
  "instagram-collection":  (client) => collectInstagram(client),
  "post-analysis":         (client) => analyzeInstagram(client),
  "trending-suggestions":  (client) => generateTrending(client),
  "content-suggestions":   (client) => generateSuggestions(client),
  "boost-suggestions":     (client) => generateBoost(client),
  "weekly-report":         (client) => generateWeeklyReport(client),
  "publish-scheduled":     (client) => publishScheduledPosts(client),
};

router.post("/:jobName/run", async (req, res) => {
  const { jobName } = req.params;
  const { clientId } = req.body;

  const fn = JOB_MAP[jobName];
  if (!fn) {
    return res.status(404).json({ message: `Job desconhecido: ${jobName}` });
  }

  let clients;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
    clients = [client];
  } else {
    clients = await prisma.client.findMany({ where: { status: "ACTIVE" } });
  }

  const results = [];
  for (const client of clients) {
    try {
      const result = await runJob(client.id, jobName, () => fn(client));
      results.push({ clientId: client.id, slug: client.slug, ...result });
    } catch (err) {
      results.push({ clientId: client.id, slug: client.slug, ok: false, error: err.message });
    }
  }

  res.json({ ok: true, results });
});

router.get("/", (_req, res) => {
  res.json({ jobs: Object.keys(JOB_MAP) });
});

export default router;
