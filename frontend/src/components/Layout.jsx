import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, BarChart2, FileText, TrendingUp, UserCog, Building2, Bot, LogOut } from "lucide-react";
import { clearToken, decodePayload, getToken, isLocked, lockScreen, unlockScreen } from "../lib/auth.js";
import { api } from "../lib/api.js";
import LockScreen from "./LockScreen.jsx";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users, hideForSuper: true },
  { to: "/campaigns", label: "Campanhas", icon: BarChart2, hideForSuper: true },
  { to: "/content", label: "Conteúdo", icon: FileText, hideForSuper: true },
  { to: "/weekly", label: "Relatórios", icon: TrendingUp, hideForSuper: true },
  { to: "/team", label: "Equipe", icon: UserCog, hideForSuper: true, adminOnly: true },
  { to: "/clients", label: "Clientes", icon: Building2, superOnly: true },
  { to: "/agents", label: "Agentes", icon: Bot, superOnly: true },
];

function useBRTClock() {
  const [clock, setClock] = useState({ date: "", time: "" });

  useEffect(() => {
    function tick() {
      const now = new Date();
      const date = now.toLocaleDateString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric" });
      const time = now.toLocaleTimeString("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setClock({ date, time });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return clock;
}

function roleLabel(role) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "ADMIN") return "Administrador";
  return "Usuário";
}

export function Layout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const payload = decodePayload(getToken());
  const isSuper = payload?.role === "SUPER_ADMIN";
  const isAdmin = payload?.role === "ADMIN";
  const clock = useBRTClock();
  const [locked, setLocked] = useState(isLocked);

  async function logout() {
    await api.post("/auth/logout", {}).catch(() => {});
    clearToken();
    navigate("/login");
  }

  function lock() {
    lockScreen({ email: payload?.userEmail, name: payload?.userName });
    setLocked(true);
  }

  function handleUnlock() {
    unlockScreen();
    setLocked(false);
  }

  const links = NAV.filter((n) => {
    if (n.superOnly && !isSuper) return false;
    if (n.hideForSuper && isSuper) return false;
    if (n.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {locked && <LockScreen onUnlock={handleUnlock} />}
      <aside className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">

        {/* Header — logo / cliente */}
        {isSuper ? (
          <div className="px-4 py-4 border-b border-slate-700 flex flex-col items-center gap-1.5">
            <img src="/logo-addere.png" alt="Addere" className="h-9 object-contain" />
            <span className="font-semibold text-sm tracking-tight text-white">Addere Ads Control</span>
            <span className="text-[10px] text-amber-400 font-medium">Super Admin</span>
          </div>
        ) : (
          <div className="px-6 py-5 border-b border-slate-700">
            <span className="font-bold text-base tracking-tight leading-tight block">
              {payload?.clientName ?? "—"}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500 italic mt-1">
              <img src="/logo-addere.png" alt="Addere" className="h-3 object-contain opacity-40" />
              By Addere Ads Control
            </span>
          </div>
        )}

        {/* Data e hora BRT */}
        <div className="px-3 py-2.5 border-b border-slate-700/60">
          <div className="bg-slate-700/50 border border-slate-600/60 rounded-xl px-3 py-2.5 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-200 tabular-nums tracking-wide">{clock.date}</span>
            <span className="text-sm font-bold text-slate-300 tabular-nums tracking-wide">{clock.time}</span>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          {links.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? "bg-slate-700 text-white font-medium"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                {Icon && <Icon size={15} className="flex-shrink-0" />}
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé — usuário + botões */}
        <div className="border-t border-slate-700 p-3 flex flex-col gap-2">
          {/* Card do usuário */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl px-3 py-2.5 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 select-none">
                {(payload?.userName ?? "U").trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate leading-tight">
                  {payload?.userName ?? "—"}
                </p>
                <p className="text-[10px] text-indigo-200 font-medium leading-tight">
                  {roleLabel(payload?.role)}
                </p>
              </div>
            </div>
          </div>

          {/* Bloquear */}
          <button
            onClick={lock}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-sm font-semibold transition-all"
          >
            <LogOut size={14} className="flex-shrink-0 rotate-180" />
            Bloquear Tela
          </button>

          {/* Sair */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-lg hover:shadow-red-500/30"
          >
            <LogOut size={14} className="flex-shrink-0" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
