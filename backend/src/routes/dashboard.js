import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  const clientId = req.user.clientId;
  const where = clientId ? { clientId } : {};

  const [totalLeads, totalCampaignDays, totalSuggestions, recentLeads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.campaignDaily.count({ where }),
    prisma.contentSuggestion.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, source: true, status: true, createdAt: true },
    }),
  ]);

  res.json({ ok: true, data: { totalLeads, totalCampaignDays, totalSuggestions, recentLeads } });
});

export default router;
