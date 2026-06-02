import prisma from "../../lib/prisma.js";
import { decrypt } from "../../lib/crypto.js";

async function getCred(clientId, key) {
  const c = await prisma.clientCredential.findUnique({
    where: { clientId_platform_key: { clientId, platform: "INSTAGRAM", key } },
  });
  return c ? decrypt(c.value) : null;
}

async function createMediaContainer(userId, accessToken, post) {
  const body = { caption: post.caption, access_token: accessToken };

  if (post.format === "CAROUSEL") {
    const childIds = [];
    for (const url of post.mediaUrls) {
      const params = new URLSearchParams({
        image_url: url,
        is_carousel_item: "true",
        access_token: accessToken,
      });
      const r = await fetch(`https://graph.instagram.com/v22.0/${userId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`Carousel item erro ${r.status}: ${txt.slice(0, 200)}`);
      }
      const d = await r.json();
      childIds.push(d.id);
    }
    body.media_type = "CAROUSEL";
    body.children = childIds.join(",");
  } else if (post.format === "REEL") {
    body.media_type = "REELS";
    body.video_url = post.mediaUrls[0];
  } else if (post.format === "STORY") {
    body.media_type = "STORIES";
    body.image_url = post.mediaUrls[0];
  } else {
    body.image_url = post.mediaUrls[0];
  }

  const params = new URLSearchParams(body);
  const res = await fetch(`https://graph.instagram.com/v22.0/${userId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Criar container IG erro ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.id;
}

async function publishContainer(userId, containerId, accessToken) {
  const params = new URLSearchParams({ creation_id: containerId, access_token: accessToken });
  const res = await fetch(`https://graph.instagram.com/v22.0/${userId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Publicar IG erro ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.id;
}

export async function publishScheduledPosts(client) {
  if (process.env.IG_PUBLISH_ENABLED !== "true") return;

  const now = new Date();
  const posts = await prisma.scheduledPost.findMany({
    where: { clientId: client.id, status: "SCHEDULED", scheduledAt: { lte: now } },
  });

  if (posts.length === 0) return;

  const [accessToken, userId] = await Promise.all([
    getCred(client.id, "access_token"),
    getCred(client.id, "user_id"),
  ]);

  if (!accessToken || !userId) {
    console.warn(`[publisher][${client.slug}] credenciais Instagram ausentes`);
    return;
  }

  for (const post of posts) {
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });
    try {
      const containerId = await createMediaContainer(userId, accessToken, post);
      const igPostId = await publishContainer(userId, containerId, accessToken);

      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), instagramPostId: String(igPostId) },
      });

      if (post.contentSuggestionId) {
        await prisma.contentSuggestion.update({
          where: { id: post.contentSuggestionId },
          data: { status: "DONE" },
        });
      }

      if (post.firstComment && igPostId) {
        const params = new URLSearchParams({ message: post.firstComment, access_token: accessToken });
        await fetch(`https://graph.instagram.com/v22.0/${igPostId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        }).catch(() => {});
      }
    } catch (err) {
      console.error(`[publisher][${client.slug}] post ${post.id}:`, err.message);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: "FAILED", errorMessage: err.message.slice(0, 500) },
      });
    }
  }
}
