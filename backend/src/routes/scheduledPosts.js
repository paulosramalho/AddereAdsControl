import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient, requireAdminOrSuper } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

router.get("/", async (req, res) => {
  const { clientId } = req.params;
  const { month } = req.query;

  const where = { clientId };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    where.scheduledAt = { gte: start, lt: end };
  }

  const posts = await prisma.scheduledPost.findMany({
    where,
    include: { contentSuggestion: true },
    orderBy: { scheduledAt: "asc" },
  });
  res.json({ ok: true, posts });
});

const createSchema = z.object({
  format: z.enum(["PHOTO", "CAROUSEL", "REEL", "STORY"]),
  caption: z.string().optional(),
  firstComment: z.string().optional(),
  mediaUrls: z.array(z.string().url()).default([]),
  scheduledAt: z.string().datetime(),
  contentSuggestionId: z.string().optional(),
  status: z.enum(["DRAFT", "SCHEDULED"]).default("SCHEDULED"),
});

router.post("/", requireAdminOrSuper, validateBody(createSchema), async (req, res) => {
  const { clientId } = req.params;
  const { format, caption, firstComment, mediaUrls, scheduledAt, contentSuggestionId, status } = req.body;
  try {
    const data = {
      clientId,
      format,
      caption,
      firstComment,
      mediaUrls,
      scheduledAt: new Date(scheduledAt),
      status,
    };
    if (contentSuggestionId) data.contentSuggestionId = contentSuggestionId;

    const post = await prisma.scheduledPost.create({
      data,
      include: { contentSuggestion: true },
    });
    res.status(201).json({ ok: true, post });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.get("/:postId", async (req, res) => {
  const { clientId, postId } = req.params;
  const post = await prisma.scheduledPost.findUnique({
    where: { id: postId },
    include: { contentSuggestion: true },
  });
  if (!post || post.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Post não encontrado" });
  res.json({ ok: true, post });
});

const updateSchema = z.object({
  format: z.enum(["PHOTO", "CAROUSEL", "REEL", "STORY"]).optional(),
  caption: z.string().optional(),
  firstComment: z.string().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
  contentSuggestionId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "CANCELLED"]).optional(),
});

router.put("/:postId", requireAdminOrSuper, validateBody(updateSchema), async (req, res) => {
  const { clientId, postId } = req.params;
  const existing = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!existing || existing.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Post não encontrado" });

  const data = { ...req.body };
  if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);

  const post = await prisma.scheduledPost.update({
    where: { id: postId },
    data,
    include: { contentSuggestion: true },
  });
  res.json({ ok: true, post });
});

router.delete("/:postId", requireAdminOrSuper, async (req, res) => {
  const { clientId, postId } = req.params;
  const existing = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!existing || existing.clientId !== clientId)
    return res.status(404).json({ ok: false, message: "Post não encontrado" });

  const post = await prisma.scheduledPost.update({
    where: { id: postId },
    data: { status: "CANCELLED" },
  });
  res.json({ ok: true, post });
});

export default router;
