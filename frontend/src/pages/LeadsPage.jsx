import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { decodePayload, getToken } from "../lib/auth.js";
import { brlFromCentavos, fmtDateTime } from "../lib/formatters.js";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { MoneyInput } from "../components/MoneyInput.jsx";
import { useToast } from "../components/Toast.jsx";

const SOURCES = ["SITE", "INSTAGRAM", "WHATSAPP", "REFERRAL", "OTHER"];
const SOURCE_LABEL = { SITE: "Site", INSTAGRAM: "Instagram", WHATSAPP: "WhatsApp", REFERRAL: "Indicação", OTHER: "Outro" };
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
const STATUS_LABEL = { NEW: "Novo", CONTACTED: "Contactado", QUALIFIED: "Qualificado", CONVERTED: "Convertido", LOST: "Perdido" };
const STATUS_COLOR = {
  NEW: "bg-blue-500/20 text-blue-300",
  CONTACTED: "bg-amber-500/20 text-amber-300",
  QUALIFIED: "bg-purple-500/20 text-purple-300",
  CONVERTED: "bg-emerald-500/20 text-emerald-300",
  LOST: "bg-red-500/20 text-red-300",
};

const EMPTY = { name: "", phone: "", email: "", source: "SITE", status: "NEW", monthlyFeePotential: 0, notes: "" };

function maskPhone(raw) {
  const d = (raw ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function LeadsPage() {
  const { clientId: paramClientId } = useParams();
  const clientId = paramClientId ?? decodePayload(getToken())?.clientId;
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const toast = useToast();

  const BASE = `/clients/${clientId}/leads`;

  function loadLeads() {
    setLoading(true);
    return api
      .get(BASE)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) { toast(data.message ?? "Erro ao carregar leads", "error"); return; }
        setLeads(data);
      })
      .catch(() => toast("Erro de conexão", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLeads(); }, [clientId]);

  function openCreate() { setForm(EMPTY); setModal({ mode: "create" }); }
  function openEdit(lead) {
    setForm({
      name: lead.name,
      phone: maskPhone(lead.phone),
      email: lead.email ?? "",
      source: lead.source,
      status: lead.status,
      monthlyFeePotential: lead.monthlyFeePotential ?? 0,
      notes: lead.notes ?? "",
    });
    setModal({ mode: "edit", lead });
  }
  function closeModal() { setModal(null); }
  function setField(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast("Nome e telefone são obrigatórios", "warning");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        source: form.source,
        status: form.status,
        monthlyFeePotential: form.monthlyFeePotential || null,
        notes: form.notes.trim() || null,
      };
      const res =
        modal.mode === "create"
          ? await api.post(BASE, body)
          : await api.put(`${BASE}/${modal.lead.id}`, body);
      const data = await res.json();
      if (!res.ok) { toast(data.message ?? "Erro ao salvar", "error"); return; }
      toast(modal.mode === "create" ? "Lead criado" : "Lead atualizado", "success");
      closeModal();
      loadLeads();
    } catch {
      toast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead() {
    try {
      const res = await api.del(`${BASE}/${delTarget.id}`);
      if (!res.ok) {
        const data = await res.json();
        toast(data.message ?? "Erro ao excluir", "error");
        return;
      }
      toast("Lead excluído", "success");
      setDelTarget(null);
      setLeads((prev) => prev.filter((l) => l.id !== delTarget.id));
    } catch {
      toast("Erro de conexão", "error");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Leads</h1>
        <button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Novo Lead
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : leads.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-slate-400">Nenhum lead cadastrado.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Telefone</th>
                <th className="px-5 py-3 text-left">Origem</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Honorário</th>
                <th className="px-5 py-3 text-left">Criado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-white font-medium">{lead.name}</td>
                  <td className="px-5 py-3 text-slate-300">{maskPhone(lead.phone)}</td>
                  <td className="px-5 py-3 text-slate-300">{SOURCE_LABEL[lead.source] ?? lead.source}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[lead.status] ?? ""}`}>
                      {STATUS_LABEL[lead.status] ?? lead.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">
                    {lead.monthlyFeePotential ? `R$ ${brlFromCentavos(lead.monthlyFeePotential)}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-400">{fmtDateTime(lead.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(lead)}
                        className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDelTarget(lead)}
                        className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-500/10 transition"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-semibold">{modal.mode === "create" ? "Novo Lead" : "Editar Lead"}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Nome *</label>
                  <input value={form.name} onChange={(e) => setField("name", e.target.value)}
                    className="input-base w-full" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Telefone *</label>
                  <input value={form.phone} onChange={(e) => setField("phone", maskPhone(e.target.value))}
                    className="input-base w-full" placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                  <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)}
                    className="input-base w-full" placeholder="opcional" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Origem</label>
                  <select value={form.source} onChange={(e) => setField("source", e.target.value)} className="input-base w-full">
                    {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setField("status", e.target.value)} className="input-base w-full">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Honorário potencial / mês</label>
                  <MoneyInput
                    value={form.monthlyFeePotential}
                    onChange={(v) => setField("monthlyFeePotential", v)}
                    className="w-full"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Notas</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    rows={3}
                    className="input-base w-full resize-none"
                    placeholder="Observações sobre o lead…"
                  />
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
        open={!!delTarget}
        title={`Excluir lead "${delTarget?.name}"?`}
        message="Esta ação não pode ser desfeita."
        onConfirm={deleteLead}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
