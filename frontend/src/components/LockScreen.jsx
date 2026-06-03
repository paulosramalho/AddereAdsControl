import { useState, useEffect, useRef } from "react";
import { getLockUser, setToken } from "../lib/auth.js";
import { api } from "../lib/api.js";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function useBRTClock() {
  const [clock, setClock] = useState({ hora: "", data: "" });
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock({
        hora: now.toLocaleTimeString("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" }),
        data: now.toLocaleDateString("pt-BR", { timeZone: "America/Belem", weekday: "long", day: "2-digit", month: "long" }),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const clock = useBRTClock();
  const user = getLockUser();

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, []);

  async function handleUnlock(e) {
    e.preventDefault();
    if (!password) { setError("Informe a senha."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email: user?.email, password, rememberMe: false });
      const data = await res.json();
      if (!res.ok) {
        setError("Senha incorreta. Tente novamente.");
        setPassword("");
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }
      setToken(data.token);
      onUnlock();
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm p-6">
      {/* Relógio */}
      <div className="text-7xl font-bold text-white tabular-nums tracking-tight leading-none">
        {clock.hora}
      </div>
      <div className="text-sm text-slate-400 mt-2 mb-8 capitalize">
        {clock.data}
      </div>

      {/* Card de desbloqueio */}
      <form
        onSubmit={handleUnlock}
        className="glass-card rounded-2xl p-8 w-80 flex flex-col items-center gap-4"
      >
        {/* Avatar com iniciais */}
        <div className="w-16 h-16 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center text-2xl font-bold text-indigo-400 select-none">
          {getInitials(user?.name)}
        </div>

        <div className="text-center leading-snug">
          <div className="text-white font-semibold">{user?.name || "Usuário"}</div>
          <div className="text-slate-500 text-xs mt-0.5">Tela bloqueada</div>
        </div>

        <div className="w-full">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            placeholder="Digite sua senha"
            disabled={loading}
            className="input-base w-full"
          />
          {error && <p className="text-red-400 text-xs mt-1.5 text-center">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition"
        >
          {loading ? "Verificando…" : "Desbloquear"}
        </button>
      </form>

      <div className="mt-8 text-slate-700 text-xs tracking-widest uppercase">
        Addere Ads Control
      </div>
    </div>
  );
}
