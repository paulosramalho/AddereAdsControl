import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { requireAuth, requireSuperAdmin } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSuperAdmin);

const NOTIFY_KEYS = [
  "notify_emails",
  "notify_daily_summary",
  "notify_token_alert",
  "notify_budget_alert",
];

router.get("/", async (req, res) => {
  const { clientId } = req.params;
  const creds = await prisma.clientCredential.findMany({
    where: { clientId, platform: "RESEND", key: { in: NOTIFY_KEYS } },
  });
  const map = {};
  for (const c of creds) map[c.key] = decrypt(c.value);
  res.json({
    notify_emails: map.notify_emails ?? "",
    notify_daily_summary: map.notify_daily_summary !== "false",
    notify_token_alert: map.notify_token_alert !== "false",
    notify_budget_alert: map.notify_budget_alert !== "false",
  });
});

const prefsSchema = z.object({
  notify_emails: z.string().default(""),
  notify_daily_summary: z.boolean().default(true),
  notify_token_alert: z.boolean().default(true),
  notify_budget_alert: z.boolean().default(true),
});

router.put("/", validateBody(prefsSchema), async (req, res) => {
  const { clientId } = req.params;
  const { notify_emails, notify_daily_summary, notify_token_alert, notify_budget_alert } = req.body;

  const toSave = [
    { key: "notify_emails", value: notify_emails },
    { key: "notify_daily_summary", value: String(notify_daily_summary) },
    { key: "notify_token_alert", value: String(notify_token_alert) },
    { key: "notify_budget_alert", value: String(notify_budget_alert) },
  ];

  await Promise.all(
    toSave.map(({ key, value }) =>
      prisma.clientCredential.upsert({
        where: { clientId_platform_key: { clientId, platform: "RESEND", key } },
        create: { clientId, platform: "RESEND", key, value: encrypt(value) },
        update: { value: encrypt(value) },
      })
    )
  );

  res.json({ ok: true });
});

export default router;
