import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { decodePayload, getToken } from "../lib/auth.js";
import { useToast } from "../components/Toast.jsx";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

const PLATFORMS = {
  INSTAGRAM: {
    label: "Instagram",
    keys: [
      { key: "access_token", label: "Access Token", hint: "Facebook User Access Token (prefixo EAA)" },
      { key: "user_id", label: "User ID", hint: "ID numérico da conta Business/Creator" },
    ],
  },
  META_ADS: {
    label: "Meta Ads",
    keys: [
      { key: "access_token", label: "Access Token", hint: "Token de acesso da conta Meta Ads" },
      { key: "account_id", label: "Ad Account ID", hint: "ID da conta de anúncios (ex: act_123456)" },
    ],
  },
  GOOGLE_ADS: {
    label: "Google Ads",
    keys: [
      { key: "customer_id", label: "Customer ID", hint: "ID do cliente Google Ads (sem hífens)" },
      { key: "developer_token", label: "Developer Token", hint: "Token de desenvolvedor da conta MCC" },
      { key: "client_id", label: "Client ID", hint: "OAuth2 Client ID" },
      { key: "client_secret", label: "Client Secret", hint: "OAuth2 Client Secret" },
      { key: "refresh_token", label: "Refresh Token", hint: "OAuth2 Refresh Token" },
    ],
  },
  ANTHROPIC: {
    label: "Anthropic (Claude)",
    keys: [
      { key: "api_key", label: "API Key", hint: "Chave privada Claude (sobrepõe a chave global)" },
    ],
  },
  RESEND: {
    label: "Resend (E-mail)",
    keys: [
      { key: "api_key", label: "API Key", hint: "Chave da API Resend" },
      { key: "from", label: "Remetente", hint: "Ex: noreply@seudominio.com.br" },
      { key: "notify_emails", label: "E-mails de notificação", hint: "Separados por vírgula" },
    ],
  },
};

const PLATFORM_BADGE = {
  INSTAGRAM: "bg-pink-900/40 text-pink-300",
  META_ADS:  "bg-blue-900/40 text-blue-300",
  GOOGLE_ADS:"bg-amber-900/40 text-amber-300",
  ANTHROPIC: "bg-violet-900/40 text-violet-300",
  RESEND:    "bg-emerald-900/40 text-emerald-300",
};

