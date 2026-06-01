import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { fmtDateTime } from "../lib/formatters.js";
import { useToast } from "../components/Toast.jsx";

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

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    api
      .get("/dashboard/summary")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSummary(d.data);
        else toast(d.message ?? "Erro ao carregar dashboard", "error");
      })
      .catch(() => toast("Erro de conexão", "error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>
      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard label="Leads" value={summary?.totalLeads} />
            <StatCard label="Dias de campanha" value={summary?.totalCampaignDays} />
            <StatCard label="Sugestões de conteúdo" value={summary?.totalSuggestions} />
          </div>
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
                    <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-white">{lead.name}</td>
                      <td className="px-5 py-3 text-slate-300">{lead.source}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[lead.status] ?? ""}`}>
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
        </>
      )}
    </div>
  );
}
