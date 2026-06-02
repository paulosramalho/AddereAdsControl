import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getAnthropicKey(clientId) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "ANTHROPIC", key: "api_key" } },
  });
  return c ? decrypt(c.value) : process.env.ANTHROPIC_API_KEY ?? null;
}

function brtMonthStart() {
  const brtStr = new Date().toLocaleString("en-CA", { timeZone: "America/Belem" });
  const [year, month] = brtStr.split("-");
  return new Date(`${year}-${month}-01T12:00:00Z`);
}

export async function generateBoost(client) {
  const apiKey = await getAnthropicKey(client.id);
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const monthStart = brtMonthStart();

  const [posts, monthSpend, monthLeads] = await Promise.all([
    prisma.instagramPost.findMany({
      where: {
        clientId: client.id,
        timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        analysis: { isNot: null },
      },
      include: { analysis: true },
      orderBy: { analysis: { score: "desc" } },
      take: 10,
    }),
    prisma.campaignDaily.aggregate({
      where: { clientId: client.id, date: { gte: monthStart } },
      _sum: { spendCents: true },
    }),
    prisma.lead.count({
      where: { clientId: client.id, createdAt: { gte: monthStart } },
    }),
  ]);

  if (posts.length === 0) return { skipped: true, reason: "sem posts orgânicos com análise" };

  const totalSpendCents = monthSpend._sum.spendCents ?? 0;
  const spendBRL = (totalSpendCents / 100).toFixed(2);
  const cplBRL =
    monthLeads > 0 ? (totalSpendCents / monthLeads / 100).toFixed(2) : "N/A";

  const postList = posts
    .map(
      (p, i) =>
        `Post ${i + 1}: "${p.caption?.slice(0, 100) ?? "(sem legenda)"}"
  Score: ${p.analysis?.score ?? "N/A"}/10 | Curtidas: ${p.likes} | Comentários: ${p.comments} | Alcance: ${p.reach}`
    )
    .join("\n\n");

  const prompt = `Você é um especialista em tráfego pago para ${client.name} (${client.niche ?? "profissional"}).

Contexto do mês atual:
- Gasto total em anúncios: R$ ${spendBRL}
- Leads gerados: ${monthLeads}
- CPL atual: R$ ${cplBRL}

Posts orgânicos recentes com melhor desempenho:
${postList}

Sugira até 3 posts para impulsionar (boost), com valor de investimento e estimativa de leads.
Priorize posts com alto score e bom engajamento orgânico.

Retorne JSON:
{
  "suggestions": [
    {
      "postIndex": 1,
      "suggestedBudgetBRL": 150.00,
      "estimatedLeads": 5,
      "reasoning": "justificativa em 2 frases"
    }
  ]
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
  const suggestions = parsed.suggestions ?? [];

  let created = 0;
  for (const s of suggestions) {
    const idx = (Number(s.postIndex ?? 1) - 1);
    const post = posts[idx] ?? posts[0];
    await prisma.boostSuggestion.create({
      data: {
        clientId: client.id,
        postId: post.postId,
        postCaption: post.caption?.slice(0, 500) ?? null,
        suggestedBudget: Math.round(Number(s.suggestedBudgetBRL ?? 0) * 100),
        estimatedLeads: Math.round(Number(s.estimatedLeads ?? 0)),
        reasoning: s.reasoning ?? null,
        status: "PENDING",
      },
    });
    created++;
  }

  return { created };
}
