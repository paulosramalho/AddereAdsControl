import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth, requireFeature } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth);

function clientWhere(req) {
  const cid = req.user.clientId ?? req.query.clientId ?? null;
  return cid ? { clientId: cid } : {};
}

router.get("/content", requireFeature("suggestions"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { ...clientWhere(req), ...(status ? { status } : {}) };
    const data = await prisma.contentSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch(
  "/content/:id/status",
  requireFeature("suggestions"),
  validateBody(z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "DONE"]) })),
  async (req, res) => {
    try {
      const filter = clientWhere(req);
      const where = { id: req.params.id, ...(filter.clientId ? { clientId: filter.clientId } : {}) };
      const result = await prisma.contentSuggestion.updateMany({
        where,
        data: { status: req.body.status },
      });
      if (!result.count) return res.status(404).json({ message: "Sugestão não encontrada" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get("/boost", requireFeature("boost"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = { ...clientWhere(req), ...(status ? { status } : {}) };
    const data = await prisma.boostSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch(
  "/boost/:id/status",
  requireFeature("boost"),
  validateBody(z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED", "DONE"]) })),
  async (req, res) => {
    try {
      const filter = clientWhere(req);
      const where = { id: req.params.id, ...(filter.clientId ? { clientId: filter.clientId } : {}) };
      const result = await prisma.boostSuggestion.updateMany({
        where,
        data: { status: req.body.status },
      });
      if (!result.count) return res.status(404).json({ message: "Sugestão não encontrada" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
