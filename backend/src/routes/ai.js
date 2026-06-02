import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireSameClient } from "../middleware/auth.js";
import { createAnthropicClient } from "../lib/anthropic.js";

const router = Router({ mergeParams: true });
router.use(requireAuth, requireSameClient);

const NICHE_SLOTS = {
  juridico:    ["08:00", "12:00", "18:00"],
  advocacia:   ["08:00", "12:00", "18:00"],
  direito:     ["08:00", "12:00", "18:00"],
  saude:       ["07:00", "12:30", "19:00"],
  medico:      ["07:00", "12:30", "19:00"],
  clinica:     ["07:00", "12:30", "19:00"],
  odonto:      ["07:00", "12:30", "19:00"],
  educacao:    ["08:00", "13:00", "21:00"],
  escola:      ["08:00", "13:00", "21:00"],
  curso:       ["08:00", "13:00", "21:00"],
  varejo:      ["09:00", "14:00", "20:00"],
  loja:        ["09:00", "14:00", "20:00"],
  moda:        ["09:00", "14:00", "20:00"],
  gastronomia: ["11:00", "17:00", "19:30"],
  restaurante: ["11:00", "17:00", "19:30"],
  bar:         ["11:00", "17:00", "19:30"],
  default:     ["09:00", "12:00", "19:00"],
};

router.get("/best-time", async (req, res) => {
  const { clientId } = req.params;
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { niche: true },
    });
    if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });

    const niche = (client.niche ?? "").toLowerCase();
    const matchedKey = Object.keys(NICHE_SLOTS).find(
      (k) => k !== "default" && niche.includes(k)
    );
    const slots = NICHE_SLOTS[matchedKey ?? "default"];
    res.json({ ok: true, slots, niche: matchedKey ?? "default" });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

router.post("/hashtags/suggest", async (req, res) => {
  const { clientId } = req.params;
  const { caption } = req.body;
  if (!caption?.trim()) {
    return res.status(400).json({ ok: false, message: "caption é obrigatório" });
  }
  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { niche: true, keywords: true },
    });
    if (!client) return res.status(404).json({ ok: false, message: "Cliente não encontrado" });

    const anthropic = createAnthropicClient();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Gere 25 a 30 hashtags relevantes para Instagram em português e inglês para este post.\nNicho: ${client.niche ?? "geral"}\nPalavras-chave: ${(client.keywords ?? []).join(", ") || "nenhuma"}\nLegenda: ${caption}\n\nRetorne APENAS as hashtags separadas por espaço, sem explicações. Exemplo: #direito #advocacia #advogado`,
        },
      ],
    });

    const hashtags = msg.content[0]?.text?.trim() ?? "";
    res.json({ ok: true, hashtags });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
