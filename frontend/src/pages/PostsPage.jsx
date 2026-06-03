import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { decodePayload, getToken } from "../lib/auth.js";

const MEDIA_LABELS = { IMAGE: "Imagem", VIDEO: "Vídeo", REEL: "Reel", CAROUSEL_ALBUM: "Carrossel" };

const BADGE = {
  INVEST:      { label: "INVEST",      cls: "bg-emerald-900/50 text-emerald-300 border border-emerald-700" },
  MANTER:      { label: "MANTER",      cls: "bg-blue-900/50 text-blue-300 border border-blue-700" },
  REDIRECIONAR:{ label: "REDIRECIONAR",cls: "bg-amber-900/50 text-amber-300 border border-amber-700" },
  REMOVER:     { label: "REMOVER",     cls: "bg-red-900/50 text-red-300 border border-red-700" },
  NONE:        { label: "Sem análise", cls: "bg-slate-700 text-slate-400 border border-slate-600" },
};

function getBadge(analysis) {
  if (!analysis) return BADGE.NONE;
  const s = analysis.score;
  if (s >= 7) return BADGE.INVEST;
  if (s >= 5) return BADGE.MANTER;
  if (s >= 3) return BADGE.REDIRECIONAR;
  return BADGE.REMOVER;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function fmtNum(n) {
  return (n ?? 0).toLocaleString("pt-BR");
}

export default function PostsPage() {
  const { clientId: paramClientId } = useParams();
  const { addToast } = useToast();
  const pollRef = useRef(null);
  const analyzedBeforeRef = useRef(0);

  const payload = decodePayload(getToken());
  const clientId = paramClientId ?? payload?.clientId;
  const canAnalyze = payload?.role === "ADMIN" || payload?.role === "SUPER_ADMIN";

  const safetyTimerRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [filterMedia, setFilterMedia] = useState("");
  const [filterAnalyzed, setFilterAnalyzed] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 30;

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function stopSafetyTimer() {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
  }

  async function load(reset = false) {
    if (!clientId) { setLoading(false); return; }
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: reset ? 0 : offset });
      if (filterMedia) params.set("mediaType", filterMedia);
      if (filterAnalyzed) params.set("analyzed", filterAnalyzed);
      const res = await api.get(`/clients/${clientId}/posts?${params}`);
      const data = await res.json();
      if (data.ok) {
        setPosts(data.posts);
        setTotal(data.total);
        if (reset) setOffset(0);
      } else {
        addToast(data.message ?? "Erro ao carregar posts", "error");
      }
    } catch {
      addToast("Erro ao carregar posts", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load(true);
  }, [clientId, filterMedia, filterAnalyzed]);

  useEffect(() => { return () => { stopPolling(); stopSafetyTimer(); }; }, []);

  useEffect(() => {
    if (!analyzing) return;
    const nowAnalyzed = posts.filter((p) => !!p.analysis).length;
    if (nowAnalyzed > analyzedBeforeRef.current) {
      stopSafetyTimer();
      stopPolling();
      setAnalyzing(false);
      addToast("Análise concluída", "success");
    }
  }, [posts]);

  async function triggerAnalysis() {
    analyzedBeforeRef.current = posts.filter((p) => !!p.analysis).length;
    setAnalyzing(true);
    try {
      const res = await api.post(`/clients/${clientId}/posts/analyze`, {});
      if (res.ok) {
        addToast("Análise iniciada — atualizará em breve", "info");
        stopPolling();
        pollRef.current = setInterval(() => load(true), 5000);
        safetyTimerRef.current = setTimeout(() => { stopPolling(); setAnalyzing(false); }, 120_000);
      } else {
        const data = await res.json();
        addToast(data.message ?? "Erro ao disparar análise", "error");
        setAnalyzing(false);
      }
    } catch {
      addToast("Erro ao disparar análise", "error");
      setAnalyzing(false);
    }
  }

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  async function goPage(page) {
    const newOffset = (page - 1) * LIMIT;
    setOffset(newOffset);
    setLoading(true);
    if (!clientId) return;
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: newOffset });
      if (filterMedia) params.set("mediaType", filterMedia);
      if (filterAnalyzed) params.set("analyzed", filterAnalyzed);
      const res = await api.get(`/clients/${clientId}/posts?${params}`);
      const data = await res.json();
      if (data.ok) { setPosts(data.posts); setTotal(data.total); }
    } catch {
      addToast("Erro ao carregar posts", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-semibold text-white">
          Posts <span className="text-slate-500 font-normal">({total})</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterMedia}
            onChange={(e) => setFilterMedia(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-500"
          >
            <option value="">Todos os tipos</option>
            <option value="IMAGE">Imagem</option>
            <option value="VIDEO">Vídeo</option>
            <option value="REEL">Reel</option>
            <option value="CAROUSEL_ALBUM">Carrossel</option>
          </select>
          <select
            value={filterAnalyzed}
            onChange={(e) => setFilterAnalyzed(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-500"
          >
            <option value="">Todos</option>
            <option value="true">Com análise</option>
            <option value="false">Sem análise</option>
          </select>
          {canAnalyze && (
            <button
              onClick={triggerAnalysis}
              disabled={analyzing}
              className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition font-medium"
            >
              {analyzing ? "Analisando..." : "Analisar posts"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">Carregando posts...</div>
      ) : posts.length === 0 ? (
        <div className="text-slate-400 text-sm">Nenhum post encontrado.</div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-700">
                <th className="text-left px-4 py-2.5 font-medium">Caption</th>
                <th className="text-left px-3 py-2.5 font-medium">Tipo</th>
                <th className="text-right px-3 py-2.5 font-medium">Likes</th>
                <th className="text-right px-3 py-2.5 font-medium">Coment.</th>
                <th className="text-right px-3 py-2.5 font-medium">Alcance</th>
                <th className="text-right px-3 py-2.5 font-medium">Impr.</th>
                <th className="text-left px-3 py-2.5 font-medium">Data</th>
                <th className="text-left px-3 py-2.5 font-medium">IA</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const badge = getBadge(post.analysis);
                const isOpen = expanded === post.id;
                return (
                  <>
                    <tr
                      key={post.id}
                      className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 cursor-pointer"
                      onClick={() => toggleExpand(post.id)}
                    >
                      <td className="px-4 py-2.5 max-w-[260px]">
                        <span className="text-slate-300 truncate block" title={post.caption ?? ""}>
                          {post.caption ? (post.caption.length > 80 ? post.caption.slice(0, 80) + "…" : post.caption) : <span className="text-slate-600 italic">sem legenda</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {MEDIA_LABELS[post.mediaType] ?? post.mediaType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{fmtNum(post.likes)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{fmtNum(post.comments)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{fmtNum(post.reach)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{fmtNum(post.impressions)}</td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(post.timestamp)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${badge.cls}`}>
                          {badge.label}
                          {post.analysis && <span className="ml-1 opacity-60">({post.analysis.score})</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {isOpen ? "▲" : "▼"}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${post.id}-detail`} className="border-b border-slate-700/50 bg-slate-900/40">
                        <td colSpan={9} className="px-6 py-4">
                          {post.analysis ? (
                            <div className="space-y-3">
                              {post.analysis.reasoning && (
                                <p className="text-slate-300 text-sm leading-relaxed">{post.analysis.reasoning}</p>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {post.analysis.strengths?.length > 0 && (
                                  <div>
                                    <div className="text-xs text-emerald-400 font-medium mb-1">Pontos fortes</div>
                                    <ul className="space-y-0.5">
                                      {post.analysis.strengths.map((s, i) => (
                                        <li key={i} className="text-sm text-slate-300 flex gap-2">
                                          <span className="text-emerald-500 flex-shrink-0">+</span>{s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {post.analysis.improvements?.length > 0 && (
                                  <div>
                                    <div className="text-xs text-amber-400 font-medium mb-1">Melhorias</div>
                                    <ul className="space-y-0.5">
                                      {post.analysis.improvements.map((s, i) => (
                                        <li key={i} className="text-sm text-slate-300 flex gap-2">
                                          <span className="text-amber-500 flex-shrink-0">→</span>{s}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              {post.permalink && (
                                <a
                                  href={post.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ver no Instagram ↗
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-slate-500 text-sm">Este post ainda não foi analisado pela IA.</p>
                              {post.permalink && (
                                <a
                                  href={post.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ver no Instagram ↗
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{total} posts · página {currentPage} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => goPage(currentPage - 1)}
              className="px-3 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Anterior
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => goPage(currentPage + 1)}
              className="px-3 py-1 rounded border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
