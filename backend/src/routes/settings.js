import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { toPublicCredential } from "../lib/credentialDisplay.js";
import { fetchMetaGraph, metaGraphErrorToHealth } from "../lib/metaGraph.js";
import { requireAuth, requireSameClient, requireAdminOrSuper, requireFeature } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { planHasFeature } from "../lib/planFeatures.js";
import { isR2Configured } from "../lib/r2.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient, requireAdminOrSuper, requireFeature("settings"));

const ALLOWED_PLATFORMS = ["INSTAGRAM", "META_ADS", "GOOGLE_ADS", "ANTHROPIC", "RESEND"];
router.get("/credentials", async (req, res) => {
  const { clientId } = req.params;
  const creds = await prisma.clientCredential.findMany({
    where: { clientId, platform: { in: ALLOWED_PLATFORMS } },
    select: { id: true, platform: true, key: true, value: true, expiresAt: true, issuedAt: true, updatedAt: true },
    orderBy: [{ platform: "asc" }, { key: "asc" }],
  });
  res.json({ ok: true, credentials: creds.map(toPublicCredential) });
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
  const credentials = await prisma.clientCredential.findMany({
    where: { clientId, platform: "INSTAGRAM", key: { in: ["access_token", "user_id"] } },
  });
  const byKey = Object.fromEntries(credentials.map((c) => [c.key, c]));
  const accessTokenCred = byKey.access_token ?? null;
  const userIdCred = byKey.user_id ?? null;
  if (!accessTokenCred) return res.json({ status: "missing" });

  if (accessTokenCred.expiresAt && accessTokenCred.expiresAt <= new Date()) {
    return res.json({ status: "expired", error: "Data de expiração cadastrada já passou" });
  }

  let token;
  let userId = null;
  try { token = decrypt(accessTokenCred.value); } catch {
    return res.json({ status: "error", error: "Erro ao decifrar credencial" });
  }
  try { if (userIdCred) userId = decrypt(userIdCred.value); } catch {
    return res.json({ status: "error", error: "Erro ao decifrar ID do Instagram" });
  }
  try {
    const path = userId
      ? `${encodeURIComponent(userId)}?fields=id,username,name,media_count`
      : "me?fields=id,name";
    const { data } = await fetchMetaGraph(path, token);
    if (data.error) return res.json(metaGraphErrorToHealth(data.error));
    return res.json({
      status: "valid",
      accountId: data.id,
      accountName: data.username ?? data.name,
      accountUsername: data.username ?? null,
    });
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

  if (accessTokenCred?.expiresAt && accessTokenCred.expiresAt <= new Date()) {
    tokenHealth = { status: "expired", error: "Data de expiração cadastrada já passou" };
  } else if (accessToken) {
    try {
      const path = userId
        ? `${encodeURIComponent(userId)}?fields=id,username,name,media_count`
        : "me?fields=id,name";
      const { data: tokenData } = await fetchMetaGraph(path, accessToken);
      if (tokenData.error) {
        const health = metaGraphErrorToHealth(tokenData.error);
        tokenHealth = health;
        if (userId) igAccount = health;
      } else {
        tokenHealth = {
          status: "valid",
          accountId: tokenData.id,
          accountName: tokenData.username ?? tokenData.name,
        };
        if (userId) igAccount = { status: "valid", data: tokenData };
      }
    } catch {
      tokenHealth = { status: "error", error: "Falha ao contatar a API da Meta" };
    }
  }

  if (accessToken && userId && tokenHealth.status === "valid") {
    if (igAccount.status !== "valid") {
      try {
        const { data: accountData } = await fetchMetaGraph(
          `${encodeURIComponent(userId)}?fields=id,username,name,media_count`,
          accessToken
        );
        igAccount = accountData.error
          ? metaGraphErrorToHealth(accountData.error)
          : { status: "valid", data: accountData };
      } catch {
        igAccount = { status: "error", error: "Falha ao verificar a conta Instagram" };
      }
    }

    try {
      const { data: limitData } = await fetchMetaGraph(
        `${encodeURIComponent(userId)}/content_publishing_limit`,
        accessToken
      );
      publishLimit = limitData.error
        ? metaGraphErrorToHealth(limitData.error)
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
