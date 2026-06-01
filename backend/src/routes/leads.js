import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

const leadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().nullable(),
  source: z.enum(["SITE", "INSTAGRAM", "WHATSAPP", "REFERRAL", "OTHER"]),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]).optional(),
  monthlyFeePotential: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get("/", async (req, res) => {
  const leads = await prisma.lead.findMany({
    where: { clientId: req.params.clientId },
    orderBy: { createdAt: "desc" },
  });
  res.json(leads);
});

router.post("/", validateBody(leadSchema), async (req, res) => {
  const lead = await prisma.lead.create({
    data: { ...req.body, clientId: req.params.clientId },
  });
  res.status(201).json(lead);
});

router.get("/:leadId", async (req, res) => {
  const lead = await prisma.lead.findFirst({
    where: { id: req.params.leadId, clientId: req.params.clientId },
  });
  if (!lead) return res.status(404).json({ message: "Lead não encontrado" });
  res.json(lead);
});

router.put("/:leadId", validateBody(leadSchema.partial()), async (req, res) => {
  const result = await prisma.lead.updateMany({
    where: { id: req.params.leadId, clientId: req.params.clientId },
    data: req.body,
  });
  if (!result.count) return res.status(404).json({ message: "Lead não encontrado" });
  const updated = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
  res.json(updated);
});

router.delete("/:leadId", async (req, res) => {
  const result = await prisma.lead.deleteMany({
    where: { id: req.params.leadId, clientId: req.params.clientId },
  });
  if (!result.count) return res.status(404).json({ message: "Lead não encontrado" });
  res.json({ ok: true });
});

export default router;
