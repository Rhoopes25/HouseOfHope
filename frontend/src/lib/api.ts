// Default to same-origin "/api" in both dev and prod.
// In production, VITE_API_BASE_URL can override this (for separate API hosts).
const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const configuredApiBaseUrl = viteEnv?.VITE_API_BASE_URL?.trim();

const normalizeApiBaseUrl = (baseUrl?: string) => {
  if (!baseUrl) return "/api";
  const withoutTrailingSlash = baseUrl.replace(/\/+$/, "");
  // Ensure the API segment exists even if only host is provided.
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export { API_BASE_URL };
