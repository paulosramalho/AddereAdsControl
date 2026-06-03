import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { validateBody } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const REFRESH_DAYS = 7;
const ACCESS_MINUTES = 15;

function cookieOpts(days) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: days * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function hashToken(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, clientId: user.clientId, role: user.role, clientName: user.client?.name ?? null, userName: user.name, userEmail: user.email, clientPlan: user.client?.plan ?? null },
    process.env.JWT_SECRET,
    { expiresIn: `${ACCESS_MINUTES}m` }
  );
}

async function issueRefreshToken(userId, days = REFRESH_DAYS) {
  const raw = randomBytes(40).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return raw;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

router.post("/login", authLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password, rememberMe } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { client: true } });
  if (!user || !user.active) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Credenciais inválidas" });
  }
  const cookieDays = rememberMe ? 30 : 1;
  const token = issueAccessToken(user);
  const refreshRaw = await issueRefreshToken(user.id, cookieDays);
  res.cookie("refresh_token", refreshRaw, cookieOpts(cookieDays));
  res.json({
    ok: true,
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, clientId: user.clientId },
  });
});

router.post("/refresh", async (req, res) => {
  const raw = req.cookies?.refresh_token;
  if (!raw) return res.status(401).json({ message: "Refresh token não encontrado" });

  const tokenHash = hashToken(raw);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { client: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return res.status(401).json({ message: "Refresh token inválido ou expirado" });
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  if (!stored.user.active) {
    return res.status(401).json({ message: "Usuário inativo" });
  }

  const token = issueAccessToken(stored.user);
  const refreshRaw = await issueRefreshToken(stored.user.id);
  res.cookie("refresh_token", refreshRaw, cookieOpts(REFRESH_DAYS));
  res.json({ ok: true, token });
});

const patchMeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

router.patch("/me", requireAuth, validateBody(patchMeSchema), async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { client: true },
  });
  if (!user) return res.status(404).json({ ok: false, message: "Usuário não encontrado" });

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ ok: false, message: "Informe a senha atual para alterar a senha" });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ ok: false, message: "Senha atual incorreta" });
    }
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 10);

  try {
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      include: { client: true },
    });
    const token = issueAccessToken(updated);
    return res.json({
      ok: true,
      token,
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, clientId: updated.clientId },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ ok: false, message: "E-mail já em uso" });
    }
    throw err;
  }
});

router.post("/logout", async (req, res) => {
  const raw = req.cookies?.refresh_token;
  if (raw) {
    const tokenHash = hashToken(raw);
    await prisma.refreshToken
      .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  res.clearCookie("refresh_token", { ...cookieOpts(0), maxAge: 0 });
  res.json({ ok: true });
});

export default router;
