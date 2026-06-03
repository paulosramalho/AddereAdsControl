import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api.js";
import { setToken, unlockScreen } from "../lib/auth.js";
import { useToast } from "../components/Toast.jsx";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const locked = !!location.state?.locked;
  const { addToast: toast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password, rememberMe });
      const data = await res.json();
      if (!res.ok) {
        toast(data.message ?? "Credenciais inválidas", "error");
        return;
      }
      unlockScreen();
      setToken(data.token);
      navigate(location.state?.from ?? "/dashboard");
    } catch {
      toast("Erro de conexão com o servidor", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-1">Addere Ads Control</h1>
        <p className="text-slate-400 text-sm mb-6">
          {locked ? "Tela bloqueada — faça login para continuar" : "Faça login para continuar"}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="input-base w-full"
              placeholder="usuario@email.com"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-base w-full"
              placeholder="••••••••"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400">Manter conectado por 30 dias</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
