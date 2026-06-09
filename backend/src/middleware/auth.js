import jwt from "jsonwebtoken";
import { planHasFeature } from "../lib/planFeatures.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, clientId: payload.clientId ?? null, role: payload.role, clientPlan: payload.clientPlan ?? null };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function requireFeature(feature) {
  return (req, res, next) => {
    if (planHasFeature(req.user?.clientPlan, feature)) return next();
    res.status(403).json({ message: "Recurso não disponível no plano atual", feature, plan: req.user?.clientPlan });
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    next();
  };
}

export const requireSuperAdmin = requireRole("SUPER_ADMIN");
export const requireAdminOrSuper = requireRole("ADMIN", "SUPER_ADMIN");

export function requireSameClient(req, res, next) {
  if (req.user?.role === "SUPER_ADMIN") return next();
  if (req.user?.clientId !== req.params.clientId) {
    return res.status(403).json({ message: "Acesso negado" });
  }
  next();
}
