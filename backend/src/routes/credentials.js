import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSuperAdmin);

router.get("/", async (req, res) => {
  const creds = await prisma.clientCredential.findMany({
    where: { clientId: req.params.clientId },
    select: { id: true, platform: true, key: true, expiresAt: true, issuedAt: true, updatedAt: true },
    orderBy: [{ platform: "asc" }, { key: "asc" }],
  });
  res.json(creds);
});

const upsertSchema = z.object({
  value: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
  issuedAt: z.string().datetime().optional().nullable(),
});

router.put("/:platform/:key", validateBody(upsertSchema), async (req, res) => {
  const { clientId, platform, key } = req.params;
  const { value, expiresAt, issuedAt } = req.body;
  const encryptedValue = encrypt(value.trim());

  const cred = await prisma.clientCredential.upsert({
    where: { clientId_platform_key: { clientId, platform, key } },
    create: {
      clientId,
      platform,
      key,
      value: encryptedValue,
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
  res.json(cred);
});

router.get("/instagram/health", async (req, res) => {
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
    const r = await fetch(`https://graph.facebook.com/v22.0/me?fields=id,name&access_token=${token}`);
    const data = await r.json();
    if (data.error) {
      return res.json({ status: "expired", error: data.error.message });
    }
    return res.json({ status: "valid", accountId: data.id, accountName: data.name });
  } catch {
    return res.json({ status: "error", error: "Falha ao contatar a API do Instagram" });
  }
});

router.delete("/:platform/:key", async (req, res) => {
  const { clientId, platform, key } = req.params;
  await prisma.clientCredential.deleteMany({ where: { clientId, platform, key } });
  res.json({ ok: true });
});

export default router;
