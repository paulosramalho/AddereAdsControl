import { getToken, clearToken, setToken } from "./auth.js";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let refreshing = null;

async function doRefresh() {
  if (refreshing) return refreshing;
  refreshing = fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.json())
    .then((data) => { if (data.token) setToken(data.token); else clearToken(); })
    .catch(() => clearToken())
    .finally(() => { refreshing = null; });
  return refreshing;
}

async function request(path, opts = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: "include" });
  if (res.status === 401 && !opts._retry) {
    await doRefresh();
    return request(path, { ...opts, _retry: true });
  }
  return res;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body: JSON.stringify(body) }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body: JSON.stringify(body) }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" }),
  upload: (path, formData) => {
    const token = getToken();
    return fetch(`${BASE}${path}`, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
  },
};
