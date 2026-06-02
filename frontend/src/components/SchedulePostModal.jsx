import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "./Toast.jsx";

const FORMAT_OPTIONS = [
  { value: "PHOTO",    label: "Foto" },
  { value: "CAROUSEL", label: "Carrossel" },
  { value: "REEL",     label: "Reel" },
  { value: "STORY",    label: "Story" },
];

function toBRTFields(isoString) {
  const dt = new Date(isoString);
  const brt = new Date(dt.toLocaleString("en-US", { timeZone: "America/Belem" }));
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${brt.getFullYear()}-${pad(brt.getMonth() + 1)}-${pad(brt.getDate())}`,
    time: `${pad(brt.getHours())}:${pad(brt.getMinutes())}`,
  };
}

function defaultDateFields(date) {
  const d = date ?? new Date();
  const brt = new Date(d.toLocaleString("en-US", { timeZone: "America/Belem" }));
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${brt.getFullYear()}-${pad(brt.getMonth() + 1)}-${pad(brt.getDate())}`,
    time: "12:00",
  };
}

const EMPTY_FORM = (date) => ({
  ...defaultDateFields(date),
  format: "PHOTO",
  caption: "",
  firstComment: "",
  mediaUrls: [],
  contentSuggestionId: "",
});

export default function SchedulePostModal({ open, post, defaultDate, clientId, onClose, onSave, initialValues }) {
  const { addToast } = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState(EMPTY_FORM(defaultDate));
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (post) {
      const { date, time } = toBRTFields(post.scheduledAt);
      setForm({
        date,
        time,
        format: post.format,
        caption: post.caption ?? "",
        firstComment: post.firstComment ?? "",
        mediaUrls: post.mediaUrls ?? [],
        contentSuggestionId: post.contentSuggestionId ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM(defaultDate), ...(initialValues ?? {}) });
    }

    api.get("/suggestions/content?status=APPROVED")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.data ?? []))
      .catch(() => {});
  }, [open, post, defaultDate]);

  if (!open) return null;

  async function uploadFile(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.upload(`/clients/${clientId}/media/upload`, fd);
      const d = await res.json();
      if (res.ok) {
        setForm((f) => ({ ...f, mediaUrls: [...f.mediaUrls, d.url] }));
      } else {
        addToast(d.message ?? "Erro ao fazer upload", "error");
      }
    } catch {
      addToast("Erro ao fazer upload", "error");
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(url) {
    setForm((f) => ({ ...f, mediaUrls: f.mediaUrls.filter((u) => u !== url) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date || !form.time) {
      addToast("Data e hora são obrigatórias", "error");
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = new Date(`${form.date}T${form.time}:00-03:00`).toISOString();
      const body = {
        format: form.format,
        caption: form.caption || undefined,
        firstComment: form.firstComment || undefined,
        mediaUrls: form.mediaUrls,
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

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60">
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-white font-semibold text-base">
            {post ? "Editar agendamento" : "Novo agendamento"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition text-lg leading-none">
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          id="schedule-post-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hora (BRT)</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Formato</label>
            <select
              value={form.format}
              onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

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

          <div>
            <label className="block text-xs text-slate-400 mb-1">Legenda</label>
            <textarea
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              rows={4}
              placeholder="Texto do post..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Primeiro comentário (opcional)</label>
            <textarea
              value={form.firstComment}
              onChange={(e) => setForm((f) => ({ ...f, firstComment: e.target.value }))}
              rows={2}
              placeholder="#hashtags ou texto complementar..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400">Mídia</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-blue-400 hover:text-blue-300 transition disabled:opacity-50"
              >
                {uploading ? "Enviando..." : "+ Adicionar arquivo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files[0]) uploadFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
            </div>
            {form.mediaUrls.length > 0 && (
              <div className="space-y-1">
                {form.mediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-1.5">
                    <span className="text-slate-300 text-xs truncate flex-1">{url.split("/").pop()}</span>
                    <button
                      type="button"
                      onClick={() => removeMedia(url)}
                      className="text-slate-500 hover:text-red-400 transition text-xs flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
