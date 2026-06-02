import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

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

export default router;
