import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/summary", async (req, res) => {
  let clientId = req.user.clientId;
  if (!clientId && req.user.role === "SUPER_ADMIN" && req.query.clientId) {
    clientId = req.query.clientId;
  }
  const where = clientId ? { clientId } : {};

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalLeads,
    totalCampaignDays,
    totalSuggestions,
    recentLeads,
    dailySpendRaw,
    topCampaignsRaw,
    currentMonthLeads,
    currentMonthSpendAgg,
  ] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.campaignDaily.count({ where }),
    prisma.contentSuggestion.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, source: true, status: true, createdAt: true },
    }),
    prisma.campaignDaily.groupBy({
      by: ["date"],
      where: { ...where, date: { gte: thirtyDaysAgo } },
      _sum: { spendCents: true },
      orderBy: { date: "asc" },
    }),
    prisma.campaignDaily.groupBy({
      by: ["campaignId", "campaignName"],
      where: { ...where, date: { gte: monthStart } },
      _sum: { conversions: true, spendCents: true },
      orderBy: { _sum: { conversions: "desc" } },
      take: 3,
    }),
    prisma.lead.count({ where: { ...where, createdAt: { gte: monthStart } } }),
    prisma.campaignDaily.aggregate({
      where: { ...where, date: { gte: monthStart } },
      _sum: { spendCents: true },
    }),
  ]);

  const dailySpend = dailySpendRaw.map((r) => ({
    date: r.date,
    spendCents: r._sum.spendCents ?? 0,
  }));

  const topCampaigns = topCampaignsRaw.map((r) => ({
    campaignId: r.campaignId,
    campaignName: r.campaignName,
    conversions: r._sum.conversions ?? 0,
    spendCents: r._sum.spendCents ?? 0,
  }));

  res.json({
    ok: true,
    data: {
      totalLeads,
      totalCampaignDays,
      totalSuggestions,
      recentLeads,
      dailySpend,
      topCampaigns,
      currentMonthLeads,
      currentMonthSpendCents: currentMonthSpendAgg._sum.spendCents ?? 0,
    },
  });
});

export default router;
