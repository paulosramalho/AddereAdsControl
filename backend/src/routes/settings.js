import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { requireAuth, requireSameClient, requireAdminOrSuper, requireFeature } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { planHasFeature } from "../lib/planFeatures.js";
import { isR2Configured } from "../lib/r2.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient, requireAdminOrSuper, requireFeature("settings"));

const ALLOWED_PLATFORMS = ["INSTAGRAM", "META_ADS", "GOOGLE_ADS", "ANTHROPIC", "RESEND"];
const FB_BASE = "https://graph.facebook.com/v22.0";

router.get("/credentials", async (req, res) => {
  const { clientId } = req.params;
  const creds = await prisma.clientCredential.findMany({
    where: { clientId, platform: { in: ALLOWED_PLATFORMS } },
    select: { id: true, platform: true, key: true, expiresAt: true, issuedAt: true, updatedAt: true },
    orderBy: [{ platform: "asc" }, { key: "asc" }],
  });
  res.json({ ok: true, credentials: creds });
});

const upsertSchema = z.object({
  value: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
});

router.put("/credentials/:platform/:key", validateBody(upsertSchema), async (req, res) => {
  const { clientId, platform, key } = req.params;
  if (!ALLOWED_PLATFORMS.includes(platform))
    return res.status(400).json({ ok: false, message: "Plataforma inválida" });

  const { value, expiresAt, issuedAt } = req.body;
  const encryptedValue = encrypt(value.trim());

  const cred = await prisma.clientCredential.upsert({
    where: { clientId_platform_key: { clientId, platform, key } },
    create: {
      clientId, platform, key, value: encryptedValue,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
    },
    update: {
      value: encryptedValue,
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      ...(issuedAt !== undefined && { issuedAt: issuedAt ? new Date(issuedAt) : null }),
    },
    select: { id: true, platform: true, key: true, expiresAt: true, issuedAt: true, updatedAt: true },
  });
  res.json({ ok: true, credential: cred });
});

router.delete("/credentials/:platform/:key", async (req, res) => {
  const { clientId, platform, key } = req.params;
  if (!ALLOWED_PLATFORMS.includes(platform))
    return res.status(400).json({ ok: false, message: "Plataforma inválida" });
  await prisma.clientCredential.deleteMany({ where: { clientId, platform, key } });
  res.json({ ok: true });
});

router.get("/credentials/instagram/health", async (req, res) => {
  const { clientId } = req.params;
  const cred = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "INSTAGRAM", key: "access_token" } },
  });
  if (!cred) return res.json({ status: "missing" });

  let token;
  try { token = decrypt(cred.value); } catch {
    return res.json({ status: "error", error: "Erro ao decifrar credencial" });
  }
  try {
    const r = await fetch(`${FB_BASE}/me?fields=id,name&access_token=${token}`);
    const data = await r.json();
    if (data.error) return res.json({ status: "expired", error: data.error.message });
    return res.json({ status: "valid", accountId: data.id, accountName: data.name });
  } catch {
    return res.json({ status: "error", error: "Falha ao contatar a API do Instagram" });
  }
});

