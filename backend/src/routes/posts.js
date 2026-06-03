import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient, requireAdminOrSuper, requireFeature } from "../middleware/auth.js";
import { runJob } from "../jobs/engine/runner.js";
import { analyzeInstagram } from "../jobs/instagram/analysis.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient, requireFeature("posts"));

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { limit = "50", offset = "0", mediaType, analyzed } = req.query;

    const where = { clientId };
    if (mediaType) where.mediaType = mediaType;
    if (analyzed === "true") where.analysis = { isNot: null };
    if (analyzed === "false") where.analysis = { is: null };

    const [posts, total] = await Promise.all([
      prisma.instagramPost.findMany({
        where,
        include: { analysis: true },
        orderBy: { timestamp: "desc" },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.instagramPost.count({ where }),
    ]);

    res.json({ ok: true, posts, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/analyze", requireAdminOrSuper, async (req, res) => {
  const { clientId } = req.params;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });
  runJob(client.id, "post-analysis", () => analyzeInstagram(client)).catch((err) => {
    console.error(`[posts/analyze][${client.slug}]`, err.message);
  });
  res.json({ ok: true });
});

export default router;
