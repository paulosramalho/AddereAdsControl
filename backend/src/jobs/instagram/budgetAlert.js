import { Resend } from "resend";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getAlertConfig(clientId) {
  const creds = await prisma.clientCredential.findMany({
    where: {
      clientId,
      platform: "RESEND",
      key: { in: ["api_key", "from_email", "notify_emails", "notify_budget_alert"] },
    },
  });
  const map = {};
  for (const c of creds) map[c.key] = decrypt(c.value);
  return {
    apiKey: map.api_key ?? process.env.RESEND_API_KEY ?? null,
    fromEmail: map.from_email ?? process.env.NOTIFY_EMAIL_FROM ?? "onboarding@resend.dev",
    notifyEmails: map.notify_emails ?? "",
    enabled: map.notify_budget_alert !== "false",
  };
}

async function getRecipients(clientId, notifyEmails) {
  const users = await prisma.user.findMany({
    where: { clientId, active: true },
    select: { email: true },
  });
  const all = new Set(users.map((u) => u.email));
  if (notifyEmails) {
    notifyEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .forEach((e) => all.add(e));
  }
  return [...all];
}

export async function alertBudget(client) {
  const config = await getAlertConfig(client.id);
  if (!config.enabled) return { skipped: true, reason: "notify_budget_alert desabilitado" };
  if (!config.apiKey) return { skipped: true, reason: "RESEND não configurado" };

  const brtDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/Belem" });
  const [year, month] = brtDate.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const goal = await prisma.monthlyGoal.findFirst({
    where: { clientId: client.id, month: { gte: monthStart, lt: monthEnd } },
  });
  if (!goal?.budgetCents) return { skipped: true, reason: "Sem meta de budget configurada" };

  const spends = await prisma.campaignDaily.groupBy({
    by: ["clientId"],
    where: { clientId: client.id, date: { gte: monthStart, lt: monthEnd } },
    _sum: { spendCents: true },
  });

  const totalSpend = spends[0]?._sum?.spendCents ?? 0;
  const pct = totalSpend / goal.budgetCents;
  if (pct < 0.9) {
    return { skipped: true, reason: `Gasto ${Math.round(pct * 100)}% do budget — abaixo do limiar` };
  }

  const recipients = await getRecipients(client.id, config.notifyEmails);
  if (!recipients.length) return { skipped: true, reason: "Nenhum destinatário" };

  const pctStr = Math.round(pct * 100);
  const spendBRL = (totalSpend / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const goalBRL = (goal.budgetCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const isOver = pct >= 1;

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  <div style="background:#0f172a;color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:18px;font-weight:700;">Addere Ads Control</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Alerta de Budget — ${client.name}</div>
  </div>
  <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
    <div style="background:${isOver ? "#fef2f2" : "#fff7ed"};border:1px solid ${isOver ? "#dc2626" : "#d97706"};border-radius:8px;padding:16px;margin-bottom:20px;">
      <div style="font-size:15px;font-weight:700;color:${isOver ? "#dc2626" : "#d97706"};margin-bottom:8px;">
        ${isOver ? "⛔ Budget ultrapassado!" : "⚠️ Budget atingiu " + pctStr + "%"}
      </div>
      <p style="margin:0;color:#1e293b;font-size:14px;">
        Gasto acumulado no mês: <strong>R$ ${spendBRL}</strong> de <strong>R$ ${goalBRL}</strong> previstos.
      </p>
    </div>
    <p style="color:#475569;font-size:13px;">Verifique os anúncios no painel e considere ajustar o orçamento das campanhas ativas.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      Addere Ads Control — monitoramento automático diário
    </div>
  </div>
</div>`;

  try {
    const resend = new Resend(config.apiKey);
    const result = await resend.emails.send({
      from: config.fromEmail,
      to: recipients,
      subject: `${client.name} — Budget em ${pctStr}% — ${isOver ? "ultrapassado" : "ação recomendada"}`,
      html,
    });
    return { sent: true, to: recipients, pct: pctStr, id: result.data?.id };
  } catch (err) {
    console.error(`[budget-alert][${client.slug}] Email failed:`, err.message);
    return { sent: false, error: err.message };
  }
}
