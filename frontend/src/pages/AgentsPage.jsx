import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";

const JOB_LABELS = {
  "ads-collection": "Coleta de Anúncios",
  "instagram-collection": "Coleta Instagram",
  "post-analysis": "Análise de Posts",
  "trending-suggestions": "Tendências",
  "content-suggestions": "Sugestões de Conteúdo",
  "boost-suggestions": "Sugestões de Boost",
  "weekly-report": "Relatório Semanal",
  "publish-scheduled": "Publicação Agendada",
};

const STATUS_STYLE = {
  SUCCESS: "bg-emerald-900/40 text-emerald-300",
  FAILED: "bg-red-900/40 text-red-300",
  RUNNING: "bg-amber-900/40 text-amber-300",
  NEVER: "bg-slate-700 text-slate-400",
};

const STATUS_LABEL = {
  SUCCESS: "Sucesso",
  FAILED: "Falha",
  RUNNING: "Executando",
  NEVER: "Nunca executou",
};

function fmtAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Math.round((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.round(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h atrás`;
  return `${Math.round(diff / 86400)}d atrás`;
}

export default function AgentsPage() {
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});

  async function load() {
    try {
      const res = await api.get("/agents/status");
      const data = await res.json();
      if (data.clients) setClients(data.clients);
    } catch {
      addToast("Erro ao carregar status dos agentes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function trigger(jobName, clientId) {
    const key = `${clientId}-${jobName}`;
    setRunning((r) => ({ ...r, [key]: true }));
    try {
      const res = await api.post("/jobs/" + jobName + "/run", clientId ? { clientId } : {});
      const data = await res.json();
      if (res.ok) {
        addToast("Job iniciado com sucesso", "success");
        setTimeout(load, 2000);
      } else {
        addToast(data.message ?? "Erro ao disparar job", "error");
      }
    } catch {
      addToast("Erro ao disparar job", "error");
    } finally {
      setRunning((r) => ({ ...r, [key]: false }));
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-slate-400">Carregando agentes...</div>
    );
  }

  if (!clients.length) {
    return (
      <div className="p-8 text-slate-400">Nenhuma execução registrada ainda.</div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Monitoramento de Agentes</h1>
        <button
          onClick={load}
          className="text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition"
        >
          Atualizar
        </button>
      </div>

      {clients.map((c) => (
        <div key={c.clientId ?? "__global__"} className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="px-5 py-3 border-b border-slate-700 flex items-center gap-3">
            <span className="font-medium text-white">{c.clientName ?? "Global"}</span>
            {c.clientSlug && <span className="text-xs text-slate-500">{c.clientSlug}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-700">
                  <th className="text-left px-5 py-2 font-medium">Agente</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Última execução</th>
                  <th className="text-left px-4 py-2 font-medium">Duração</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {c.jobs.map((j) => {
                  const key = `${c.clientId}-${j.name}`;
                  return (
                    <tr key={j.name} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                      <td className="px-5 py-2.5">
                        <div className="text-slate-300 font-medium">{JOB_LABELS[j.name] ?? j.name}</div>
                        {j.error && (
                          <div className="text-xs text-red-400 mt-0.5 max-w-xs truncate" title={j.error}>{j.error}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[j.status] ?? STATUS_STYLE.NEVER}`}>
                          {STATUS_LABEL[j.status] ?? j.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{fmtAgo(j.lastRun)}</td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {j.duration != null ? `${j.duration}s` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => trigger(j.name, c.clientId)}
                          disabled={running[key] || j.status === "RUNNING"}
                          className="text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {running[key] ? "..." : "Disparar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
