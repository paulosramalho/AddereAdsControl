const KEY = "addere_token";
const LOCK_KEY = "addere_locked";
const LOCK_USER_KEY = "addere_lock_user";

export function getToken() { return localStorage.getItem(KEY); }
export function setToken(t) { localStorage.setItem(KEY, t); }
export function clearToken() { localStorage.removeItem(KEY); }

export function lockScreen(userInfo) {
  if (userInfo) localStorage.setItem(LOCK_USER_KEY, JSON.stringify(userInfo));
  clearToken();
  localStorage.setItem(LOCK_KEY, "1");
}
export function unlockScreen() {
  localStorage.removeItem(LOCK_KEY);
  localStorage.removeItem(LOCK_USER_KEY);
}
export function isLocked() { return !!localStorage.getItem(LOCK_KEY); }
export function getLockUser() {
  try { return JSON.parse(localStorage.getItem(LOCK_USER_KEY)); } catch { return null; }
}

export function decodePayload(token) {
  if (!token) return null;
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json);
  } catch { return null; }
}

export function isLoggedIn() {
  const p = decodePayload(getToken());
  return !!p && p.exp * 1000 > Date.now();
}
