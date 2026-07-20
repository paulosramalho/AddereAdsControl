import { decrypt } from "./crypto.js";

const SENSITIVE_KEYS = new Set([
  "access_token",
  "api_key",
  "client_secret",
  "developer_token",
  "private_key",
  "refresh_token",
  "secret",
  "token",
  "youtube_api_key",
]);

export function isSensitiveCredentialKey(key) {
  const normalized = String(key ?? "").toLowerCase();
  if (SENSITIVE_KEYS.has(normalized)) return true;
  if (normalized.includes("password")) return true;
  if (normalized.includes("private_key")) return true;
  if (normalized.includes("secret")) return true;
  if (normalized.endsWith("_token") && !normalized.startsWith("notify_")) return true;
  return false;
}

export function toPublicCredential(credential) {
  const { value, ...safeCredential } = credential;
  const isSensitive = isSensitiveCredentialKey(credential.key);
  let displayValue = null;

  if (!isSensitive) {
    try {
      displayValue = decrypt(value);
    } catch {
      displayValue = null;
    }
  }

  return {
    ...safeCredential,
    isSensitive,
    displayValue,
  };
}
