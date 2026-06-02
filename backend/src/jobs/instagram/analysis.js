import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getAnthropicKey(clientId) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "ANTHROPIC", key: "api_key" } },
  });
  return c ? decrypt(c.value) : process.env.ANTHROPIC_API_KEY ?? null;
}

export async function analyzeInstagram(client) {
  const apiKey = await getAnthropicKey(client.id);
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const posts = await prisma.instagramPost.findMany({
    where: {
      clientId: client.id,
      analysis: null,
      timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { timestamp: "desc" },
    take: 10,
  });

  if (posts.length === 0) return { analyzed: 0 };

  const ai = new Anthropic({ apiKey });
  let analyzed = 0;

  for (const post of posts) {
    const prompt = `Analise este post do Instagram para ${client.name} (${client.niche ?? "profissional"}).

Legenda: ${post.caption ?? "(sem legenda)"}
Tipo de mídia: ${post.mediaType}
Curtidas: ${post.likes} | Comentários: ${post.comments} | Alcance: ${post.reach} | Impressões: ${post.impressions}

Retorne JSON:
{
  "score": número de 0 a 10,
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": ["melhoria 1", "melhoria 2"],
  "reasoning": "explicação em 2-3 frases"
}`;

    try {
      const msg = await ai.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = msg.content[0]?.text ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]);

      await prisma.postAnalysis.create({
        data: {
          postId: post.id,
          score: Math.round(Math.max(0, Math.min(10, Number(parsed.score ?? 0)))),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          reasoning: parsed.reasoning ?? null,
        },
      });
      analyzed++;
    } catch (err) {
      console.error(`[post-analysis][${client.slug}] post ${post.postId}:`, err.message);
    }
  }

  return { analyzed };
}
