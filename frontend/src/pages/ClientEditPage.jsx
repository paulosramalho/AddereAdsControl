import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";

const PLATFORMS = ["GOOGLE_ADS", "META_ADS", "INSTAGRAM", "ANTHROPIC", "RESEND"];

const PLATFORM_KEYS = {
  GOOGLE_ADS: ["customer_id", "client_id", "client_secret", "refresh_token", "developer_token"],
  META_ADS: ["access_token", "account_id"],
  INSTAGRAM: ["access_token", "user_id"],
  ANTHROPIC: ["api_key", "youtube_api_key"],
  RESEND: ["api_key", "from_email"],
};

export default function ClientEditPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [client, setClient] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyId = useCallback(() => {
    navigator.clipboard.writeText(clientId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [clientId]);
  const [form, setForm] = useState({});
  const [credentials, setCredentials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [credForm, setCredForm] = useState({ platform: "ANTHROPIC", key: "api_key", value: "" });
  const [savingCred, setSavingCred] = useState(false);
  const [deletingCred, setDeletingCred] = useState({});

  async function load() {
    try {
      const [rClient, rCreds] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/credentials`),
      ]);
      const c = await rClient.json();
      const creds = await rCreds.json();
      setClient(c);
      setForm({
        name: c.name ?? "",
        slug: c.slug ?? "",
        niche: c.niche ?? "",
        targetAudience: c.targetAudience ?? "",
        keywords: (c.keywords ?? []).join(", "),
        contentTone: c.contentTone ?? "",
        timezone: c.timezone ?? "America/Belem",
        status: c.status ?? "TRIAL",
      });
      setCredentials(creds);
    } catch {
      addToast("Erro ao carregar cliente", "error");
    }
  }

  useEffect(() => { load(); }, [clientId]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        keywords: form.keywords ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
      };
      const res = await api.put(`/clients/${clientId}`, payload);
      if (res.ok) {
        addToast("Perfil atualizado", "success");
        load();
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar", "error");
      }
    } catch {
      addToast("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCred(e) {
    e.preventDefault();
    if (!credForm.value) return;
    setSavingCred(true);
    try {
      const res = await api.put(
        `/clients/${clientId}/credentials/${credForm.platform}/${credForm.key}`,
        { value: credForm.value }
      );
      if (res.ok) {
        setCredForm({ platform: "GOOGLE_ADS", key: PLATFORM_KEYS["GOOGLE_ADS"][0], value: "" });
        await load();
        addToast("Credencial salva", "success");
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar credencial", "error");
      }
    } catch {
      addToast("Erro ao salvar credencial", "error");
    } finally {
      setSavingCred(false);
    }
  }

  async function deleteCred(platform, key) {
    const dkey = `${platform}-${key}`;
    setDeletingCred((d) => ({ ...d, [dkey]: true }));
    try {
      const res = await api.del(`/clients/${clientId}/credentials/${platform}/${key}`);
      if (res.ok) {
        addToast("Credencial removida", "success");
        load();
      } else {
        addToast("Erro ao remover credencial", "error");
      }
    } catch {
      addToast("Erro ao remover credencial", "error");
    } finally {
      setDeletingCred((d) => ({ ...d, [dkey]: false }));
    }
  }

  function field(label, key, opts = {}) {
    return (
      <div>
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <input
          type={opts.type ?? "text"}
          value={form[key] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={opts.placeholder}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  if (!client) return <div className="p-8 text-slate-400">Carregando...</div>;

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate("/clients")} className="text-slate-400 hover:text-white text-sm transition">
            ← Clientes
          </button>
          <span className="text-slate-600">/</span>
          <h1 className="text-xl font-semibold text-white">{client.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${client.status === "ACTIVE" ? "bg-emerald-900/40 text-emerald-300" : client.status === "SUSPENDED" ? "bg-red-900/40 text-red-300" : "bg-amber-900/40 text-amber-300"}`}>
            {client.status}
          </span>
        </div>
        <button
          onClick={copyId}
          title="Copiar ID do cliente"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition flex-shrink-0"
        >
          <span className="font-mono">{clientId.slice(0, 12)}…</span>
          <span>{copied ? "✓ copiado" : "copiar ID"}</span>
        </button>
      </div>

      <form onSubmit={saveProfile} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <h2 className="font-medium text-white">Perfil Editorial</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Nome", "name")}
          {field("Slug", "slug", { placeholder: "ex: amanda-ramalho" })}
          {field("Nicho", "niche", { placeholder: "ex: direito, nutrição" })}
          {field("Público-alvo", "targetAudience")}
          {field("Tom de voz", "contentTone", { placeholder: "ex: formal, didático" })}
          {field("Fuso horário", "timezone", { placeholder: "America/Belem" })}
        </div>
        {field("Keywords (separadas por vírgula)", "keywords", { placeholder: "ex: direito trabalhista, rescisão" })}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={form.status ?? "TRIAL"}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="TRIAL">TRIAL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-700">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
          >
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <h2 className="font-medium text-white">Credenciais</h2>

        {credentials.length > 0 && (
          <div className="divide-y divide-slate-700">
            {credentials.map((c) => (
              <div key={`${c.platform}-${c.key}`} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="text-slate-400 text-xs font-medium">{c.platform}</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-white">{c.key}</span>
                  {c.expiresAt && (
                    <span className="ml-2 text-xs text-amber-400">
                      expira {new Date(c.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Belem" })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteCred(c.platform, c.key)}
                  disabled={deletingCred[`${c.platform}-${c.key}`]}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {credentials.length === 0 && (
          <p className="text-slate-500 text-sm">Nenhuma credencial configurada.</p>
        )}

        <form onSubmit={saveCred} className="pt-3 border-t border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 font-medium">Adicionar / atualizar credencial</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Plataforma</label>
              <select
                value={credForm.platform}
                onChange={(e) => {
                  const p = e.target.value;
                  setCredForm((f) => ({ ...f, platform: p, key: PLATFORM_KEYS[p]?.[0] ?? "" }));
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Campo</label>
              <select
                value={credForm.key}
                onChange={(e) => setCredForm((f) => ({ ...f, key: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {(PLATFORM_KEYS[credForm.platform] ?? []).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Valor</label>
            <input
              type="password"
              value={credForm.value}
              onChange={(e) => setCredForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Valor da credencial"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCred || !credForm.value}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
            >
              {savingCred ? "Salvando..." : "Salvar credencial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
