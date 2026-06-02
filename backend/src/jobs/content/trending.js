import Anthropic from "@anthropic-ai/sdk";
import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";
import {
  buildSources,
  buildPrompt,
  fetchRssSignals,
  fetchRedditSignals,
  fetchYoutubeSignals,
} from "../../lib/trendingEngine.js";

async function getCred(clientId, platform, key) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform, key } },
  });
  return c ? decrypt(c.value) : null;
}

const FORMAT_MAP = { REEL: "REEL", CAROUSEL: "CAROUSEL", POST: "POST", STORIES: "STORIES" };

export async function generateTrending(client) {
  const apiKey =
    (await getCred(client.id, "ANTHROPIC", "api_key")) ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) return { skipped: true, reason: "ANTHROPIC_API_KEY não configurada" };

  const youtubeApiKey =
    (await getCred(client.id, "ANTHROPIC", "youtube_api_key")) ??
    process.env.YOUTUBE_API_KEY ??
    null;

  const sources = buildSources(client);

  const [rssResult, redditResult, youtubeResult] = await Promise.allSettled([
    fetchRssSignals(sources.rssFeeds),
    fetchRedditSignals(sources.subreddits),
    fetchYoutubeSignals(sources.youtubeQueries, youtubeApiKey),
  ]);

  const signals = [
    ...(rssResult.status === "fulfilled" ? rssResult.value : []),
    ...(redditResult.status === "fulfilled" ? redditResult.value : []),
    ...(youtubeResult.status === "fulfilled" ? youtubeResult.value : []),
  ];

  if (signals.length === 0) return { skipped: true, reason: "nenhum sinal coletado" };

  const prompt = buildPrompt(client, signals);
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
        title: s.title ?? "Sugestão de pauta",
        hook: s.hook ?? null,
        body: s.body ?? null,
        format: FORMAT_MAP[s.format?.toUpperCase()] ?? "POST",
        reasoning: s.reasoning ?? null,
        sources: Array.isArray(s.sources) ? s.sources : [],
        status: "PENDING",
      },
    });
    created++;
  }

  return { signals: signals.length, created };
}