router.get("/publishing-readiness", async (req, res) => {
  const { clientId } = req.params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true, status: true, plan: true },
  });
  if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });

  const credentials = await prisma.clientCredential.findMany({
    where: { clientId, platform: "INSTAGRAM", key: { in: ["access_token", "user_id"] } },
    select: { key: true, value: true, expiresAt: true, updatedAt: true },
  });
  const byKey = Object.fromEntries(credentials.map((c) => [c.key, c]));
  const accessTokenCred = byKey.access_token ?? null;
  const userIdCred = byKey.user_id ?? null;

  let accessToken = null;
  let userId = null;
  let tokenHealth = { status: accessTokenCred ? "error" : "missing" };
  let igAccount = { status: userIdCred ? "pending" : "missing" };
  let publishLimit = null;

  try {
    if (accessTokenCred) accessToken = decrypt(accessTokenCred.value);
    if (userIdCred) userId = decrypt(userIdCred.value);
  } catch {
    tokenHealth = { status: "error", error: "Erro ao decifrar credencial do Instagram" };
  }

  if (accessToken) {
    try {
      const tokenRes = await fetch(`${FB_BASE}/me?fields=id,name&access_token=${accessToken}`);
      const tokenData = await tokenRes.json();
      tokenHealth = tokenData.error
        ? { status: "expired", error: tokenData.error.message }
        : { status: "valid", accountId: tokenData.id, accountName: tokenData.name };
    } catch {
      tokenHealth = { status: "error", error: "Falha ao contatar a API da Meta" };
    }
  }

  if (accessToken && userId && tokenHealth.status === "valid") {
    try {
      const accountParams = new URLSearchParams({
        fields: "id,username,name,media_count",
        access_token: accessToken,
      });
      const accountRes = await fetch(`${FB_BASE}/${userId}?${accountParams}`);
      const accountData = await accountRes.json();
      igAccount = accountData.error
        ? { status: "error", error: accountData.error.message }
        : { status: "valid", data: accountData };
    } catch {
      igAccount = { status: "error", error: "Falha ao verificar a conta Instagram" };
    }

    try {
      const limitRes = await fetch(`${FB_BASE}/${userId}/content_publishing_limit?access_token=${accessToken}`);
      const limitData = await limitRes.json();
      publishLimit = limitData.error
        ? { status: "error", error: limitData.error.message }
        : { status: "valid", data: limitData.data ?? [] };
    } catch {
      publishLimit = { status: "error", error: "Falha ao verificar limite de publicação" };
    }
  }

  const r2Configured = isR2Configured();
  const publishEnabled = process.env.IG_PUBLISH_ENABLED === "true";
  const checks = [
    {
      key: "client-active",
      label: "Cliente ativo",
      ok: client.status === "ACTIVE",
      detail: client.status,
    },
    {
      key: "plan-publish",
      label: "Plano com publicação",
      ok: planHasFeature(client.plan, "publish"),
      detail: client.plan,
    },
    {
      key: "r2",
      label: "Biblioteca de mídia configurada",
      ok: r2Configured,
      detail: r2Configured ? "R2 configurado" : "Variáveis R2 ausentes",
    },
    {
      key: "publish-enabled",
      label: "Publicador habilitado no ambiente",
      ok: publishEnabled,
      detail: publishEnabled ? "IG_PUBLISH_ENABLED=true" : "IG_PUBLISH_ENABLED diferente de true",
    },
    {
      key: "ig-token",
      label: "Token Instagram salvo e válido",
      ok: tokenHealth.status === "valid",
      detail: tokenHealth.status === "valid" ? tokenHealth.accountName : tokenHealth.error ?? tokenHealth.status,
    },
    {
      key: "ig-user-id",
      label: "ID da conta Instagram salvo",
      ok: Boolean(userId),
      detail: userId ? "Configurado" : "Não configurado",
    },
    {
      key: "ig-account",
      label: "Conta Instagram acessível pelo token",
      ok: igAccount.status === "valid",
      detail: igAccount.status === "valid" ? `@${igAccount.data.username ?? igAccount.data.id}` : igAccount.error ?? igAccount.status,
    },
    {
      key: "ig-publish-permission",
      label: "Permissão de publicação confirmada",
      ok: publishLimit?.status === "valid",
      detail: publishLimit?.status === "valid" ? "content_publishing_limit acessível" : publishLimit?.error ?? "Aguardando token e ID da conta",
    },
  ];

  res.json({
    ok: true,
    ready: checks.every((check) => check.ok),
    client,
    checks,
    tokenHealth,
    igAccount,
    publishLimit,
    credentials: {
      accessTokenUpdatedAt: accessTokenCred?.updatedAt ?? null,
      accessTokenExpiresAt: accessTokenCred?.expiresAt ?? null,
      userIdUpdatedAt: userIdCred?.updatedAt ?? null,
    },
  });
});

export default router;
