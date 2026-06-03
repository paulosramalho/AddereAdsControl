const FEATURES = {
  ESSENCIAL:    new Set(["dashboard", "leads"]),
  PROFISSIONAL: new Set(["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team"]),
  COMPLETO:     new Set(["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team", "publish", "boost", "settings"]),
  AGENCIA:      new Set(["dashboard", "leads", "campaigns", "posts", "suggestions", "calendar", "reports", "team", "publish", "boost", "settings"]),
};

export function planHasFeature(plan, feature) {
  if (!plan) return true;
  return (FEATURES[plan] ?? FEATURES.ESSENCIAL).has(feature);
}

export const PLAN_FEATURES = FEATURES;
