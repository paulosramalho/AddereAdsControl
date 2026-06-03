import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, BarChart2, FileText, TrendingUp, UserCog, Building2, Bot, LogOut } from "lucide-react";
import { clearToken, decodePayload, getToken, lockScreen } from "../lib/auth.js";
import { api } from "../lib/api.js";

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

  async function logout() {
    await api.post("/auth/logout", {}).catch(() => {});
    clearToken();
    navigate("/login");
  }

  function lock() {
    lockScreen();
    navigate("/login", { state: { locked: true } });
  }

  const links = NAV.filter((n) => {
    if (n.superOnly && !isSuper) return false;
    if (n.hideForSuper && isSuper) return false;
    if (n.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-900 text-white">
      <aside className="w-56 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col">

        {/* Header — logo / cliente */}
        <div className="px-6 py-5 border-b border-slate-700">
          {isSuper ? (
            <>
              <span className="font-bold text-base tracking-tight">Addere Ads Control</span>
              <span className="block text-xs text-amber-400 mt-0.5">Super Admin</span>
            </>
          ) : (
            <>
              <span className="font-bold text-base tracking-tight leading-tight block">
                {payload?.clientName ?? "—"}
              </span>
              <span className="block text-xs text-slate-500 italic mt-0.5 text-right">By Addere Ads Control</span>
            </>
          )}
        </div>

        {/* Data e hora BRT */}
        <div className="px-6 py-2.5 border-b border-slate-700/60">
          <span className="block text-xs text-slate-400 tabular-nums">{clock.date}</span>
          <span className="block text-xs text-slate-500 tabular-nums">{clock.time}</span>
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
        <div className="border-t border-slate-700 p-3 flex flex-col gap-1">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-slate-300 truncate">
              {payload?.userName ?? "—"}
            </p>
            <p className="text-xs text-slate-500 truncate">{payload?.userEmail ?? ""}</p>
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              {roleLabel(payload?.role)}
            </span>
          </div>
          <button
            onClick={lock}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition"
          >
            <LogOut size={15} className="flex-shrink-0 rotate-180" />
            Bloquear Tela
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition"
          >
            <LogOut size={15} className="flex-shrink-0" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
