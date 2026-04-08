export interface AuthSession {
  isAuthenticated: boolean;
  userName: string | null;
  email: string | null;
  supporterDisplayName?: string | null;
  roles: string[];
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

const normalizeAuthApiBaseUrl = (baseUrl: string) => {
  if (!baseUrl) return "";
  const withoutTrailingSlash = baseUrl.replace(/\/+$/, "");
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
};

const apiBaseUrl = normalizeAuthApiBaseUrl(configuredApiBaseUrl);

async function readApiError(response: Response, fallbackMessage: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallbackMessage;
  const data = await response.json();
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.title === "string") return data.title;
  if (typeof data?.message === "string") return data.message;
  return fallbackMessage;
}

export async function getAuthSession(): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load auth session.");
  return response.json();
}

export async function loginUser(email: string, password: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/auth/login?useCookies=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to log in."));
  }
}

export async function registerUser(payload: {
  email: string;
  password: string;
  displayName?: string;
  roles: string[];
}): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/auth/register-with-roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to register account."));
  }
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Unable to log out."));
  }
}
