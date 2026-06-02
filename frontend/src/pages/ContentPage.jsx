import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { brlFromCentavos } from "../lib/formatters.js";
import PostsPage from "./PostsPage.jsx";

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

const STATUS_FILTERS = ["PENDING", "APPROVED", "DONE", "REJECTED"];

function SuggestionsTab() {
  const { addToast } = useToast();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [updating, setUpdating] = useState({});
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const res = await api.get(`/suggestions/content?status=${statusFilter}`);
      const d = await res.json();
      setSuggestions(d.data ?? []);
    } catch {
      addToast("Erro ao carregar sugestões", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setLoading(true); load(); }, [statusFilter]);

  async function updateStatus(id, status) {
    setUpdating((u) => ({ ...u, [id]: true }));
    try {
      const res = await api.patch(`/suggestions/content/${id}/status`, { status });
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
      setUpdating((u) => ({ ...u, [id]: false }));
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-white">Sugestões de Pauta</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
            {STATUS_FILTERS.map((f) => (
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
      ) : suggestions.length === 0 ? (
        <div className="text-slate-400 text-center py-16">
          Nenhuma sugestão com status {statusFilter}.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {suggestions.map((s) => (
            <div key={s.id} className="glass-card bg-slate-800/60 rounded-xl border border-slate-700/60 p-4 flex flex-col gap-3">
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
                    onClick={() => updateStatus(s.id, "APPROVED")}
                    disabled={updating[s.id]}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-300 transition disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => updateStatus(s.id, "REJECTED")}
                    disabled={updating[s.id]}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 transition disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              )}
              {statusFilter === "APPROVED" && (
                <button
                  onClick={() => updateStatus(s.id, "DONE")}
                  disabled={updating[s.id]}
                  className="text-xs py-1.5 rounded-lg bg-blue-700/40 hover:bg-blue-700/70 text-blue-300 transition disabled:opacity-50 mt-auto border-t border-slate-700 pt-2"
                >
                  Marcar como feito
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoostTab() {
  const { addToast } = useToast();
  const [boosts, setBoosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [updating, setUpdating] = useState({});

  async function load() {
    try {
      const res = await api.get(`/suggestions/boost?status=${statusFilter}`);
      const d = await res.json();
      setBoosts(d.data ?? []);
    } catch {
      addToast("Erro ao carregar sugestões de boost", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setLoading(true); load(); }, [statusFilter]);

  async function updateStatus(id, status) {
    setUpdating((u) => ({ ...u, [id]: true }));
    try {
      const res = await api.patch(`/suggestions/boost/${id}/status`, { status });
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
      setUpdating((u) => ({ ...u, [id]: false }));
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-white">Sugestões de Impulsionamento</h2>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 transition ${statusFilter === f ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : boosts.length === 0 ? (
        <div className="text-slate-400 text-center py-16">
          Nenhuma sugestão com status {statusFilter}.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {boosts.map((b) => (
            <div key={b.id} className="glass-card bg-slate-800/60 rounded-xl border border-slate-700/60 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-semibold text-lg">
                  {brlFromCentavos(b.suggestedBudget)}
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
                    onClick={() => updateStatus(b.id, "APPROVED")}
                    disabled={updating[b.id]}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-700/40 hover:bg-emerald-700/70 text-emerald-300 transition disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => updateStatus(b.id, "REJECTED")}
                    disabled={updating[b.id]}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/60 text-red-400 transition disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab() {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-medium">Calendário Editorial</p>
          <p className="text-slate-400 text-sm mt-1">Em breve — agendamento e publicação de posts.</p>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: "suggestions", label: "Sugestões" },
  { key: "posts", label: "Posts" },
  { key: "calendar", label: "Calendário" },
  { key: "boost", label: "Impulsionar" },
];

export default function ContentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "suggestions";

  function setTab(key) {
    setSearchParams({ tab: key }, { replace: true });
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 pt-6 border-b border-slate-700">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                activeTab === tab.key
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "suggestions" && <SuggestionsTab />}
      {activeTab === "posts" && <PostsPage />}
      {activeTab === "calendar" && <CalendarTab />}
      {activeTab === "boost" && <BoostTab />}
    </div>
  );
}
