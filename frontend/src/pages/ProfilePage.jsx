import { useState } from "react";
import { api } from "../lib/api.js";
import { decodePayload, getToken, setToken } from "../lib/auth.js";
import { useToast } from "../components/Toast.jsx";

export default function ProfilePage() {
  const { addToast } = useToast();
  const payload = decodePayload(getToken());

  const [name, setName] = useState(payload?.userName ?? "");
  const [email, setEmail] = useState(payload?.userEmail ?? "");
  const [savingData, setSavingData] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPass, setSavingPass] = useState(false);

  async function handleSaveData(e) {
    e.preventDefault();
    if (!name.trim()) return addToast("Nome é obrigatório.", "error");
    if (!email.trim()) return addToast("E-mail é obrigatório.", "error");
    setSavingData(true);
    try {
      const res = await api.patch("/auth/me", { name: name.trim(), email: email.trim() });
      const data = await res.json();
      if (!res.ok) return addToast(data.message ?? "Erro ao salvar dados.", "error");
      setToken(data.token);
      addToast("Dados atualizados com sucesso.", "success");
    } catch {
      addToast("Erro de conexão.", "error");
    } finally {
      setSavingData(false);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    if (!currentPassword) return addToast("Informe a senha atual.", "error");
    if (newPassword.length < 8) return addToast("Nova senha deve ter ao menos 8 caracteres.", "error");
    if (newPassword !== confirmPassword) return addToast("As senhas não coincidem.", "error");
    setSavingPass(true);
    try {
      const res = await api.patch("/auth/me", { currentPassword, newPassword });
      const data = await res.json();
      if (!res.ok) return addToast(data.message ?? "Erro ao alterar senha.", "error");
      setToken(data.token);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast("Senha alterada com sucesso.", "success");
    } catch {
      addToast("Erro de conexão.", "error");
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto flex flex-col gap-6">
      <h1 className="text-xl font-bold text-white">Meu Perfil</h1>

      {/* Dados pessoais */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Dados pessoais</h2>
        <form onSubmit={handleSaveData} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-base w-full"
              disabled={savingData}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base w-full"
              disabled={savingData}
            />
          </div>
          <button
            type="submit"
            disabled={savingData}
            className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
          >
            {savingData ? "Salvando…" : "Salvar dados"}
          </button>
        </form>
      </section>

      {/* Alterar senha */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Alterar senha</h2>
        <form onSubmit={handleSavePassword} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Senha atual</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-base w-full"
              disabled={savingPass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nova senha</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-base w-full"
              disabled={savingPass}
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-base w-full"
              disabled={savingPass}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={savingPass}
            className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
          >
            {savingPass ? "Alterando…" : "Alterar senha"}
          </button>
        </form>
      </section>
    </div>
  );
}
