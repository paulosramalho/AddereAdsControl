import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken, decodePayload, getToken } from "../lib/auth.js";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/leads", label: "Leads", hideForSuper: true },
  { to: "/campaigns", label: "Campanhas", hideForSuper: true },
  { to: "/content", label: "Conteúdo", hideForSuper: true },
  { to: "/weekly", label: "Relatórios", hideForSuper: true },
  { to: "/team", label: "Equipe", hideForSuper: true, adminOnly: true },
  { to: "/clients", label: "Clientes", superOnly: true },
  { to: "/agents", label: "Agentes", superOnly: true },
];

export function Layout({ children }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const payload = decodePayload(getToken());
  const isSuper = payload?.role === "SUPER_ADMIN";
  const isAdmin = payload?.role === "ADMIN";

  function logout() {
    clearToken();
    navigate("/login");
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
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                pathname.startsWith(n.to)
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition text-left"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
