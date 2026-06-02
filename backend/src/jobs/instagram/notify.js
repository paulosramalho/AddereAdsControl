import { Resend } from "resend";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getResendClient(clientId) {
  const [keyCred, fromCred] = await Promise.all([
    prisma.clientCredential.findUnique({
      where: { clientId_platform_key: { clientId, platform: "RESEND", key: "api_key" } },
    }),
    prisma.clientCredential.findUnique({
      where: { clientId_platform_key: { clientId, platform: "RESEND", key: "from_email" } },
    }),
  ]);
  const apiKey = keyCred ? decrypt(keyCred.value) : (process.env.RESEND_API_KEY ?? null);
  const fromEmail = fromCred
    ? decrypt(fromCred.value)
    : (process.env.NOTIFY_EMAIL_FROM ?? "onboarding@resend.dev");
  return apiKey ? { resend: new Resend(apiKey), fromEmail } : null;
}

async function getTokenDaysUsed(clientId) {
  const cred = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "INSTAGRAM", key: "access_token" } },
  });
  if (!cred?.issuedAt) return null;
  return Math.floor((Date.now() - new Date(cred.issuedAt).getTime()) / 86400000);
}

async function getRecipients(clientId) {
  const users = await prisma.user.findMany({
    where: { clientId, active: true },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Belem" });
}

function postCard(post) {
  const { analysis } = post;
  const isHigh = analysis.score >= 7;
  const color = isHigh ? "#059669" : "#dc2626";
  const label = isHigh ? "Alto desempenho" : "Baixo desempenho";
  const caption = post.caption
    ? post.caption.slice(0, 140) + (post.caption.length > 140 ? "…" : "")
    : "(sem legenda)";

  return `
  <div style="border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:0 8px 8px 0;padding:14px 16px;margin-bottom:12px;background:#fff;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="background:${color}22;color:${color};font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;">${label}</span>
      <span style="font-size:11px;color:#64748b;">Score ${analysis.score}/10</span>
      <span style="font-size:11px;color:#94a3b8;margin-left:auto;">${fmt(post.timestamp)}</span>
    </div>
    <p style="font-size:13px;color:#1e293b;margin:0 0 8px;line-height:1.5;">${caption}</p>
    <div style="display:flex;gap:16px;font-size:12px;color:#64748b;margin-bottom:8px;">
      <span>❤️ ${post.likes.toLocaleString("pt-BR")} curtidas</span>
      <span>💬 ${post.comments.toLocaleString("pt-BR")} comentários</span>
      ${post.reach ? `<span>👁 ${post.reach.toLocaleString("pt-BR")} alcance</span>` : ""}
    </div>
    ${analysis.reasoning ? `<p style="font-size:12px;color:#475569;font-style:italic;margin:0 0 8px;">"${analysis.reasoning}"</p>` : ""}
    ${post.permalink ? `<a href="${post.permalink}" style="font-size:12px;color:#2563eb;">Ver no Instagram →</a>` : ""}
  </div>`;
}

function tokenRenewalBanner(daysUsed) {
  if (daysUsed < 45) return "";
  const isUrgent = daysUsed >= 55;
  const bg = isUrgent ? "#fef2f2" : "#fff7ed";
  const border = isUrgent ? "#dc2626" : "#d97706";
  const text = isUrgent
    ? `⚠️ <strong>Token expira em breve!</strong> Gerado há ${daysUsed} dias (expira em ~60). Renove no <a href="https://developers.facebook.com/tools/explorer/" style="color:${border};">Graph API Explorer</a>.`
    : `🔔 Token gerado há ${daysUsed} dias — renove em até ${60 - daysUsed} dias para não interromper a coleta.`;
  return `
  <div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#1e293b;">
    ${text}
  </div>`;
}

export async function notifyInstagram(client) {
  const [resendInfo, tokenDays, recipients] = await Promise.all([
    getResendClient(client.id),
    getTokenDaysUsed(client.id),
    getRecipients(client.id),
  ]);

  if (!resendInfo) return { skipped: true, reason: "RESEND não configurado" };
  if (!recipients.length) return { skipped: true, reason: "Nenhum destinatário configurado" };

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const posts = await prisma.instagramPost.findMany({
    where: { clientId: client.id, timestamp: { gte: cutoff }, analysis: { isNot: null } },
    include: { analysis: true },
    orderBy: { timestamp: "desc" },
  });

  const investPosts = posts.filter((p) => p.analysis.score >= 7).slice(0, 5);
  const removePosts = posts.filter((p) => p.analysis.score <= 4).slice(0, 5);

  if (!investPosts.length && !removePosts.length && (tokenDays === null || tokenDays < 45)) {
    return { skipped: true, reason: "Nenhum post para destacar e token OK" };
  }

  const total = investPosts.length + removePosts.length;
  const subject = `${client.name} — ${total} post${total !== 1 ? "s" : ""} precisam de atenção`;

  const investSection = investPosts.length > 0
    ? `<h3 style="margin:20px 0 8px;color:#059669;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">
        Alto desempenho — considere impulsionar (${investPosts.length})
      </h3>
      ${investPosts.map(postCard).join("")}`
    : "";

  const removeSection = removePosts.length > 0
    ? `<h3 style="margin:20px 0 8px;color:#dc2626;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">
        Baixo desempenho — revisar ou remover (${removePosts.length})
      </h3>
      ${removePosts.map(postCard).join("")}`
    : "";

  const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
  <div style="background:#0f172a;color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
    <div style="font-size:18px;font-weight:700;">Addere Ads Control</div>
    <div style="color:#94a3b8;font-size:13px;margin-top:4px;">Análise de Conteúdo — ${client.name}</div>
  </div>
  <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
    ${tokenDays != null ? tokenRenewalBanner(tokenDays) : ""}
    ${investSection}
    ${removeSection}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
      Addere Ads Control — análise automática diária via Claude AI
    </div>
  </div>
</div>`;

  try {
    const result = await resendInfo.resend.emails.send({
      from: resendInfo.fromEmail,
      to: recipients,
      subject,
      html,
    });
    return { sent: true, to: recipients, id: result.data?.id };
  } catch (err) {
    console.error(`[instagram-notify][${client.slug}] Email failed:`, err.message);
    return { sent: false, error: err.message };
  }
}
