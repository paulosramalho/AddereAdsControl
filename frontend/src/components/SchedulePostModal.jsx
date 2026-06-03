import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

const FORMAT_OPTIONS = [
  { value: "PHOTO",    label: "Foto" },
  { value: "CAROUSEL", label: "Carrossel (2–10 imagens)" },
  { value: "REEL",     label: "Reel (vídeo MP4)" },
  { value: "STORY",    label: "Story (foto ou vídeo, 24h)" },
];

const FORMAT_ACCEPT = {
  PHOTO:    "image/jpeg,image/png,image/webp",
  CAROUSEL: "image/jpeg,image/png,image/webp",
  REEL:     "video/mp4,video/quicktime",
  STORY:    "image/jpeg,image/png,video/mp4,video/quicktime",
};

const FORMAT_HINT = {
  PHOTO:    "JPEG/PNG pública ≤8 MB",
  CAROUSEL: "JPEG/PNG públicas — mínimo 2, máximo 10",
  REEL:     "Vídeo MP4 H.264 público ≤1 GB / ≤15 min",
  STORY:    "Foto JPEG/PNG ou vídeo MP4 ≤100 MB — ratio 9:16 ideal",
};

function defaultBRTFields(date) {
  const base = date
    ? new Date(date.toLocaleString("en-US", { timeZone: "America/Belem" }))
    : (() => {
        const d = new Date(Date.now() + 24 * 3600 * 1000);
        return new Date(d.toLocaleString("en-US", { timeZone: "America/Belem" }));
      })();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`,
    time: "09:00",
  };
}

function toBRTFields(isoString) {
  const brt = new Date(new Date(isoString).toLocaleString("en-US", { timeZone: "America/Belem" }));
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${brt.getFullYear()}-${pad(brt.getMonth() + 1)}-${pad(brt.getDate())}`,
    time: `${pad(brt.getHours())}:${pad(brt.getMinutes())}`,
  };
}

const EMPTY_FORM = (date) => ({
  ...defaultBRTFields(date),
  format: "PHOTO",
  caption: "",
  firstComment: "",
  mediaUrls: [""],
  contentSuggestionId: "",
});

