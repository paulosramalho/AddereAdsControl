import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router();
router.use(requireAuth, requireSuperAdmin);

const clientSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  name: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL"]).optional(),
  niche: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  keywords: z.array(z.string()).optional(),
  contentTone: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  timezone: z.string().optional(),
  maxAdmins: z.number().int().min(0).optional().nullable(),
  maxViewers: z.number().int().min(0).optional().nullable(),
});

router.get("/", async (_req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  res.json(clients);
});

router.post("/", validateBody(clientSchema), async (req, res) => {
  const client = await prisma.client.create({ data: req.body }).catch((err) => {
    if (err.code === "P2002") return null;
    throw err;
  });
  if (!client) return res.status(409).json({ message: "Slug já em uso" });
  res.status(201).json(client);
});

router.get("/:id", async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
  res.json(client);
});

router.put("/:id", validateBody(clientSchema.partial()), async (req, res) => {
  const client = await prisma.client
    .update({ where: { id: req.params.id }, data: req.body })
    .catch((err) => { if (err.code === "P2025") return null; throw err; });
  if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
  res.json(client);
});

router.patch(
  "/:id/status",
  validateBody(z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL"]) })),
  async (req, res) => {
    const client = await prisma.client
      .update({ where: { id: req.params.id }, data: { status: req.body.status } })
      .catch((err) => { if (err.code === "P2025") return null; throw err; });
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(client);
  }
);

export default router;
