import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSuperAdmin);

router.get("/", async (req, res) => {
  const { clientId } = req.params;
  const users = await prisma.user.findMany({
    where: { clientId },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ ok: true, users });
});

const createSchema = z.object({
  email: z.string().email("E-mail inválido"),
  name: z.string().min(1, "Nome obrigatório"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["ADMIN", "VIEWER"]).default("VIEWER"),
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const { clientId } = req.params;
  const { email, name, password, role } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user
    .create({
      data: { email, name, passwordHash, role, clientId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    })
    .catch((err) => {
      if (err.code === "P2002") return null;
      throw err;
    });
  if (!user) return res.status(409).json({ ok: false, message: "E-mail já em uso" });
  res.status(201).json({ ok: true, user });
});

router.delete("/:userId", async (req, res) => {
  const { clientId, userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Usuário não encontrado" });
  await prisma.user.delete({ where: { id: userId } });
  res.json({ ok: true });
});

export default router;
