import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireFeature } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireFeature("reports"));

function clientWhere(req) {
  const cid = req.user.clientId ?? req.query.clientId ?? null;
  return cid ? { clientId: cid } : {};
}

router.get("/", async (req, res) => {
  try {
    const data = await prisma.weeklyReport.findMany({
      where: clientWhere(req),
      orderBy: { weekStart: "desc" },
      take: 12,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
