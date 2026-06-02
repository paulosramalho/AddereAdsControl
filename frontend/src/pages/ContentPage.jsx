import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { formatters } from "../lib/formatters.js";

const FORMAT_BADGE = {
  REEL: "bg-purple-900/40 text-purple-300",
  CAROUSEL: "bg-blue-900/40 text-blue-300",
  POST: "bg-slate-700 text-slate-300",
  STORIES: "bg-amber-900/40 text-amber-300",
};

const STATUS_BADGE = {
  PENDING: "bg-slate-700 text-slate-300",
  APPROVED: "bg-emerald-900/40 text-emerald-300",
  REJECTED: "bg-red-900/40 text-red-300",
  DONE: "bg-blue-900/40 text-blue-300",
};

function brlCentavos(cents) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ContentPage() {
  const { addToast } = useToast();
  const [suggestions, setSuggestions] = useState([]);
  const [boosts, setBoosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [updating, setUpdating] = useState({});
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const [rSugg, rBoost] = await Promise.all([
        api.get(`/suggestions/content?status=${statusFilter}`),
        api.get(`/suggestions/boost?status=${statusFilter}`),
      ]);
      const dSugg = await rSugg.json();
      const dBoost = await rBoost.json();
      setSuggestions(dSugg.data ?? []);
      setBoosts(dBoost.data ?? []);
    } catch {
      addToast("Erro ao carregar sugestões", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function updateStatus(type, id, status) {
    const key = `${type}-${id}`;
    setUpdating((u) => ({ ...u, [key]: true }));
    try {
      const res = await api.patch(`/suggestions/${type}/${id}/status`, { status });
      if (res.ok) {
        addToast("Status atualizado", "success");
        load();
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao atualizar status", "error");
      }
    } catch {
      addToast("Erro ao atualizar status", "error");
    } finally {
      setUpdating((u) => ({ ...u, [key]: false }));
    }
  }

  async function triggerTrending() {
    setTriggering(true);
    try {
      const res = await api.post("/jobs/trending-suggestions/run", {});
      const d = await res.json();
      if (res.ok) {
        addToast("Job de tendências iniciado", "success");
        setTimeout(load, 3000);
      } else {
        addToast(d.message ?? "Erro ao iniciar job", "error");
      }
    } catch {
      addToast("Erro ao iniciar job", "error");
    } finally {
      setTriggering(false);
    }
  }

  const filters = ["PENDING", "APPROVED", "DONE", "REJECTED"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Sugestões de Conteúdo</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 transition ${statusFilter === f ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={triggerTrending}
            disabled={triggering}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
          >
            {triggering ? "Gerando..." : "Gerar novas"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : (
        <>
          {suggestions.length === 0 && boosts.length === 0 && (
            <div className="text-slate-400 text-center py-16">
              Nenhuma sugestão com status {statusFilter}.
            </div>
          )}

          {suggestions.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Sugestões de Pauta</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {suggestions.map((s) => (
                  <div key={s.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${FORMAT_BADGE[s.format] ?? "bg-slate-700 text-slate-300"}`}>
                        {s.format}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[s.status] ?? ""}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-white font-medium leading-snug">{s.title}</p>
                    {s.hook && <p className="text-slate-400 text-sm italic">"{s.hook}"</p>}
                    {s.reasoning && (
                      <p className="text-slate-500 text-xs leading-relaxed">{s.reasoning}</p>
                    )}
                    {s.sources?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.sources.map((src, i) => (
                          <span key={i} className="text-xs bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded">
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                    {statusFilter === "PENDING" && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-slate-700">
                        <button
                          onClick={() => updateStatus("content", s.id, "APPROVED")}
                          disabled={updating[`content-${s.id}`]}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-300 transition disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => updateStatus("content", s.id, "REJECTED")}
                          disabled={updating[`content-${s.id}`]}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 transition disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                    {statusFilter === "APPROVED" && (
                      <button
                        onClick={() => updateStatus("content", s.id, "DONE")}
                        disabled={updating[`content-${s.id}`]}
                        className="text-xs py-1.5 rounded-lg bg-blue-700/40 hover:bg-blue-700/70 text-blue-300 transition disabled:opacity-50 mt-auto border-t border-slate-700 pt-2"
                      >
                        Marcar como feito
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {boosts.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-slate-400 mb-3">Sugestões de Boost</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {boosts.map((b) => (
                  <div key={b.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-semibold text-lg">
                        {brlCentavos(b.suggestedBudget)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGE[b.status] ?? ""}`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm">
                      ~{b.estimatedLeads} lead{b.estimatedLeads !== 1 ? "s" : ""} estimado{b.estimatedLeads !== 1 ? "s" : ""}
                    </p>
                    {b.postCaption && (
                      <p className="text-slate-500 text-xs italic line-clamp-2">"{b.postCaption}"</p>
                    )}
                    {b.reasoning && (
                      <p className="text-slate-500 text-xs leading-relaxed">{b.reasoning}</p>
                    )}
                    {statusFilter === "PENDING" && (
                      <div className="flex gap-2 mt-auto pt-2 border-t border-slate-700">
                        <button
                          onClick={() => updateStatus("boost", b.id, "APPROVED")}
                          disabled={updating[`boost-${b.id}`]}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-300 transition disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => updateStatus("boost", b.id, "REJECTED")}
                          disabled={updating[`boost-${b.id}`]}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 transition disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
