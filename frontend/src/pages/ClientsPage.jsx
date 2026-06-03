import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { useToast } from "../components/Toast.jsx";

const STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED"];
const STATUS_LABEL = { TRIAL: "Trial", ACTIVE: "Ativo", SUSPENDED: "Suspenso" };
const STATUS_COLOR = {
  TRIAL: "bg-amber-500/20 text-amber-300",
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  SUSPENDED: "bg-red-500/20 text-red-300",
};

const EMPTY = {
  slug: "", name: "", status: "TRIAL", niche: "", targetAudience: "",
  keywords: "", contentTone: "", primaryColor: "#6366f1", timezone: "America/Belem",
};

const IG_STATUS = {
  valid:   { label: "Token OK",       cls: "bg-emerald-900/40 text-emerald-300" },
  expired: { label: "Token expirado", cls: "bg-red-900/40 text-red-300" },
  missing: { label: "Sem token IG",   cls: "bg-slate-700 text-slate-400" },
  error:   { label: "Erro ao checar", cls: "bg-amber-900/40 text-amber-300" },
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [igHealth, setIgHealth] = useState({});
  const toast = useToast();
  const navigate = useNavigate();

  async function checkIgHealth(clientId) {
    setIgHealth((h) => ({ ...h, [clientId]: { status: "loading" } }));
    try {
      const r = await api.get(`/clients/${clientId}/credentials/instagram/health`);
      const d = await r.json();
      setIgHealth((h) => ({ ...h, [clientId]: d }));
    } catch {
      setIgHealth((h) => ({ ...h, [clientId]: { status: "error", error: "Falha de conexão" } }));
    }
  }

  function loadClients() {
    setLoading(true);
    return api
      .get("/clients")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) { toast(data.message ?? "Erro ao carregar clientes", "error"); return; }
        setClients(data);
        data.forEach((c) => checkIgHealth(c.id));
      })
      .catch(() => toast("Erro de conexão", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadClients(); }, []);

  function openCreate() { setForm(EMPTY); setModal({ mode: "create" }); }
  function closeModal() { setModal(null); }
  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) {
      toast("Nome e slug são obrigatórios", "warning");
      return;
    }
    setSaving(true);
    try {
      const body = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        status: form.status,
        niche: form.niche.trim() || null,
        targetAudience: form.targetAudience.trim() || null,
        keywords: form.keywords ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        contentTone: form.contentTone.trim() || null,
        primaryColor: form.primaryColor || null,
        timezone: form.timezone || "America/Belem",
      };
      const res =
        modal.mode === "create"
          ? await api.post("/clients", body)
          : await api.put(`/clients/${modal.client.id}`, body);
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? "Erro ao salvar", "error"); return; }
      toast(modal.mode === "create" ? "Cliente criado" : "Cliente atualizado", "success");
      closeModal();
      loadClients();
    } catch {
      toast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    const next = statusTarget.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await api.patch(`/clients/${statusTarget.id}/status`, { status: next });
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? "Erro ao atualizar status", "error"); setStatusTarget(null); return; }
      toast(`Cliente ${STATUS_LABEL[next].toLowerCase()}`, "success");
      setStatusTarget(null);
      setClients((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } catch {
      toast("Erro de conexão", "error");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Clientes</h1>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Novo Cliente
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : clients.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-slate-400">Nenhum cliente cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="glass-card rounded-xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-base truncate">{client.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{client.slug}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLOR[client.status] ?? ""}`}>
                  {STATUS_LABEL[client.status] ?? client.status}
                </span>
              </div>
              {client.niche && <p className="text-slate-400 text-xs">{client.niche}</p>}
              {/* Instagram token health */}
              {(() => {
                const h = igHealth[client.id];
                if (!h || h.status === "loading") {
                  return <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" /><span className="text-xs text-slate-500">Verificando token…</span></div>;
                }
                const info = IG_STATUS[h.status] ?? IG_STATUS.error;
                return (
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      {info.label}
                    </span>
                    <button
                      onClick={() => checkIgHealth(client.id)}
                      className="text-xs text-slate-500 hover:text-slate-300 transition"
                      title="Verificar novamente"
                    >
                      ↻
                    </button>
                  </div>
                );
              })()}
              <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                <button
                  onClick={() => navigate(`/clients/${client.id}/leads`)}
                  className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-1.5 transition"
                >
                  Leads
                </button>
                <button
                  onClick={() => navigate(`/clients/${client.id}/campaigns`)}
                  className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-1.5 transition"
                >
                  Campanhas
                </button>
                <button
                  onClick={() => navigate(`/clients/${client.id}/edit`)}
                  className="flex-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-1.5 transition"
                >
                  Editar
                </button>
                <button
                  onClick={() => setStatusTarget(client)}
                  className={`flex-1 text-xs rounded-lg py-1.5 transition ${
                    client.status === "ACTIVE"
                      ? "bg-red-900/40 hover:bg-red-800/60 text-red-300"
                      : "bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300"
                  }`}
                >
                  {client.status === "ACTIVE" ? "Suspender" : "Ativar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold">{modal.mode === "create" ? "Novo Cliente" : "Editar Cliente"}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Slug *</label>
                  <input
                    value={form.slug}
                    onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    disabled={modal.mode === "edit"}
                    className="input-base w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="ex: joao-silva"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nome *</label>
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)}
                    className="input-base w-full" placeholder="Nome do cliente ou empresa" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="input-base w-full">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nicho</label>
                  <input value={form.niche} onChange={(e) => setField("niche", e.target.value)}
                    className="input-base w-full" placeholder="ex: nutrição, arquitetura, finanças" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Público-alvo</label>
                  <input value={form.targetAudience} onChange={(e) => setField("targetAudience", e.target.value)}
                    className="input-base w-full" placeholder="ex: adultos de 25-45 anos em SP" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Palavras-chave (separar por vírgula)</label>
                  <input value={form.keywords} onChange={(e) => setField("keywords", e.target.value)}
                    className="input-base w-full" placeholder="ex: receitas, emagrecimento, saúde" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tom de conteúdo</label>
                  <input value={form.contentTone} onChange={(e) => setField("contentTone", e.target.value)}
                    className="input-base w-full" placeholder="ex: educativo, informal" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cor primária</label>
                  <input type="color" value={form.primaryColor} onChange={(e) => setField("primaryColor", e.target.value)}
                    className="input-base w-full h-10 p-1 cursor-pointer" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Timezone</label>
                  <input value={form.timezone} onChange={(e) => setField("timezone", e.target.value)}
                    className="input-base w-full" placeholder="America/Belem" />
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-700 flex gap-3 justify-end">
              <button onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition">
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!statusTarget}
        title={`${statusTarget?.status === "ACTIVE" ? "Suspender" : "Ativar"} cliente "${statusTarget?.name}"?`}
        message={
          statusTarget?.status === "ACTIVE"
            ? "O cliente não poderá acessar o sistema enquanto suspenso."
            : "O cliente voltará a ter acesso ao sistema."
        }
        onConfirm={toggleStatus}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
}
