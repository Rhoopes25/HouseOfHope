// Dev: use relative "/api" so Vite proxies to the backend (see vite.config.ts).
// Prod: VITE_API_BASE_URL must be defined.
const API_BASE_URL = import.meta.env.DEV
  ? "/api"
  : import.meta.env.VITE_API_BASE_URL;

if (!import.meta.env.DEV && !API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL must be set for production builds.");
}

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
