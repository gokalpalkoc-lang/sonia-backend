import { getAccessToken, refreshAccessToken } from "./storage";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;

/**
 * Fetch wrapper that automatically attaches the JWT access token.
 * On 401 responses it attempts a token refresh and retries once.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });

  // On 401, try refreshing the token and retry once
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      return fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

/**
 * Authenticated multipart/form-data fetch (for file uploads).
 * Does NOT set Content-Type so the browser/RN can set the boundary.
 */
export async function apiFetchForm(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      return fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return response;
}
