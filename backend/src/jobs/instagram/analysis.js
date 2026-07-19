import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getAnthropicKey(clientId) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "ANTHROPIC", key: "api_key" } },
  });
  return c ? decrypt(c.value) : process.env.ANTHROPIC_API_KEY ?? null;
}

function buildPrompt(client, post) {
  return `Analise este post do Instagram para ${client.name} (${client.niche ?? "profissional"}).

Legenda: ${post.caption ?? "(sem legenda)"}
Tipo de mídia: ${post.mediaType}
Curtidas: ${post.likes} | Comentários: ${post.comments} | Alcance: ${post.reach} | Impressões: ${post.impressions}

Responda SEMPRE em português do Brasil. Retorne apenas o JSON, sem texto adicional:
{
  "score": número de 0 a 10,
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": ["melhoria 1", "melhoria 2"],
  "reasoning": "explicação em 2-3 frases"
}`;
}

async function runAnalysis(ai, client, post) {
  const msg = await ai.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: buildPrompt(client, post) }],
  });

  const raw = msg.content[0]?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    score: Math.round(Math.max(0, Math.min(10, Number(parsed.score ?? 0)))),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    reasoning: parsed.reasoning ?? null,
  };
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
    try {
      const result = await runAnalysis(ai, client, post);
      if (!result) continue;

      await prisma.postAnalysis.create({ data: { postId: post.id, ...result } });
      analyzed++;
    } catch (err) {
      console.error(`[post-analysis][${client.slug}] post ${post.postId}:`, err.message);
    }
  }

  return { analyzed };
}

// Analisa um único post, ignorando a janela de 30 dias — usado pelo botão
// "Forçar análise" para posts antigos que o job automático nunca alcança.
export async function analyzePostById(client, postId) {
  const apiKey = await getAnthropicKey(client.id);
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const post = await prisma.instagramPost.findFirst({
    where: { id: postId, clientId: client.id },
  });
  if (!post) return { skipped: true, reason: "Post não encontrado" };

  const ai = new Anthropic({ apiKey });
  const result = await runAnalysis(ai, client, post);
  if (!result) return { skipped: true, reason: "Resposta da IA inválida" };

  await prisma.postAnalysis.upsert({
    where: { postId: post.id },
    create: { postId: post.id, ...result },
    update: result,
  });

  return { analyzed: 1 };
}
