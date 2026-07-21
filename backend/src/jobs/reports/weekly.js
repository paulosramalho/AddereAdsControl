import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import { truncateSafe } from "../../lib/text.js";

async function getAnthropicKey(clientId) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "ANTHROPIC", key: "api_key" } },
  });
  return c ? decrypt(c.value) : process.env.ANTHROPIC_API_KEY ?? null;
}

function brtWeekBounds() {
  const brtStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Belem" });
  const d = new Date(brtStr + "T12:00:00Z");
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    weekStart: new Date(mon.toISOString().slice(0, 10) + "T12:00:00Z"),
    weekEnd: new Date(sun.toISOString().slice(0, 10) + "T12:00:00Z"),
  };
}

export async function generateWeeklyReport(client) {
  const apiKey = await getAnthropicKey(client.id);
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const { weekStart, weekEnd } = brtWeekBounds();

  const [existing, adsAgg, leadsCount, igPosts] = await Promise.all([
    prisma.weeklyReport.findUnique({
      where: { clientId_weekStart: { clientId: client.id, weekStart } },
    }),
    prisma.campaignDaily.aggregate({
      where: { clientId: client.id, date: { gte: weekStart, lte: weekEnd } },
      _sum: { impressions: true, clicks: true, spendCents: true, conversions: true },
    }),
    prisma.lead.count({
      where: { clientId: client.id, createdAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.instagramPost.findMany({
      where: { clientId: client.id, timestamp: { gte: weekStart, lte: weekEnd } },
      include: { analysis: true },
      orderBy: { likes: "desc" },
      take: 5,
    }),
  ]);

  if (existing) return { skipped: true, reason: "relatório desta semana já existe" };

  const ads = adsAgg._sum;
  const spendBRL = ((ads.spendCents ?? 0) / 100).toFixed(2);
  const ctr =
    ads.clicks && ads.impressions
      ? ((ads.clicks / ads.impressions) * 100).toFixed(2)
      : "0.00";
  const cplBRL =
    leadsCount > 0 ? ((ads.spendCents ?? 0) / leadsCount / 100).toFixed(2) : "N/A";

  const igSummary = igPosts
    .map(
      (p) =>
        `- "${truncateSafe(p.caption, 80) ?? "(sem legenda)"}" — ${p.likes} curtidas, alcance ${p.reach}, score ${p.analysis?.score ?? "N/A"}/10`
    )
    .join("\n");

  const weekLabel = (d) =>
    d.toLocaleDateString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit" });

  const prompt = `Gere um relatório semanal de marketing para ${client.name} (${client.niche ?? "profissional"}).

SEMANA: ${weekLabel(weekStart)} a ${weekLabel(weekEnd)}

ANÚNCIOS PAGOS:
- Impressões: ${ads.impressions ?? 0}
- Cliques: ${ads.clicks ?? 0} | CTR: ${ctr}%
- Gasto: R$ ${spendBRL} | Conversões: ${ads.conversions ?? 0}
- Leads novos: ${leadsCount} | CPL: R$ ${cplBRL}

TOP POSTS ORGÂNICOS:
${igSummary || "Nenhum post nesta semana"}

Retorne JSON:
{
  "summary": "parágrafo único de 3-4 frases resumindo a semana",
  "insights": ["insight 1", "insight 2", "insight 3", "insight 4", "insight 5"]
}`;

  const ai = new Anthropic({ apiKey });
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { skipped: true, reason: "resposta Claude sem JSON" };

  const parsed = JSON.parse(jsonMatch[0]);

  await prisma.weeklyReport.upsert({
    where: { clientId_weekStart: { clientId: client.id, weekStart } },
    create: {
      clientId: client.id,
      weekStart,
      weekEnd,
      summary: parsed.summary ?? null,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      data: { ads: adsAgg._sum, leads: leadsCount, igPosts: igPosts.length },
    },
    update: {
      summary: parsed.summary ?? null,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      data: { ads: adsAgg._sum, leads: leadsCount, igPosts: igPosts.length },
    },
  });

  return { weekStart: weekStart.toISOString().slice(0, 10) };
}
