import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";

const PLATFORMS = ["GOOGLE_ADS", "META_ADS", "INSTAGRAM", "ANTHROPIC", "RESEND"];
const CLIENT_STATUS_LABEL = { TRIAL: "Trial", ACTIVE: "Ativo", SUSPENDED: "Suspenso" };

const PLATFORM_KEYS = {
  GOOGLE_ADS: ["customer_id", "client_id", "client_secret", "refresh_token", "developer_token"],
  META_ADS: ["access_token", "account_id"],
  INSTAGRAM: ["access_token", "user_id"],
  ANTHROPIC: ["api_key", "youtube_api_key"],
  RESEND: ["api_key", "from_email"],
};

export default function ClientEditPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [client, setClient] = useState(null);
  const [copied, setCopied] = useState(false);

  const copyId = useCallback(() => {
    navigator.clipboard.writeText(clientId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [clientId]);
  const [form, setForm] = useState({});
  const [credentials, setCredentials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [credForm, setCredForm] = useState({ platform: "ANTHROPIC", key: "api_key", value: "" });
  const [savingCred, setSavingCred] = useState(false);
  const [deletingCred, setDeletingCred] = useState({});
  const [confirmCred, setConfirmCred] = useState(null); // { platform, key }
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState({ email: "", name: "", password: "", role: "ADMIN" });
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState({});
  const [confirmUser, setConfirmUser] = useState(null); // { id, name }

  const [notifPrefs, setNotifPrefs] = useState(null);
  const [savingNotif, setSavingNotif] = useState(false);

  async function load() {
    try {
      const [rClient, rCreds, rUsers, rNotif] = await Promise.all([
        api.get(`/clients/${clientId}`),
        api.get(`/clients/${clientId}/credentials`),
        api.get(`/clients/${clientId}/users`),
        api.get(`/clients/${clientId}/notifications`),
      ]);
      const c = await rClient.json();
      const creds = await rCreds.json();
      const u = await rUsers.json();
      const notif = await rNotif.json();
      setClient(c);
      setUsers(u.users ?? []);
      setNotifPrefs(notif);
      setForm({
        name: c.name ?? "",
        slug: c.slug ?? "",
        niche: c.niche ?? "",
        targetAudience: c.targetAudience ?? "",
        keywords: (c.keywords ?? []).join(", "),
        contentTone: c.contentTone ?? "",
        timezone: c.timezone ?? "America/Belem",
        status: c.status ?? "TRIAL",
        maxAdmins: c.maxAdmins !== null && c.maxAdmins !== undefined ? String(c.maxAdmins) : "",
        maxViewers: c.maxViewers !== null && c.maxViewers !== undefined ? String(c.maxViewers) : "",
      });
      setCredentials(creds);
    } catch {
      addToast("Erro ao carregar cliente", "error");
    }
  }

  useEffect(() => { load(); }, [clientId]);

  async function saveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        keywords: form.keywords ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean) : [],
        maxAdmins: form.maxAdmins !== "" ? parseInt(form.maxAdmins, 10) : null,
        maxViewers: form.maxViewers !== "" ? parseInt(form.maxViewers, 10) : null,
      };
      const res = await api.put(`/clients/${clientId}`, payload);
      if (res.ok) {
        addToast("Perfil atualizado", "success");
        load();
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar", "error");
      }
    } catch {
      addToast("Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveCred(e) {
    e.preventDefault();
    if (!credForm.value) return;
    setSavingCred(true);
    try {
      const res = await api.put(
        `/clients/${clientId}/credentials/${credForm.platform}/${credForm.key}`,
        { value: credForm.value }
      );
      if (res.ok) {
        setCredForm({ platform: "GOOGLE_ADS", key: PLATFORM_KEYS["GOOGLE_ADS"][0], value: "" });
        await load();
        addToast("Credencial salva", "success");
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar credencial", "error");
      }
    } catch {
      addToast("Erro ao salvar credencial", "error");
    } finally {
      setSavingCred(false);
    }
  }

  async function deleteCred(platform, key) {
    const dkey = `${platform}-${key}`;
    setDeletingCred((d) => ({ ...d, [dkey]: true }));
    try {
      const res = await api.del(`/clients/${clientId}/credentials/${platform}/${key}`);
      if (res.ok) {
        await load();
        addToast("Credencial removida", "success");
      } else {
        addToast("Erro ao remover credencial", "error");
      }
    } catch {
      addToast("Erro ao remover credencial", "error");
    } finally {
      setDeletingCred((d) => ({ ...d, [dkey]: false }));
    }
  }

  async function saveUser(e) {
    e.preventDefault();
    if (!userForm.email || !userForm.name || !userForm.password) return;
    setSavingUser(true);
    try {
      const res = await api.post(`/clients/${clientId}/users`, userForm);
      const d = await res.json();
      if (res.ok) {
        addToast("Usuário criado", "success");
        setUserForm({ email: "", name: "", password: "", role: "ADMIN" });
        setUsers((prev) => [...prev, d.user]);
      } else {
        addToast(d.message ?? "Erro ao criar usuário", "error");
      }
    } catch {
      addToast("Erro ao criar usuário", "error");
    } finally {
      setSavingUser(false);
    }
  }

  async function saveNotifications(e) {
    e.preventDefault();
    setSavingNotif(true);
    try {
      const res = await api.put(`/clients/${clientId}/notifications`, notifPrefs);
      if (res.ok) {
        addToast("Preferências de notificação salvas", "success");
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar preferências", "error");
      }
    } catch {
      addToast("Erro ao salvar preferências", "error");
    } finally {
      setSavingNotif(false);
    }
  }

  async function deleteUser(userId) {
    setDeletingUser((d) => ({ ...d, [userId]: true }));
    try {
      const res = await api.del(`/clients/${clientId}/users/${userId}`);
      if (res.ok) {
        addToast("Usuário removido", "success");
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        addToast("Erro ao remover usuário", "error");
      }
    } catch {
      addToast("Erro ao remover usuário", "error");
    } finally {
      setDeletingUser((d) => ({ ...d, [userId]: false }));
    }
  }

  function field(label, key, opts = {}) {
    return (
      <div>
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <input
          type={opts.type ?? "text"}
          value={form[key] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder={opts.placeholder}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>
    );
  }

  if (!client) return <div className="p-8 text-slate-400">Carregando...</div>;

  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const viewerCount = users.filter((u) => u.role === "VIEWER").length;

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate("/clients")} className="text-slate-400 hover:text-white text-sm transition">
            ← Clientes
          </button>
          <span className="text-slate-600">/</span>
          <h1 className="text-xl font-semibold text-white">{client.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${client.status === "ACTIVE" ? "bg-emerald-900/40 text-emerald-300" : client.status === "SUSPENDED" ? "bg-red-900/40 text-red-300" : "bg-amber-900/40 text-amber-300"}`}>
            {CLIENT_STATUS_LABEL[client.status] ?? client.status}
          </span>
        </div>
        <button
          onClick={copyId}
          title="Copiar ID do cliente"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 transition flex-shrink-0"
        >
          <span className="font-mono">{clientId.slice(0, 12)}…</span>
          <span>{copied ? "✓ copiado" : "copiar ID"}</span>
        </button>
      </div>

      <form onSubmit={saveProfile} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <h2 className="font-medium text-white">Perfil Editorial</h2>
        <div className="grid grid-cols-2 gap-4">
          {field("Nome", "name")}
          {field("Slug", "slug", { placeholder: "ex: joao-silva" })}
          {field("Nicho", "niche", { placeholder: "ex: nutrição, arquitetura, finanças" })}
          {field("Público-alvo", "targetAudience")}
          {field("Tom de voz", "contentTone", { placeholder: "ex: formal, didático" })}
          {field("Fuso horário", "timezone", { placeholder: "America/Belem" })}
        </div>
        {field("Keywords (separadas por vírgula)", "keywords", { placeholder: "ex: receitas, emagrecimento, saúde" })}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Status</label>
          <select
            value={form.status ?? "TRIAL"}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Ativo</option>
            <option value="SUSPENDED">Suspenso</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Limite de Admins (vazio = ilimitado)</label>
            <input
              type="number"
              min="0"
              value={form.maxAdmins ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, maxAdmins: e.target.value }))}
              placeholder="Ilimitado"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Limite de Viewers (vazio = ilimitado)</label>
            <input
              type="number"
              min="0"
              value={form.maxViewers ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, maxViewers: e.target.value }))}
              placeholder="Ilimitado"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-700">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
          >
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <h2 className="font-medium text-white">Credenciais</h2>

        <form onSubmit={saveCred} className="space-y-3">
          <p className="text-xs text-slate-400 font-medium">Adicionar / atualizar credencial</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Plataforma</label>
              <select
                value={credForm.platform}
                onChange={(e) => {
                  const p = e.target.value;
                  setCredForm((f) => ({ ...f, platform: p, key: PLATFORM_KEYS[p]?.[0] ?? "" }));
                }}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Campo</label>
              <select
                value={credForm.key}
                onChange={(e) => setCredForm((f) => ({ ...f, key: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {(PLATFORM_KEYS[credForm.platform] ?? []).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Valor</label>
            <input
              type="password"
              value={credForm.value}
              onChange={(e) => setCredForm((f) => ({ ...f, value: e.target.value }))}
              placeholder="Valor da credencial"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingCred || !credForm.value}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
            >
              {savingCred ? "Salvando..." : "Salvar credencial"}
            </button>
          </div>
        </form>

        {credentials.length > 0 && (
          <div className="border-t border-slate-700 pt-3 divide-y divide-slate-700">
            {credentials.map((c) => (
              <div key={`${c.platform}-${c.key}`} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="text-slate-400 text-xs font-medium">{c.platform}</span>
                  <span className="text-slate-600 mx-1">/</span>
                  <span className="text-white">{c.key}</span>
                  {c.expiresAt && (
                    <span className="ml-2 text-xs text-amber-400">
                      expira {new Date(c.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Belem" })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setConfirmCred({ platform: c.platform, key: c.key })}
                  disabled={deletingCred[`${c.platform}-${c.key}`]}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {credentials.length === 0 && (
          <p className="text-slate-500 text-sm border-t border-slate-700 pt-3">Nenhuma credencial configurada.</p>
        )}
      </div>

      {notifPrefs && (
        <form onSubmit={saveNotifications} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <h2 className="font-medium text-white">Preferências de Notificação</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">E-mails adicionais (separados por vírgula)</label>
            <input
              type="text"
              value={notifPrefs.notify_emails}
              onChange={(e) => setNotifPrefs((p) => ({ ...p, notify_emails: e.target.value }))}
              placeholder="ex: gestor@empresa.com, cliente@empresa.com"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Além dos usuários cadastrados, estes e-mails receberão as notificações.</p>
          </div>
          <div className="space-y-2 pt-1">
            {[
              { key: "notify_daily_summary", label: "Resumo diário de conteúdo", desc: "E-mail com posts de alto e baixo desempenho" },
              { key: "notify_token_alert",   label: "Alerta de token expirando", desc: "Aviso quando o token do Instagram está próximo de expirar" },
              { key: "notify_budget_alert",  label: "Alerta de budget",          desc: "E-mail quando o gasto mensal atingir 90% da meta" },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={(e) => setNotifPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  className="mt-0.5 accent-blue-500"
                />
                <div>
                  <span className="text-sm text-white group-hover:text-blue-300 transition">{label}</span>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-700">
            <button
              type="submit"
              disabled={savingNotif}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
            >
              {savingNotif ? "Salvando..." : "Salvar notificações"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-white">Usuários</h2>
          <div className="flex gap-4 text-xs text-slate-400">
            <span>{adminCount} admin{client.maxAdmins !== null ? ` / ${client.maxAdmins}` : ""}</span>
            <span>{viewerCount} viewer{client.maxViewers !== null ? ` / ${client.maxViewers}` : ""}</span>
          </div>
        </div>

        <form onSubmit={saveUser} className="space-y-3">
          <p className="text-xs text-slate-400 font-medium">Criar novo usuário</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome</label>
              <input
                type="text"
                value={userForm.name}
                onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">E-mail</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Senha (mín. 8 caracteres)</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Senha de acesso"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Perfil</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="ADMIN">ADMIN — acesso total</option>
                <option value="VIEWER">VIEWER — somente leitura</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingUser || !userForm.email || !userForm.name || !userForm.password}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
            >
              {savingUser ? "Criando..." : "Criar usuário"}
            </button>
          </div>
        </form>

        {users.length > 0 && (
          <div className="border-t border-slate-700 pt-3 divide-y divide-slate-700">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="text-white">{u.name}</span>
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-slate-400 text-xs">{u.email}</span>
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${u.role === "ADMIN" ? "bg-blue-900/40 text-blue-300" : "bg-slate-700 text-slate-400"}`}>
                    {u.role}
                  </span>
                </div>
                <button
                  onClick={() => setConfirmUser({ id: u.id, name: u.name })}
                  disabled={deletingUser[u.id]}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {users.length === 0 && (
          <p className="text-slate-500 text-sm border-t border-slate-700 pt-3">Nenhum usuário criado para este cliente.</p>
        )}
      </div>

      <ConfirmModal
        open={!!confirmUser}
        title={`Remover usuário ${confirmUser?.name}?`}
        message="O acesso será revogado imediatamente. Esta ação não pode ser desfeita."
        onConfirm={() => { deleteUser(confirmUser.id); setConfirmUser(null); }}
        onCancel={() => setConfirmUser(null)}
      />

      <ConfirmModal
        open={!!confirmCred}
        title={`Remover credencial ${confirmCred?.platform} / ${confirmCred?.key}?`}
        message="Esta ação remove o valor salvo. Você pode reinserir a qualquer momento."
        onConfirm={() => {
          deleteCred(confirmCred.platform, confirmCred.key);
          setConfirmCred(null);
        }}
        onCancel={() => setConfirmCred(null)}
      />
    </div>
  );
}
