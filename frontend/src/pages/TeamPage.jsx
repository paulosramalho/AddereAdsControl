import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../components/Toast.jsx";
import { ConfirmModal } from "../components/ConfirmModal.jsx";
import { decodePayload, getToken } from "../lib/auth.js";

export default function TeamPage() {
  const { addToast } = useToast();
  const payload = decodePayload(getToken());
  const clientId = payload?.clientId;
  const myId = payload?.sub;

  const [users, setUsers] = useState([]);
  const [maxAdmins, setMaxAdmins] = useState(null);
  const [maxViewers, setMaxViewers] = useState(null);
  const [userForm, setUserForm] = useState({ email: "", name: "", password: "", role: "ADMIN" });
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState({});
  const [confirmUser, setConfirmUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    try {
      const res = await api.get(`/clients/${clientId}/users`);
      const d = await res.json();
      setUsers(d.users ?? []);
      setMaxAdmins(d.maxAdmins ?? null);
      setMaxViewers(d.maxViewers ?? null);
    } catch {
      addToast("Erro ao carregar equipe", "error");
    }
  }

  useEffect(() => { if (clientId) load(); }, [clientId]);

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
        load();
      } else {
        addToast(d.message ?? "Erro ao criar usuário", "error");
      }
    } catch {
      addToast("Erro ao criar usuário", "error");
    } finally {
      setSavingUser(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const body = {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        ...(editingUser.password ? { password: editingUser.password } : {}),
      };
      const res = await api.put(`/clients/${clientId}/users/${editingUser.id}`, body);
      const d = await res.json();
      if (res.ok) {
        addToast("Usuário atualizado", "success");
        setEditingUser(null);
        load();
      } else {
        addToast(d.message ?? "Erro ao atualizar usuário", "error");
      }
    } catch {
      addToast("Erro ao atualizar usuário", "error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteUser(userId) {
    setDeletingUser((d) => ({ ...d, [userId]: true }));
    try {
      const res = await api.del(`/clients/${clientId}/users/${userId}`);
      if (res.ok) {
        addToast("Usuário removido", "success");
        load();
      } else {
        addToast("Erro ao remover usuário", "error");
      }
    } catch {
      addToast("Erro ao remover usuário", "error");
    } finally {
      setDeletingUser((d) => ({ ...d, [userId]: false }));
    }
  }

  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const viewerCount = users.filter((u) => u.role === "VIEWER").length;
  const totalContratado =
    maxAdmins !== null && maxViewers !== null ? maxAdmins + maxViewers : null;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">Equipe</h1>
        {totalContratado !== null && (
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5">
            <span className="text-slate-300 font-medium">{totalContratado} usuário{totalContratado !== 1 ? "s" : ""} contratado{totalContratado !== 1 ? "s" : ""}</span>
            <span className="text-slate-600">·</span>
            <span>Admin: {adminCount} de {maxAdmins}</span>
            <span className="text-slate-600">·</span>
            <span>Viewer: {viewerCount} de {maxViewers}</span>
          </div>
        )}
        {totalContratado === null && (
          <div className="mt-1 flex gap-4 text-xs text-slate-400">
            <span>{adminCount} admin{maxAdmins !== null ? ` / ${maxAdmins}` : ""}</span>
            <span>{viewerCount} viewer{maxViewers !== null ? ` / ${maxViewers}` : ""}</span>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
        <p className="text-sm font-medium text-white">Novo usuário</p>
        <form onSubmit={saveUser} className="space-y-3">
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
                <option value="ADMIN">Admin — acesso total</option>
                <option value="VIEWER">Viewer — somente leitura</option>
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
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <p className="text-sm font-medium text-white mb-3">Membros da equipe</p>
        {users.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum usuário criado ainda.</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {users.map((u) => (
              <div key={u.id}>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <span className="text-white">{u.name}</span>
                    {u.id === myId && <span className="ml-1.5 text-xs text-slate-500">(você)</span>}
                    <span className="text-slate-500 mx-1.5">·</span>
                    <span className="text-slate-400 text-xs">{u.email}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${u.role === "ADMIN" ? "bg-blue-900/40 text-blue-300" : "bg-slate-700 text-slate-400"}`}>
                      {u.role === "ADMIN" ? "Admin" : "Viewer"}
                    </span>
                  </div>
                  {u.id !== myId && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setEditingUser(
                          editingUser?.id === u.id
                            ? null
                            : { id: u.id, name: u.name, email: u.email, role: u.role, password: "" }
                        )}
                        className="text-xs text-slate-400 hover:text-white transition"
                      >
                        {editingUser?.id === u.id ? "Cancelar" : "Editar"}
                      </button>
                      <button
                        onClick={() => setConfirmUser({ id: u.id, name: u.name })}
                        disabled={deletingUser[u.id]}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition"
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>

                {editingUser?.id === u.id && (
                  <form onSubmit={saveEdit} className="pb-3 pt-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Nome</label>
                        <input
                          type="text"
                          value={editingUser.name}
                          onChange={(e) => setEditingUser((f) => ({ ...f, name: e.target.value }))}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser((f) => ({ ...f, email: e.target.value }))}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Nova senha (opcional)</label>
                        <input
                          type="password"
                          value={editingUser.password}
                          onChange={(e) => setEditingUser((f) => ({ ...f, password: e.target.value }))}
                          placeholder="Deixe em branco para manter"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Perfil</label>
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser((f) => ({ ...f, role: e.target.value }))}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="ADMIN">Admin — acesso total</option>
                          <option value="VIEWER">Viewer — somente leitura</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingEdit || !editingUser.name || !editingUser.email}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
                      >
                        {savingEdit ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmUser}
        title={`Remover ${confirmUser?.name}?`}
        message="O acesso será revogado imediatamente. Esta ação não pode ser desfeita."
        onConfirm={() => { deleteUser(confirmUser.id); setConfirmUser(null); }}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  );
}
