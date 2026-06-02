import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient } from "../middleware/auth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

router.get("/current", async (req, res) => {
  const clientId = req.params.clientId;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12, 0, 0));

  const goal = await prisma.monthlyGoal.findUnique({
    where: { clientId_month: { clientId, month: monthStart } },
  });

  res.json({ ok: true, goal });
});

router.put("/:month", async (req, res) => {
  const clientId = req.params.clientId;
  const { month: monthParam } = req.params;
  const { leadsGoal, budgetCents, notes } = req.body;

  const [year, mon] = monthParam.split("-").map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    return res.status(400).json({ ok: false, message: "Mês inválido — use YYYY-MM" });
  }
  const month = new Date(Date.UTC(year, mon - 1, 1, 12, 0, 0));

  const goal = await prisma.monthlyGoal.upsert({
    where: { clientId_month: { clientId, month } },
    update: {
      leadsGoal: leadsGoal != null ? parseInt(leadsGoal) : null,
      budgetCents: budgetCents != null ? parseInt(budgetCents) : null,
      notes: notes ?? null,
    },
    create: {
      clientId,
      month,
      leadsGoal: leadsGoal != null ? parseInt(leadsGoal) : null,
      budgetCents: budgetCents != null ? parseInt(budgetCents) : null,
      notes: notes ?? null,
    },
  });

  res.json({ ok: true, goal });
});

export default router;
