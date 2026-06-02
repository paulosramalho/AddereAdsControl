import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getCred(clientId, key) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "INSTAGRAM", key } },
  });
  return c ? decrypt(c.value) : null;
}

const FB_BASE = "https://graph.facebook.com/v22.0";

async function fetchPostInsights(postId, accessToken) {
  try {
    const params = new URLSearchParams({
      metric: "impressions,reach",
      access_token: accessToken,
    });
    const res = await fetch(`${FB_BASE}/${postId}/insights?${params}`);
    if (!res.ok) return { impressions: 0, reach: 0 };
    const data = await res.json();
    const metrics = {};
    (data.data ?? []).forEach((m) => {
      metrics[m.name] = m.values?.[0]?.value ?? 0;
    });
    return { impressions: metrics.impressions ?? 0, reach: metrics.reach ?? 0 };
  } catch {
    return { impressions: 0, reach: 0 };
  }
}

export async function collectInstagram(client) {
  const [accessToken, userId] = await Promise.all([
    getCred(client.id, "access_token"),
    getCred(client.id, "user_id"),
  ]);

  if (!accessToken || !userId) {
    return { skipped: true, reason: "credenciais Instagram incompletas" };
  }

  const params = new URLSearchParams({
    fields: "id,media_type,caption,permalink,timestamp,like_count,comments_count",
    limit: "50",
    access_token: accessToken,
  });

  const res = await fetch(`${FB_BASE}/${userId}/media?${params}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`IG Graph API erro ${res.status}: ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const posts = data.data ?? [];

  let upserted = 0;
  for (const post of posts) {
    const insights = await fetchPostInsights(post.id, accessToken);
    await prisma.instagramPost.upsert({
      where: { clientId_postId: { clientId: client.id, postId: post.id } },
      create: {
        clientId: client.id,
        postId: post.id,
        mediaType: post.media_type ?? "UNKNOWN",
        caption: post.caption ?? null,
        permalink: post.permalink ?? null,
        timestamp: new Date(post.timestamp),
        likes: post.like_count ?? 0,
        comments: post.comments_count ?? 0,
        reach: insights.reach,
        impressions: insights.impressions,
      },
      update: {
        likes: post.like_count ?? 0,
        comments: post.comments_count ?? 0,
        reach: insights.reach,
        impressions: insights.impressions,
      },
    });
    upserted++;
  }

  return { upserted };
}
