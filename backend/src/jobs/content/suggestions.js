import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getAnthropicKey(clientId) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "ANTHROPIC", key: "api_key" } },
  });
  return c ? decrypt(c.value) : process.env.ANTHROPIC_API_KEY ?? null;
}

const FORMAT_MAP = { REEL: "REEL", CAROUSEL: "CAROUSEL", POST: "POST", STORIES: "STORIES" };

export async function generateSuggestions(client) {
  const apiKey = await getAnthropicKey(client.id);
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const analyses = await prisma.postAnalysis.findMany({
    where: {
      score: { gte: 7 },
      post: {
        clientId: client.id,
        timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    },
    include: { post: true },
    orderBy: { score: "desc" },
    take: 8,
  });

  if (analyses.length === 0) {
    return { skipped: true, reason: "sem posts com score >= 7 nos últimos 30 dias" };
  }

  const postSummaries = analyses
    .map(
      (a, i) =>
        `Post ${i + 1}: "${a.post.caption?.slice(0, 120) ?? "(sem legenda)"}"
  Score: ${a.score}/10 | Curtidas: ${a.post.likes} | Alcance: ${a.post.reach}
  Pontos fortes: ${a.strengths.join(", ")}
  Análise: ${a.reasoning ?? ""}`
    )
    .join("\n\n");

  const prompt = `Você é um estrategista de conteúdo para ${client.name}, ${client.niche ?? "profissional"}.
Tom: ${client.contentTone ?? "informativo e acessível"}.
Público-alvo: ${client.targetAudience ?? "público geral"}.

Com base nos posts de melhor desempenho abaixo, sugira 5 novas pautas de conteúdo:

${postSummaries}

Retorne JSON:
{
  "suggestions": [
    {
      "title": "título da pauta",
      "hook": "primeira frase que prende atenção",
      "body": "desenvolvimento em 2-3 frases",
      "format": "REEL|CAROUSEL|POST|STORIES",
      "reasoning": "por que este conteúdo deve funcionar"
    }
  ]
}`;

  const ai = new Anthropic({ apiKey });
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0]?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { skipped: true, reason: "resposta Claude sem JSON" };

  const parsed = JSON.parse(jsonMatch[0]);
  const suggestions = parsed.suggestions ?? [];

  let created = 0;
  for (const s of suggestions) {
    await prisma.contentSuggestion.create({
      data: {
        clientId: client.id,
        title: s.title ?? "Sugestão",
        hook: s.hook ?? null,
        body: s.body ?? null,
        format: FORMAT_MAP[s.format?.toUpperCase()] ?? "POST",
        reasoning: s.reasoning ?? null,
        sources: [],
        status: "PENDING",
      },
    });
    created++;
  }

  return { created };
}
