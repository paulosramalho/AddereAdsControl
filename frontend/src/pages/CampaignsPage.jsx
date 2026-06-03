import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { decodePayload, getToken } from "../lib/auth.js";
import { brlFromCentavos } from "../lib/formatters.js";
import { useToast } from "../components/Toast.jsx";

const PERIOD_OPTIONS = [7, 14, 30, 90];

const PLATFORM_BADGE = {
  GOOGLE_ADS: { label: "Google Ads", cls: "bg-blue-500/20 text-blue-300" },
  META_ADS:   { label: "Meta Ads",   cls: "bg-purple-500/20 text-purple-300" },
};

function fmtCtr(ctr) {
  return ctr != null ? `${(ctr * 100).toFixed(2)}%` : "—";
}

function fmtCpc(spendCents, clicks) {
  if (!clicks) return "—";
  return `R$ ${brlFromCentavos(Math.round(spendCents / clicks))}`;
}

function StatCard({ label, value }) {
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

export default function CampaignsPage() {
  const { clientId: paramClientId } = useParams();
  const clientId = paramClientId ?? decodePayload(getToken())?.clientId;
  const { addToast: toast } = useToast();

  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  function load(d) {
    setLoading(true);
    api
      .get(`/clients/${clientId}/campaigns?days=${d}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.message) { toast(json.message, "error"); return; }
        setData(json);
      })
      .catch(() => toast("Erro de conexão", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(days); }, [clientId, days]);

  const totals = data?.totals ?? { impressions: 0, clicks: 0, spendCents: 0, conversions: 0 };
  const campaigns = data?.campaigns ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Campanhas</h1>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${
                days === d
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Gasto" value={loading ? "…" : `R$ ${brlFromCentavos(totals.spendCents)}`} />
        <StatCard label="Impressões"  value={loading ? "…" : totals.impressions.toLocaleString("pt-BR")} />
        <StatCard label="Cliques"     value={loading ? "…" : totals.clicks.toLocaleString("pt-BR")} />
        <StatCard label="Conversões"  value={loading ? "…" : totals.conversions.toLocaleString("pt-BR")} />
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : campaigns.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-slate-300 font-medium mb-2">Nenhuma campanha no período</p>
          <p className="text-slate-500 text-sm">
            Configure as credenciais do Google Ads / Meta Ads para iniciar a coleta de dados.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase border-b border-white/5">
                <th className="px-5 py-3 text-left">Campanha</th>
                <th className="px-5 py-3 text-left">Plataforma</th>
                <th className="px-5 py-3 text-right">Impressões</th>
                <th className="px-5 py-3 text-right">Cliques</th>
                <th className="px-5 py-3 text-right">Gasto</th>
                <th className="px-5 py-3 text-right">Conversões</th>
                <th className="px-5 py-3 text-right">CTR</th>
                <th className="px-5 py-3 text-right">CPC</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const badge = PLATFORM_BADGE[c.platform] ?? { label: c.platform, cls: "bg-slate-500/20 text-slate-300" };
                return (
                  <tr key={`${c.platform}-${c.campaignId}`} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-white font-medium max-w-xs truncate">{c.campaignName}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-right">{c.impressions.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-slate-300 text-right">{c.clicks.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-slate-300 text-right">R$ {brlFromCentavos(c.spendCents)}</td>
                    <td className="px-5 py-3 text-slate-300 text-right">{c.conversions.toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 text-slate-300 text-right">{fmtCtr(c.ctr)}</td>
                    <td className="px-5 py-3 text-slate-300 text-right">{fmtCpc(c.spendCents, c.clicks)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