export default function SchedulePostModal({ open, post, defaultDate, clientId, onClose, onSave, initialValues }) {
  const { addToast } = useToast();
  const fileRefs = useRef({});

  const [form, setForm] = useState(EMPTY_FORM(defaultDate));
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loadingBestTime, setLoadingBestTime] = useState(false);
  const [bestTimeSlots, setBestTimeSlots] = useState([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);

  async function fetchBestTime() {
    setLoadingBestTime(true);
    setBestTimeSlots([]);
    try {
      const res = await api.get(`/clients/${clientId}/ai/best-time`);
      const d = await res.json();
      if (d.ok) {
        setBestTimeSlots(d.slots);
      } else {
        addToast(d.message ?? "Erro ao buscar horários", "error");
      }
    } catch {
      addToast("Erro ao buscar horários", "error");
    } finally {
      setLoadingBestTime(false);
    }
  }

  async function suggestHashtags() {
    if (!form.caption.trim()) {
      addToast("Escreva a legenda antes de gerar hashtags", "warning");
      return;
    }
    setLoadingHashtags(true);
    try {
      const res = await api.post(`/clients/${clientId}/ai/hashtags/suggest`, { caption: form.caption });
      const d = await res.json();
      if (d.ok) {
        setForm((f) => ({ ...f, firstComment: d.hashtags }));
        addToast("Hashtags geradas", "success");
      } else {
        addToast(d.message ?? "Erro ao gerar hashtags", "error");
      }
    } catch {
      addToast("Erro ao gerar hashtags", "error");
    } finally {
      setLoadingHashtags(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setShowLibrary(false);
    setLibraryItems([]);
    setBestTimeSlots([]);

    if (post) {
      const { date, time } = toBRTFields(post.scheduledAt);
      setForm({
        date,
        time,
        format: post.format,
        caption: post.caption ?? "",
        firstComment: post.firstComment ?? "",
        mediaUrls: post.mediaUrls?.length ? post.mediaUrls : [""],
        contentSuggestionId: post.contentSuggestionId ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM(defaultDate), ...(initialValues ?? {}) });
    }

    api.get("/suggestions/content?status=APPROVED")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.data ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, post]); // defaultDate excluído intencionalmente — só usamos no momento da abertura

  if (!open) return null;

  async function uploadFile(idx, file) {
    setUploadingIdx(idx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.upload(`/clients/${clientId}/media/upload`, fd);
      const d = await res.json();
      if (res.ok) {
        setForm((f) => {
          const next = [...f.mediaUrls];
          next[idx] = d.url;
          return { ...f, mediaUrls: next };
        });
      } else {
        addToast(d.message ?? "Erro ao fazer upload", "error");
      }
    } catch {
      addToast("Erro ao fazer upload", "error");
    } finally {
      setUploadingIdx(null);
    }
  }

  async function openLibrary() {
    setShowLibrary(true);
    if (libraryItems.length > 0) return;
    setLoadingLibrary(true);
    try {
      const res = await api.get(`/clients/${clientId}/media`);
      const d = await res.json();
      if (d.ok) setLibraryItems(d.items ?? []);
    } catch {
      addToast("Erro ao carregar biblioteca", "error");
    } finally {
      setLoadingLibrary(false);
    }
  }

  function pickFromLibrary(item) {
    const { format, mediaUrls } = form;
    if (format === "PHOTO" || format === "REEL" || format === "STORY") {
      setForm((f) => ({ ...f, mediaUrls: [item.url] }));
    } else {
      const emptyIdx = mediaUrls.findIndex((u) => !u.trim());
      if (emptyIdx >= 0) {
        setForm((f) => {
          const next = [...f.mediaUrls];
          next[emptyIdx] = item.url;
          return { ...f, mediaUrls: next };
        });
      } else if (mediaUrls.length < 10) {
        setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, item.url] }));
      }
    }
    setShowLibrary(false);
  }

  function setUrl(idx, val) {
    setForm((f) => {
      const next = [...f.mediaUrls];
      next[idx] = val;
      return { ...f, mediaUrls: next };
    });
  }

  function addUrl() {
    setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, ""] }));
  }

  function delUrl(idx) {
    setForm((f) => ({
      ...f,
      mediaUrls: f.mediaUrls.length > 1 ? f.mediaUrls.filter((_, i) => i !== idx) : f.mediaUrls,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanUrls = form.mediaUrls.map((u) => u.trim()).filter(Boolean);

    if (form.format === "CAROUSEL" && (cleanUrls.length < 2 || cleanUrls.length > 10)) {
      addToast("Carrossel exige entre 2 e 10 imagens", "error");
      return;
    }
    if (form.format === "PHOTO" && cleanUrls.length !== 1) {
      addToast("Foto exige exatamente uma URL de mídia", "error");
      return;
    }
    if (form.format === "REEL" && cleanUrls.length !== 1) {
      addToast("Reel exige exatamente uma URL de vídeo MP4", "error");
      return;
    }
    if (form.format === "STORY" && cleanUrls.length !== 1) {
      addToast("Story exige exatamente uma URL de mídia", "error");
      return;
    }

    if (!form.date || !form.time) {
      addToast("Data e hora são obrigatórias", "error");
      return;
    }

    const scheduledAt = new Date(`${form.date}T${form.time}:00-03:00`).toISOString();
    if (new Date(scheduledAt).getTime() < Date.now() - 60_000) {
      addToast("Data e hora devem ser no futuro", "error");
      return;
    }

    setSaving(true);
    try {
      const body = {
        format: form.format,
        caption: form.caption || undefined,
        firstComment: form.firstComment || undefined,
        mediaUrls: cleanUrls,
        scheduledAt,
        contentSuggestionId: form.contentSuggestionId || undefined,
      };

      let res;
      if (post) {
        res = await api.put(`/clients/${clientId}/scheduled-posts/${post.id}`, body);
      } else {
        res = await api.post(`/clients/${clientId}/scheduled-posts`, body);
      }
      const d = await res.json();
      if (res.ok) {
        addToast(post ? "Post atualizado" : "Post agendado", "success");
        onSave(d.post);
      } else {
        addToast(d.message ?? "Erro ao salvar", "error");
      }
    } catch {
      addToast("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelPost() {
    try {
      const res = await api.del(`/clients/${clientId}/scheduled-posts/${post.id}`);
      if (res.ok) {
        addToast("Agendamento cancelado", "info");
        onSave({ ...post, status: "CANCELLED" });
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao cancelar", "error");
      }
    } catch {
      addToast("Erro ao cancelar", "error");
    }
  }

  const canCancel = post && post.status !== "CANCELLED" && post.status !== "PUBLISHED";
  const isSuggestion = !post && initialValues?.contentSuggestionId;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60">
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">
              {post ? "Editar agendamento" : "Agendar publicação Instagram"}
            </h2>
            {isSuggestion && (
              <p className="text-slate-400 text-xs mt-0.5 truncate max-w-xs" title={initialValues.caption}>
                Sugestão: {initialValues.caption}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-lg leading-none mt-0.5 ml-3 flex-shrink-0">
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          id="schedule-post-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* Formato */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Formato</label>
            <select
              value={form.format}
              onChange={(e) => setForm((f) => ({ ...f, format: e.target.value, mediaUrls: [""] }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Data e hora */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Data e hora (BRT)</label>
              <button
                type="button"
                onClick={fetchBestTime}
                disabled={loadingBestTime}
                className="text-xs text-amber-400 hover:text-amber-300 transition disabled:opacity-50"
              >
                {loadingBestTime ? "Buscando..." : "🕐 Melhor horário"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            {bestTimeSlots.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Sugestões:</span>
                {bestTimeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, time: slot }));
                      setBestTimeSlots([]);
                    }}
                    className="px-2.5 py-1 rounded-md bg-amber-900/30 border border-amber-700/50 text-amber-300 text-xs hover:bg-amber-800/40 transition"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Legenda */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Legenda</label>
              <span className={`text-xs ${form.caption.length > 2000 ? "text-amber-400" : "text-slate-500"}`}>
                {form.caption.length}/2200
              </span>
            </div>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              maxLength={2200}
              rows={4}
              placeholder="Texto do post..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Mídia */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-400">
                Mídia <span className="text-slate-500 font-normal">— {FORMAT_HINT[form.format]}</span>
              </label>
              <button
                type="button"
                onClick={openLibrary}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                📚 Biblioteca
              </button>
            </div>

            {/* Biblioteca inline */}
            {showLibrary && (
              <div className="mb-3 bg-slate-900/50 border border-slate-600 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-300">Biblioteca de mídia</span>
                  <button type="button" onClick={() => setShowLibrary(false)} className="text-xs text-slate-500 hover:text-white transition">
                    fechar
                  </button>
                </div>
                {loadingLibrary ? (
                  <p className="text-xs text-slate-400 text-center py-4">Carregando...</p>
                ) : libraryItems.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">
                    Nenhuma mídia ainda. Envie um arquivo usando o botão 📤.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 max-h-44 overflow-y-auto">
                    {libraryItems.map((item) => {
                      const isVideo = /\.(mp4|mov|webm)$/i.test(item.url);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => pickFromLibrary(item)}
                          title={item.key.split("/").pop()}
                          className="aspect-square rounded-lg overflow-hidden border border-slate-600 hover:border-blue-400 transition"
                        >
                          {isVideo ? (
                            <div className="w-full h-full flex items-center justify-center bg-slate-700 text-xl">🎬</div>
                          ) : (
                            <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Entradas de URL */}
            <div className="space-y-2">
              {form.mediaUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(i, e.target.value)}
                    placeholder={form.format === "REEL" ? "https://...video.mp4" : "https://...imagem.jpg"}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="file"
                    ref={(el) => { fileRefs.current[i] = el; }}
                    accept={FORMAT_ACCEPT[form.format]}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files[0]) uploadFile(i, e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs.current[i]?.click()}
                    disabled={uploadingIdx === i}
                    title="Enviar arquivo para R2"
                    className="px-2.5 py-2 rounded-lg bg-slate-700 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-white transition disabled:opacity-50 text-sm flex-shrink-0"
                  >
                    {uploadingIdx === i ? "…" : "📤"}
                  </button>
                  {form.mediaUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => delUrl(i)}
                      className="text-slate-500 hover:text-red-400 transition text-sm flex-shrink-0"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {form.format === "CAROUSEL" && form.mediaUrls.length < 10 && (
              <button
                type="button"
                onClick={addUrl}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                + adicionar imagem
              </button>
            )}

            {form.format === "REEL" && (
              <p className="mt-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-900/40 rounded-lg px-3 py-2 leading-relaxed">
                Reel é assíncrono — o Instagram processa o vídeo após o envio (até ~4 min). Status fica "Publicando" durante esse tempo.
              </p>
            )}
            {form.format === "STORY" && (
              <p className="mt-2 text-xs text-purple-400 bg-purple-900/20 border border-purple-900/40 rounded-lg px-3 py-2 leading-relaxed">
                Stories ficam visíveis por 24h. Ratio ideal: 9:16 (vertical). Vídeo segue o mesmo fluxo assíncrono do Reel.
              </p>
            )}
          </div>

          {/* Sugestão vinculada */}
          {suggestions.length > 0 && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vincular sugestão aprovada (opcional)</label>
              <select
                value={form.contentSuggestionId}
                onChange={(e) => setForm((f) => ({ ...f, contentSuggestionId: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">— Nenhuma —</option>
                {suggestions.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Primeiro comentário */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Primeiro comentário (opcional — hashtags)</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={suggestHashtags}
                  disabled={loadingHashtags}
                  className="text-xs text-purple-400 hover:text-purple-300 transition disabled:opacity-50"
                >
                  {loadingHashtags ? "Gerando..." : "✨ Sugerir hashtags"}
                </button>
                <span className="text-xs text-slate-500">{form.firstComment.length}/2200</span>
              </div>
            </div>
            <textarea
              value={form.firstComment}
              onChange={(e) => setForm((f) => ({ ...f, firstComment: e.target.value }))}
              maxLength={2200}
              rows={2}
              placeholder="#hashtags ou texto complementar..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex-shrink-0 flex items-center justify-between gap-3">
          <div>
            {canCancel && (
              <button
                type="button"
                onClick={handleCancelPost}
                className="text-sm text-red-400 hover:text-red-300 transition"
              >
                Cancelar agendamento
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition"
            >
              Fechar
            </button>
            <button
              type="submit"
              form="schedule-post-form"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition font-medium"
            >
              {saving ? "Salvando..." : post ? "Salvar" : "Agendar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
