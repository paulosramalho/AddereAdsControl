import { Lock } from "lucide-react";
import { decodePayload, getToken } from "../lib/auth.js";

const FEATURES = {
  ESSENCIAL:    ["dashboard", "leads"],
  PROFISSIONAL: ["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team"],
  COMPLETO:     ["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team", "publish", "boost", "settings"],
  AGENCIA:      ["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team", "publish", "boost", "settings"],
};

const FEATURE_MIN_PLAN = {
  campaigns: "PROFISSIONAL", posts: "PROFISSIONAL", suggestions: "PROFISSIONAL",
  calendar: "PROFISSIONAL", reports: "PROFISSIONAL", team: "PROFISSIONAL",
  boost: "COMPLETO", settings: "COMPLETO", publish: "COMPLETO",
};

const PLAN_LABELS = { ESSENCIAL: "Essencial", PROFISSIONAL: "Profissional", COMPLETO: "Completo", AGENCIA: "Agência" };

function planHasFeature(plan, feature) {
  if (!plan) return true;
  return (FEATURES[plan] ?? FEATURES.ESSENCIAL).includes(feature);
}

export function PlanGate({ feature, children }) {
  const payload = decodePayload(getToken());
  const plan = payload?.clientPlan ?? null;

  if (planHasFeature(plan, feature)) return children;

  const minPlan = FEATURE_MIN_PLAN[feature] ?? "PROFISSIONAL";

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-5 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-slate-700/60 border border-slate-600 flex items-center justify-center">
        <Lock size={28} className="text-slate-400" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-white">Recurso não disponível</h2>
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
          Esta funcionalidade está disponível a partir do plano{" "}
          <span className="text-white font-semibold">{PLAN_LABELS[minPlan]}</span>.
          {plan && (
            <>
              {" "}Seu plano atual é{" "}
              <span className="text-slate-300 font-medium">{PLAN_LABELS[plan] ?? plan}</span>.
            </>
          )}
        </p>
      </div>
      <p className="text-slate-500 text-xs">Fale com o suporte da Addere para fazer upgrade.</p>
    </div>
  );
}
