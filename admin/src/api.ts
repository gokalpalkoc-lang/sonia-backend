import { API_BASE_URL } from "./config";

const ACCESS_KEY = "sonia_access_token";
const REFRESH_KEY = "sonia_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

/** Login: returns { access, refresh } or throws */
export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Giriş başarısız.");
  }
  const data = await res.json();
  saveTokens(data.access, data.refresh);
  return data;
}

/** Get the current user's profile */
export async function fetchProfile() {
  const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Profil alınamadı");
  return res.json();
}

/** Fetch the current user's commands */
export async function fetchCommands() {
  const res = await fetch(`${API_BASE_URL}/api/commands`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Create a new command */
export async function createCommand(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}/api/commands`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Delete a command by assistantId */
export async function deleteCommand(assistantId: string) {
  const res = await fetch(`${API_BASE_URL}/api/commands`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ assistantId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Get last-called date for an assistant */
export async function fetchLastCalled(assistantId: string) {
  const res = await fetch(
    `${API_BASE_URL}/api/commands/last-called/${assistantId}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Send push notification to current user's devices */
export async function sendPushNotification(title: string, body: string) {
  const res = await fetch(`${API_BASE_URL}/api/send-push`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, body, data: { screen: "talk-ai" } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
