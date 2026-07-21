import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { runJob } from "../jobs/engine/runner.js";
import { collectAds } from "../jobs/ads/collection.js";
import { collectInstagram } from "../jobs/instagram/collection.js";
import { analyzeInstagram } from "../jobs/instagram/analysis.js";
import { publishScheduledPosts, invalidatePublisherCache } from "../jobs/instagram/publisher.js";
import { generateTrending } from "../jobs/content/trending.js";
import { generateSuggestions } from "../jobs/content/suggestions.js";
import { generateBoost } from "../jobs/content/boost.js";
import { generateWeeklyReport } from "../jobs/reports/weekly.js";
import { notifyInstagram } from "../jobs/instagram/notify.js";

const router = Router();
router.use(requireAuth);

// Jobs que um ADMIN de cliente pode disparar para o PRÓPRIO cliente (self-serve).
// Qualquer outro job, ou rodar para todos os clientes, continua exclusivo do SUPER_ADMIN.
const SELF_SERVE_JOBS = new Set([
  "trending-suggestions",
  "content-suggestions",
  "boost-suggestions",
]);

const JOB_MAP = {
  "ads-collection":        (client) => collectAds(client),
  "instagram-collection":  (client) => collectInstagram(client),
  "post-analysis":         (client) => analyzeInstagram(client),
  "trending-suggestions":  (client) => generateTrending(client),
  "content-suggestions":   (client) => generateSuggestions(client),
  "boost-suggestions":     (client) => generateBoost(client),
  "weekly-report":         (client) => generateWeeklyReport(client),
  "publish-scheduled":     (client) => publishScheduledPosts(client),
  "instagram-notify":      (client) => notifyInstagram(client),
};

router.post("/:jobName/run", async (req, res) => {
  const { jobName } = req.params;
  const isSuper = req.user.role === "SUPER_ADMIN";
  let clientId = req.body.clientId;

  const fn = JOB_MAP[jobName];
  if (!fn) {
    return res.status(404).json({ message: `Job desconhecido: ${jobName}` });
  }

  if (!isSuper) {
    // ADMIN de cliente: só jobs self-serve e só para o próprio cliente.
    if (req.user.role !== "ADMIN" || !req.user.clientId || !SELF_SERVE_JOBS.has(jobName)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    clientId = req.user.clientId; // força próprio cliente — ignora clientId do body
  }

  let clients;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
    clients = [client];
  } else {
    clients = await prisma.client.findMany({ where: { status: "ACTIVE" } });
  }

  for (const client of clients) {
    runJob(client.id, jobName, () => fn(client)).catch((err) => {
      console.error(`[jobs][${jobName}][${client.slug}]`, err.message);
    });
  }

  res.json({ ok: true });
});

// Flush do cache em memória do publisher (_nextDueCache). Necessário quando um
// ScheduledPost é inserido por fora das rotas (script direto no Neon) — nesse
// caso o publisher não vê o post novo até o processo reiniciar. Zero toque no
// banco: só força o próximo tick a reconsultar. Opcional clientId no body limita
// a um cliente; sem ele, limpa todos.
router.post("/publisher/invalidate-cache", requireSuperAdmin, (req, res) => {
  const { clientId } = req.body ?? {};
  invalidatePublisherCache(clientId || undefined);
  res.json({ ok: true, invalidated: clientId || "all" });
});

router.get("/", requireSuperAdmin, (_req, res) => {
  res.json({ jobs: Object.keys(JOB_MAP) });
});

export default router;
