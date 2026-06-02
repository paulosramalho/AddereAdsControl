import { Router } from "express";
import multer from "multer";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient, requireAdminOrSuper } from "../middleware/auth.js";
import { isR2Configured, uploadBuffer, listObjects } from "../lib/r2.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas imagens e vídeos são aceitos"));
    }
  },
});

router.get("/", async (req, res) => {
  if (!isR2Configured()) return res.json({ ok: true, items: [] });
  const { clientId } = req.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } });
  if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });
  try {
    const items = await listObjects(client.slug);
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.post("/upload", requireAdminOrSuper, upload.single("file"), async (req, res) => {
  if (!isR2Configured()) {
    return res.status(503).json({ ok: false, message: "Armazenamento de mídia não configurado" });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, message: "Nenhum arquivo enviado" });
  }

  const { clientId } = req.params;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { slug: true } });
  if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });

  try {
    const url = await uploadBuffer({
      clientSlug: client.slug,
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
