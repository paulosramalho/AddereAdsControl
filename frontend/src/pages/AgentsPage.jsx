import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";

const JOB_LABELS = {
  "instagram-collection": "Coletor de Posts",
  "post-analysis":        "Analisador de Posts",
  "content-suggestions":  "Sugestor de Conteúdo",
  "trending-suggestions": "Agente de Tendências",
  "ads-collection":       "Coletor de Anúncios",
  "instagram-notify":     "Notificador",
  "publish-scheduled":    "Publicador de Posts",
  "boost-suggestions":    "Sugestor de Impulsionamento",
  "weekly-report":        "Relatório Semanal",
};

const JOB_DESCRIPTIONS = {
  "instagram-collection": "Coleta posts e métricas do perfil via Instagram Graph API.",
  "post-analysis":        "Avalia qualidade de cada post com Claude e recomenda ação (Investir, Redirecionar, Remover…).",
  "content-suggestions":  "Analisa o histórico do perfil e sugere novos temas e formatos de post.",
  "trending-suggestions": "Varre 7 fontes — Conjur, JOTA, Migalhas, YouTube BR, Google Trends BR, Reddit BR (r/conselhojuridico + r/direito) e Instituições BR (STJ + Câmara + Senado) — em busca de pautas em alta e sugere 7 posts.",
  "ads-collection":       "Coleta métricas diárias de campanhas no Google Ads e Meta Ads.",
  "instagram-notify":     "Envia e-mail diário com posts INVEST/REMOVE e alerta de renovação do token.",
  "publish-scheduled":    "Publica posts agendados no Instagram (foto + carrossel) — tick a cada 5 min. Gate: IG_PUBLISH_ENABLED.",
  "boost-suggestions":    "Cruza posts orgânicos com tração + análise INVEST + saldo do mês + CPL histórico, e sugere quanto investir em boost por post.",
  "weekly-report":        "Gera relatório semanal consolidado com métricas de anúncios, posts e leads via Claude. Executa toda segunda-feira.",
};

// BRT hours (UTC-3) espelhados do scheduler.js
const JOB_SCHEDULE = {
  "instagram-collection": { type: "daily",      hour: 1 },
  "ads-collection":       { type: "daily",      hour: 2 },
  "post-analysis":        { type: "daily",      hour: 3 },
  "trending-suggestions": { type: "daily",      hour: 4 },
  "content-suggestions":  { type: "daily",      hour: 5 },
  "boost-suggestions":    { type: "daily",      hour: 6 },
  "instagram-notify":     { type: "daily",      hour: 7 },
  "weekly-report":        { type: "weekly-mon", hour: 7 },
  "publish-scheduled":    { type: "continuous" },
};

const STATUS_STYLE = {
  SUCCESS: "bg-emerald-900/40 text-emerald-300",
  FAILED:  "bg-red-900/40 text-red-300",
  RUNNING: "bg-amber-900/40 text-amber-300",
  NEVER:   "bg-slate-700 text-slate-400",
};

const STATUS_LABEL = {
  SUCCESS: "Sucesso",
  FAILED:  "Falha",
  RUNNING: "Executando",
  NEVER:   "Nunca executou",
};

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextRunLabel(jobName) {
  const sched = JOB_SCHEDULE[jobName];
  if (!sched) return "—";
  if (sched.type === "continuous") return "Contínuo (5 min)";

  // BRT = UTC-3: subtrair 3h do timestamp UTC para trabalhar com UTC como se fosse BRT
  const brtMs = Date.now() - 3 * 3_600_000;
  const brt = new Date(brtMs);
  const hour = brt.getUTCHours();
  const dow  = brt.getUTCDay(); // 0=Dom, 1=Seg

  const target = new Date(brtMs);
  target.setUTCMinutes(0, 0, 0);

  if (sched.type === "daily") {
    target.setUTCHours(sched.hour);
    if (hour >= sched.hour) target.setUTCDate(target.getUTCDate() + 1);
  } else {
    // weekly-mon
    let daysToMon = (1 - dow + 7) % 7;
    if (daysToMon === 0 && hour >= sched.hour) daysToMon = 7;
    target.setUTCDate(target.getUTCDate() + daysToMon);
    target.setUTCHours(sched.hour);
  }

  const d = String(target.getUTCDate()).padStart(2, "0");
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  const h = String(target.getUTCHours()).padStart(2, "0");
  return `${d}/${m}, ${h}:00`;
}