function CredentialField({ clientId, platform, keyName, label, hint, savedAt, onChanged }) {
  const { addToast } = useToast();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showInput, setShowInput] = useState(false);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await api.put(`/clients/${clientId}/settings/credentials/${platform}/${keyName}`, { value });
      if (res.ok) {
        addToast(`${label} salvo`, "success");
        setValue("");
        setShowInput(false);
        await onChanged?.();
      } else {
        const d = await res.json();
        addToast(d.message ?? "Erro ao salvar", "error");
      }
    } catch {
      addToast("Erro de conexão", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      const res = await api.del(`/clients/${clientId}/settings/credentials/${platform}/${keyName}`);
      if (res.ok) {
        addToast(`${label} removido`, "info");
        setShowInput(false);
        await onChanged?.();
      } else {
        addToast("Erro ao remover", "error");
      }
    } catch {
      addToast("Erro de conexão", "error");
    } finally {
      setDeleting(false);
    }
  }

  const isSensitive = keyName.includes("token") || keyName.includes("secret") || keyName === "api_key";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-200 font-medium">{label}</span>
          <span className="text-xs text-slate-500 ml-2">{hint}</span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span className="text-xs text-emerald-400">● Configurado</span>
          ) : (
            <span className="text-xs text-slate-500">○ Não configurado</span>
          )}
          {savedAt && !showInput && (
            <button
              onClick={remove}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
            >
              {deleting ? "…" : "Remover"}
            </button>
          )}
          <button
            onClick={() => setShowInput((s) => !s)}
            className="text-xs text-blue-400 hover:text-blue-300 transition"
          >
            {showInput ? "Cancelar" : savedAt ? "Atualizar" : "Configurar"}
          </button>
        </div>
      </div>
      {showInput && (
        <div className="flex gap-2">
          <input
            type={isSensitive ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Novo valor para ${label}…`}
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={save}
            disabled={saving || !value.trim()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm transition"
          >
            {saving ? "…" : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}


function ReadinessPanel({ readiness, loading, onRefresh }) {
  const ready = readiness?.ready;
  const statusText = ready ? "Pronto para publicar" : "Preparação pendente";
  const statusClass = ready ? "text-emerald-300 bg-emerald-900/25 border-emerald-700/40" : "text-amber-300 bg-amber-900/25 border-amber-700/40";

  return (
    <div className="glass-card rounded-xl border border-slate-700/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-800/40">
        <div>
          <h2 className="text-white font-semibold text-sm">Prontidão de publicação</h2>
          <p className="text-xs text-slate-500 mt-0.5">Checklist técnico para publicar no Instagram pelo Addere Ads Control.</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && readiness && (
            <span className={`text-xs px-2 py-1 rounded border ${statusClass}`}>{statusText}</span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Atualizar prontidão"
            aria-label="Atualizar prontidão"
            className="p-2 rounded-lg bg-slate-700 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-400">Verificando publicação...</p>
        ) : !readiness ? (
          <p className="text-sm text-slate-400">Não foi possível carregar o checklist.</p>
        ) : (
          <div className="space-y-2.5">
            {readiness.checks?.map((check) => {
              const Icon = check.ok ? CheckCircle2 : AlertTriangle;
              return (
                <div key={check.key} className="flex items-start gap-3 text-sm">
                  <Icon size={16} className={`mt-0.5 flex-shrink-0 ${check.ok ? "text-emerald-400" : "text-amber-400"}`} />
                  <div className="min-w-0">
                    <p className="text-slate-200 leading-tight">{check.label}</p>
                    <p className="text-xs text-slate-500 truncate" title={check.detail}>{check.detail}</p>
                  </div>
                </div>
              );
            })}
            {readiness.igAccount?.status === "valid" && (
              <div className="mt-3 rounded-lg bg-slate-900/40 border border-slate-700 px-3 py-2 text-xs text-slate-400">
                Conta validada: <span className="text-slate-200">@{readiness.igAccount.data?.username ?? readiness.igAccount.data?.id}</span>
                {readiness.igAccount.data?.account_type && <span> · {readiness.igAccount.data.account_type}</span>}
                {Number.isInteger(readiness.igAccount.data?.media_count) && <span> · {readiness.igAccount.data.media_count.toLocaleString("pt-BR")} mídias</span>}
              </div>
            )}
            {readiness.publishLimit?.status === "error" && (
              <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                O token validou, mas ainda não confirmou permissão de publicação: {readiness.publishLimit.error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const payload = decodePayload(getToken());
  const clientId = payload?.clientId;
  const { addToast } = useToast();
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [igHealth, setIgHealth] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [publishingReadiness, setPublishingReadiness] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(true);

  async function loadCredentials() {
    try {
      const res = await api.get(`/clients/${clientId}/settings/credentials`);
      const d = await res.json();
      if (d.ok) setCreds(d.credentials ?? []);
    } catch {
      addToast("Erro ao carregar configurações", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPublishingReadiness() {
    setLoadingReadiness(true);
    try {
      const res = await api.get(`/clients/${clientId}/settings/publishing-readiness`);
      const d = await res.json();
      if (d.ok) setPublishingReadiness(d);
      else setPublishingReadiness(null);
    } catch {
      setPublishingReadiness(null);
      addToast("Erro ao verificar prontidão de publicação", "error");
    } finally {
      setLoadingReadiness(false);
    }
  }

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    loadCredentials();
    loadPublishingReadiness();
  }, [clientId]);

  async function checkIgHealth() {
    setCheckingHealth(true);
    setIgHealth(null);
    try {
      const res = await api.get(`/clients/${clientId}/settings/credentials/instagram/health`);
      const d = await res.json();
      setIgHealth(d);
      loadPublishingReadiness();
    } catch {
      addToast("Erro ao verificar token", "error");
    } finally {
      setCheckingHealth(false);
    }
  }

  function savedAt(platform, key) {
    return creds.find((c) => c.platform === platform && c.key === key)?.updatedAt ?? null;
  }

  if (!clientId) return (
    <div className="p-6 text-slate-400">Configurações disponíveis apenas para contas de cliente.</div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Configurações</h1>

      <ReadinessPanel
        readiness={publishingReadiness}
        loading={loadingReadiness}
        onRefresh={loadPublishingReadiness}
      />

      {loading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : (
        Object.entries(PLATFORMS).map(([platform, { label, keys }]) => (
          <div key={platform} className="glass-card rounded-xl border border-slate-700/60 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-800/40">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_BADGE[platform] ?? "bg-slate-700 text-slate-300"}`}>
                  {label}
                </span>
              </div>
              {platform === "INSTAGRAM" && (
                <button
                  onClick={checkIgHealth}
                  disabled={checkingHealth}
                  className="text-xs text-slate-400 hover:text-white transition disabled:opacity-50"
                >
                  {checkingHealth ? "Verificando…" : "Verificar token"}
                </button>
              )}
            </div>

            {platform === "INSTAGRAM" && igHealth && (
              <div className={`px-5 py-2 text-xs border-b border-slate-700/40 ${
                igHealth.status === "valid" ? "bg-emerald-900/20 text-emerald-300" :
                igHealth.status === "expired" ? "bg-red-900/20 text-red-300" :
                igHealth.status === "missing" ? "bg-slate-700/30 text-slate-400" :
                "bg-amber-900/20 text-amber-300"
              }`}>
                {igHealth.status === "valid" && `Token válido — conta: ${igHealth.accountName} (${igHealth.accountId})`}
                {igHealth.status === "expired" && `Token expirado: ${igHealth.error}`}
                {igHealth.status === "missing" && "Token não configurado"}
                {igHealth.status === "error" && `Erro: ${igHealth.error}`}
              </div>
            )}

            <div className="px-5 py-4 space-y-4">
              {keys.map(({ key, label: keyLabel, hint }) => (
                <CredentialField
                  key={`${platform}-${key}`}
                  clientId={clientId}
                  platform={platform}
                  keyName={key}
                  label={keyLabel}
                  hint={hint}
                  savedAt={savedAt(platform, key)}
                  onChanged={async () => {
                    await loadCredentials();
                    if (platform === "INSTAGRAM") {
                      setIgHealth(null);
                      await loadPublishingReadiness();
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
