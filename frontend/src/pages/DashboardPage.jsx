import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api.js";
import { fmtDateTime, brlFromCentavos } from "../lib/formatters.js";
import { useToast } from "../components/Toast.jsx";
import { MoneyInput } from "../components/MoneyInput.jsx";
import { decodePayload, getToken } from "../lib/auth.js";

const STATUS_COLOR = {
  NEW: "bg-blue-500/20 text-blue-300",
  CONTACTED: "bg-amber-500/20 text-amber-300",
  QUALIFIED: "bg-purple-500/20 text-purple-300",
  CONVERTED: "bg-emerald-500/20 text-emerald-300",
  LOST: "bg-red-500/20 text-red-300",
};
const STATUS_LABEL = {
  NEW: "Novo",
  CONTACTED: "Contactado",
  QUALIFIED: "Qualificado",
  CONVERTED: "Convertido",
  LOST: "Perdido",
};

function StatCard({ label, value }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value ?? "—"}</p>
    </div>
  );
}

function ProgressBar({ pct, color = "bg-indigo-500" }) {
  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function SpendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="text-white font-semibold">
        R$ {brlFromCentavos(payload[0].payload.spendCents)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalLeads, setGoalLeads] = useState("");
  const [goalBudget, setGoalBudget] = useState(0);
  const [goalNotes, setGoalNotes] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const toast = useToast();

  const payload = decodePayload(getToken());
  const isSuper = payload?.role === "SUPER_ADMIN";
  const clientId = payload?.clientId;

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const now = new Date();
  const currentMonthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthLabel = now.toLocaleString("pt-BR", { timeZone: "America/Belem", month: "long", year: "numeric" });

  useEffect(() => {
    if (isSuper) {
      api.get("/clients").then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setClients(data);
      }).catch(() => {});
    }
  }, [isSuper]);

  const activeClientId = isSuper ? selectedClientId : clientId;

  useEffect(() => {
    if (isSuper && !selectedClientId) { setLoading(false); return; }

    setLoading(true);
    setSummary(null);
    setGoal(null);

    const summaryUrl = isSuper
      ? `/dashboard/summary?clientId=${selectedClientId}`
      : "/dashboard/summary";

    const fetches = [api.get(summaryUrl).then((r) => r.json())];
    if (activeClientId) {
      fetches.push(api.get(`/clients/${activeClientId}/goals/current`).then((r) => r.json()));
    }
    Promise.all(fetches)
      .then(([summaryRes, goalRes]) => {
        if (summaryRes.ok) setSummary(summaryRes.data);
        else toast(summaryRes.message ?? "Erro ao carregar dashboard", "error");
        if (goalRes?.ok) setGoal(goalRes.goal);
      })
      .catch(() => toast("Erro de conexão", "error"))
      .finally(() => setLoading(false));
  }, [selectedClientId, clientId]);

  const chartData = (summary?.dailySpend ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", {
      timeZone: "America/Belem",
      day: "2-digit",
      month: "2-digit",
    }),
    spendCents: d.spendCents,
  }));

  const leadsGoalPct =
    goal?.leadsGoal && summary?.currentMonthLeads != null
      ? (summary.currentMonthLeads / goal.leadsGoal) * 100
      : null;

  const budgetPct =
    goal?.budgetCents && summary?.currentMonthSpendCents != null
      ? (summary.currentMonthSpendCents / goal.budgetCents) * 100
      : null;

  function openGoalModal() {
    setGoalLeads(goal?.leadsGoal != null ? String(goal.leadsGoal) : "");
    setGoalBudget(goal?.budgetCents ?? 0);
    setGoalNotes(goal?.notes ?? "");
    setGoalOpen(true);
  }

  async function saveGoal() {
    setGoalSaving(true);
    try {
      const res = await api.put(`/clients/${activeClientId}/goals/${currentMonthParam}`, {
        leadsGoal: goalLeads !== "" ? parseInt(goalLeads) : null,
        budgetCents: goalBudget || null,
        notes: goalNotes || null,
      });
      const data = await res.json();
      if (data.ok) {
        setGoal(data.goal);
        setGoalOpen(false);
        toast("Meta atualizada", "success");
      } else {
        toast(data.message ?? "Erro ao salvar meta", "error");
      }
    } catch {
      toast("Erro ao salvar meta", "error");
    } finally {
      setGoalSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {isSuper && (
        <div className="mb-6">
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-indigo-500 min-w-[260px]"
          >
            <option value="">— Selecione um cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {isSuper && !selectedClientId ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-slate-400">Selecione um cliente para visualizar o dashboard.</p>
        </div>
      ) : loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Leads" value={summary?.totalLeads} />
            <StatCard label="Dias de campanha" value={summary?.totalCampaignDays} />
            <StatCard label="Sugestões de conteúdo" value={summary?.totalSuggestions} />
          </div>

          {activeClientId && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">
                  Meta mensal — {currentMonthLabel}
                </h2>
                <button
                  onClick={openGoalModal}
                  className="text-xs px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                >
                  Editar meta
                </button>
              </div>
              {!goal?.leadsGoal && !goal?.budgetCents ? (
                <p className="text-slate-500 text-sm">
                  Nenhuma meta definida para este mês.{" "}
                  <button
                    onClick={openGoalModal}
                    className="text-indigo-400 hover:text-indigo-300 transition"
                  >
                    Definir agora →
                  </button>
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {goal?.leadsGoal != null && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                        <span>Leads</span>
                        <span>
                          {summary?.currentMonthLeads ?? 0} / {goal.leadsGoal}
                          {leadsGoalPct != null && (
                            <span className="ml-1 text-slate-500">({Math.round(leadsGoalPct)}%)</span>
                          )}
                        </span>
                      </div>
                      <ProgressBar
                        pct={leadsGoalPct ?? 0}
                        color={leadsGoalPct != null && leadsGoalPct >= 100 ? "bg-emerald-500" : "bg-indigo-500"}
                      />
                    </div>
                  )}
                  {goal?.budgetCents != null && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                        <span>Orçamento</span>
                        <span>
                          R$ {brlFromCentavos(summary?.currentMonthSpendCents ?? 0)} / R${" "}
                          {brlFromCentavos(goal.budgetCents)}
                          {budgetPct != null && (
                            <span className="ml-1 text-slate-500">({Math.round(budgetPct)}%)</span>
                          )}
                        </span>
                      </div>
                      <ProgressBar
                        pct={budgetPct ?? 0}
                        color={budgetPct != null && budgetPct >= 100 ? "bg-red-500" : "bg-emerald-500"}
                      />
                    </div>
                  )}
                  {goal?.notes && (
                    <p className="sm:col-span-2 text-xs text-slate-500 italic">{goal.notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {chartData.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">
                Gasto diário — últimos 30 dias
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$ ${brlFromCentavos(v)}`}
                    width={72}
                  />
                  <Tooltip content={<SpendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="spendCents"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#6366f1" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {summary?.topCampaigns?.length > 0 && (
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white">
                  Top campanhas este mês{" "}
                  <span className="text-slate-500 font-normal text-xs">(por conversões)</span>
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                    <th className="px-5 py-3 text-left">Campanha</th>
                    <th className="px-5 py-3 text-right">Conversões</th>
                    <th className="px-5 py-3 text-right">Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topCampaigns.map((c) => (
                    <tr
                      key={c.campaignId}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td
                        className="px-5 py-3 text-white max-w-[260px] truncate"
                        title={c.campaignName}
                      >
                        {c.campaignName ?? c.campaignId}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        {c.conversions.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        R$ {brlFromCentavos(c.spendCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Leads recentes</h2>
            </div>
            {!summary?.recentLeads?.length ? (
              <p className="px-5 py-8 text-slate-400 text-sm text-center">Nenhum lead ainda</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                    <th className="px-5 py-3 text-left">Nome</th>
                    <th className="px-5 py-3 text-left">Origem</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3 text-white">{lead.name}</td>
                      <td className="px-5 py-3 text-slate-300">{lead.source}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[lead.status] ?? ""}`}
                        >
                          {STATUS_LABEL[lead.status] ?? lead.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{fmtDateTime(lead.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {goalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4">
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md flex flex-col"
            style={{ maxHeight: "90vh" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 flex-shrink-0">
              <h3 className="font-semibold text-white text-sm">
                Meta — {currentMonthLabel}
              </h3>
              <button
                onClick={() => setGoalOpen(false)}
                className="text-slate-400 hover:text-white transition text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Meta de leads</label>
                <input
                  type="number"
                  min="0"
                  value={goalLeads}
                  onChange={(e) => setGoalLeads(e.target.value)}
                  placeholder="Ex: 20"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Orçamento mensal (R$)</label>
                <MoneyInput value={goalBudget} onChange={setGoalBudget} className="w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Observações</label>
                <textarea
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  rows={3}
                  placeholder="Contexto, estratégia, restrições..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-700 flex-shrink-0">
              <button
                onClick={() => setGoalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border border-slate-600 text-slate-300 hover:border-slate-500 transition"
              >
                Cancelar
              </button>
              <button
                onClick={saveGoal}
                disabled={goalSaving}
                className="flex-1 px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition font-medium"
              >
                {goalSaving ? "Salvando…" : "Salvar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
