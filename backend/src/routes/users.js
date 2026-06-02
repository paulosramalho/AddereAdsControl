import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.js";
import { requireAuth, requireAdminOrSuper, requireSameClient } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireAdminOrSuper, requireSameClient);

router.get("/", async (req, res) => {
  const { clientId } = req.params;
  const [users, client] = await Promise.all([
    prisma.user.findMany({
      where: { clientId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.client.findUnique({ where: { id: clientId }, select: { maxAdmins: true, maxViewers: true } }),
  ]);
  res.json({ ok: true, users, maxAdmins: client.maxAdmins, maxViewers: client.maxViewers });
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

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { maxAdmins: true, maxViewers: true },
  });
  if (role === "ADMIN" && client.maxAdmins !== null) {
    const count = await prisma.user.count({ where: { clientId, role: "ADMIN" } });
    if (count >= client.maxAdmins)
      return res.status(409).json({ ok: false, message: `Limite de ${client.maxAdmins} administrador(es) atingido` });
  }
  if (role === "VIEWER" && client.maxViewers !== null) {
    const count = await prisma.user.count({ where: { clientId, role: "VIEWER" } });
    if (count >= client.maxViewers)
      return res.status(409).json({ ok: false, message: `Limite de ${client.maxViewers} visualizador(es) atingido` });
  }

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

const updateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório").optional(),
  email: z.string().email("E-mail inválido").optional(),
  role: z.enum(["ADMIN", "VIEWER"]).optional(),
  password: z.string().min(8, "Mínimo 8 caracteres").optional(),
});

router.put("/:userId", validateBody(updateSchema), async (req, res) => {
  const { clientId, userId } = req.params;
  const { name, email, role, password } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Usuário não encontrado" });

  if (role && role !== user.role) {
    const client = await prisma.client.findUnique({
      where: { id: clientId }, select: { maxAdmins: true, maxViewers: true },
    });
    if (role === "ADMIN" && client.maxAdmins !== null) {
      const count = await prisma.user.count({ where: { clientId, role: "ADMIN" } });
      if (count >= client.maxAdmins)
        return res.status(409).json({ ok: false, message: `Limite de ${client.maxAdmins} administrador(es) atingido` });
    }
    if (role === "VIEWER" && client.maxViewers !== null) {
      const count = await prisma.user.count({ where: { clientId, role: "VIEWER" } });
      if (count >= client.maxViewers)
        return res.status(409).json({ ok: false, message: `Limite de ${client.maxViewers} visualizador(es) atingido` });
    }
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (password !== undefined) data.passwordHash = await bcrypt.hash(password, 12);

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  }).catch((err) => {
    if (err.code === "P2002") return null;
    throw err;
  });
  if (!updated) return res.status(409).json({ ok: false, message: "E-mail já em uso" });
  res.json({ ok: true, user: updated });
});

router.delete("/:userId", async (req, res) => {
  const { clientId, userId } = req.params;
  if (req.user.id === userId)
    return res.status(400).json({ ok: false, message: "Não é possível remover o próprio usuário" });
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Usuário não encontrado" });
  await prisma.user.delete({ where: { id: userId } });
  res.json({ ok: true });
});

export default router;
