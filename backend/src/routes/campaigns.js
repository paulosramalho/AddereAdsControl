import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient, requireFeature } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient, requireFeature("campaigns"));

router.get("/", async (req, res) => {
  try {
    const { clientId } = req.params;
    const days = Math.min(Math.max(parseInt(req.query.days ?? "30", 10), 1), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const toDate = new Date();
    const fromStr = since.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    const where = { clientId, date: { gte: since } };

    const [byGroup, byDay] = await Promise.all([
      prisma.campaignDaily.groupBy({
        by: ["campaignId", "campaignName", "platform"],
        where,
        _sum: { impressions: true, clicks: true, spendCents: true, conversions: true },
        _avg: { ctr: true },
        orderBy: { _sum: { spendCents: "desc" } },
      }),
      prisma.campaignDaily.groupBy({
        by: ["date"],
        where,
        _sum: { spendCents: true, impressions: true, clicks: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const campaigns = byGroup.map((r) => ({
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      platform: r.platform,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
      spendCents: r._sum.spendCents ?? 0,
      conversions: r._sum.conversions ?? 0,
      ctr: r._avg.ctr ?? 0,
    }));

    const totals = campaigns.reduce(
      (acc, c) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        spendCents: acc.spendCents + c.spendCents,
        conversions: acc.conversions + c.conversions,
      }),
      { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 }
    );

    const daily = byDay.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      spendCents: r._sum.spendCents ?? 0,
      impressions: r._sum.impressions ?? 0,
      clicks: r._sum.clicks ?? 0,
    }));

    res.json({ period: { from: fromStr, to: toStr, days }, totals, campaigns, daily });
  } catch (err) {
    console.error("campaigns GET error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