export default function AgentsPage() {
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState({});
  const pollRef = useRef(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function load() {
    try {
      const res = await api.get("/agents/status");
      const data = await res.json();
      if (data.clients) {
        setClients(data.clients);
        const anyRunning = data.clients.some(c => c.jobs.some(j => j.status === "RUNNING"));
        if (!anyRunning) stopPolling();
        setRunning((prev) => {
          if (!Object.values(prev).some(Boolean)) return prev;
          const next = { ...prev };
          let changed = false;
          for (const c of data.clients) {
            for (const j of c.jobs) {
              const key = `${c.clientId}-${j.name}`;
              if (next[key] && j.status !== "RUNNING") {
                delete next[key];
                changed = true;
              }
            }
          }
          return changed ? next : prev;
        });
      }
    } catch {
      addToast("Erro ao carregar status dos agentes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    return stopPolling;
  }, []);

  async function trigger(jobName, clientId) {
    const rkey = `${clientId}-${jobName}`;
    setRunning((r) => ({ ...r, [rkey]: true }));
    try {
      const res = await api.post("/jobs/" + jobName + "/run", clientId ? { clientId } : {});
      if (res.ok) {
        stopPolling();
        pollRef.current = setInterval(load, 2000);
        // safety: limpa botão após 2 minutos se polling não detectar a transição
        setTimeout(() => {
          stopPolling();
          setRunning((r) => { const n = { ...r }; delete n[rkey]; return n; });
        }, 120_000);
      } else {
        const data = await res.json();
        addToast(data.message ?? "Erro ao disparar job", "error");
        setRunning((r) => { const n = { ...r }; delete n[rkey]; return n; });
      }
    } catch {
      addToast("Erro ao disparar job", "error");
      setRunning((r) => { const n = { ...r }; delete n[rkey]; return n; });
    }
  }

  const totalJobs = clients.reduce((sum, c) => sum + c.jobs.length, 0);

  if (loading) return <div className="p-8 text-slate-400">Carregando agentes...</div>;
  if (!clients.length) return <div className="p-8 text-slate-400">Nenhuma execução registrada ainda.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">
          Agentes <span className="text-slate-500 font-normal">({totalJobs})</span>
        </h1>
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
                  <th className="text-left px-4 py-2 font-medium">Função</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Última execução</th>
                  <th className="text-left px-4 py-2 font-medium">Próxima execução</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {c.jobs.map((j) => {
                  const rkey = `${c.clientId}-${j.name}`;
                  return (
                    <tr key={j.name} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                      <td className="px-5 py-2.5 min-w-[140px]">
                        <div className="text-slate-300 font-medium whitespace-nowrap">
                          {JOB_LABELS[j.name] ?? j.name}
                        </div>
                        {j.error && (
                          <div className="text-xs text-red-400 mt-0.5 max-w-xs truncate" title={j.error}>
                            {j.error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[260px]">
                        {JOB_DESCRIPTIONS[j.name] ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${STATUS_STYLE[j.status] ?? STATUS_STYLE.NEVER}`}>
                          {STATUS_LABEL[j.status] ?? j.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(j.lastRun)}</td>
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{nextRunLabel(j.name)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => trigger(j.name, c.clientId)}
                          disabled={running[rkey] || j.status === "RUNNING"}
                          className="text-xs px-2.5 py-1 rounded border border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
                        >
                          {running[rkey] ? "..." : "Executar"}
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
