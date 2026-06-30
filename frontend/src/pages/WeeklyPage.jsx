import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";

// weekStart/weekEnd são limites de semana (date-only). Exibir em UTC para mostrar
// o dia exato gravado — em America/Belem (UTC-3) um valor à meia-noite UTC voltaria
// para o dia anterior (ex.: 29/06 viraria 28/06 no header).
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function WeeklyPage() {
  const { addToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const res = await api.get("/weekly-reports");
      const d = await res.json();
      setReports(d.data ?? []);
      if (d.data?.length) setOpen(d.data[0].id);
    } catch {
      addToast("Erro ao carregar relatórios", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function triggerReport() {
    setTriggering(true);
    try {
      const res = await api.post("/jobs/weekly-report/run", {});
      const d = await res.json();
      if (res.ok) {
        addToast("Relatório iniciado — pode levar alguns instantes", "success");
        setTimeout(load, 5000);
      } else {
        addToast(d.message ?? "Erro ao iniciar relatório", "error");
      }
    } catch {
      addToast("Erro ao iniciar relatório", "error");
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Relatórios Semanais</h1>
        <button
          onClick={triggerReport}
          disabled={triggering}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
        >
          {triggering ? "Gerando..." : "Gerar relatório"}
        </button>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : reports.length === 0 ? (
        <div className="text-slate-400 text-center py-16">
          Nenhum relatório gerado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <button
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition"
              >
                <span className="font-medium text-white">
                  Semana de {fmtDate(r.weekStart)} a {fmtDate(r.weekEnd)}
                </span>
                <span className="text-slate-500 text-sm">{open === r.id ? "▲" : "▼"}</span>
              </button>

              {open === r.id && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-700">
                  {r.summary && (
                    <div className="pt-4">
                      <p className="text-xs text-slate-500 font-medium mb-1">RESUMO</p>
                      <p className="text-slate-300 leading-relaxed text-sm">{r.summary}</p>
                    </div>
                  )}
                  {r.insights?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-2">INSIGHTS</p>
                      <ul className="space-y-1.5">
                        {r.insights.map((ins, i) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-300">
                            <span className="text-blue-400 flex-shrink-0">•</span>
                            {ins}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.data && (
                    <div className="pt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 font-medium mb-2">DADOS DA SEMANA</p>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">Impressões</p>
                          <p className="text-slate-300 font-medium">{(r.data.ads?.impressions ?? 0).toLocaleString("pt-BR")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Cliques</p>
                          <p className="text-slate-300 font-medium">{(r.data.ads?.clicks ?? 0).toLocaleString("pt-BR")}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Leads</p>
                          <p className="text-slate-300 font-medium">{r.data.leads ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
