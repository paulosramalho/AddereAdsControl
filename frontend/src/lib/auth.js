const KEY = "addere_token";

export function getToken() { return localStorage.getItem(KEY); }
export function setToken(t) { localStorage.setItem(KEY, t); }
export function clearToken() { localStorage.removeItem(KEY); }

export function decodePayload(token) {
  if (!token) return null;
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export function isLoggedIn() {
  const p = decodePayload(getToken());
  return !!p && p.exp * 1000 > Date.now();
}
