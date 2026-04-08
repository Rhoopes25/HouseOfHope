# Additional requirements: security, auth, and UX — where to find them

Use this document when recording your walkthrough: for each item, explain **what** it does, **why** it matters for the rubric (security, privacy, or appropriate UX), and **where** it lives in the codebase.

---

## Backend (ASP.NET Core API)

### Security response headers (CSP, clickjacking, MIME sniffing, etc.)

- **File:** `backend/Infrastructure/SecurityHeaders.cs`
- **What:** Adds middleware that sets `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Permissions-Policy` (camera/mic/geo disabled).
- **Why:** Reduces XSS surface, prevents framing the app in malicious pages, and limits referrer leakage.
- **Wired in:** `backend/Program.cs` — `app.UseSecurityHeaders();` (after CORS, before rate limiting / auth pipeline).

### Rate limiting on Identity endpoints

- **File:** `backend/Program.cs`
- **What:** `AddRateLimiter` defines a fixed-window limiter (`AuthEndpoints`: 10 requests per minute, no queue). The `/api/auth` group uses `.RequireRateLimiting("AuthEndpoints")` alongside `MapIdentityApi`.
- **Why:** Slows brute-force login and registration abuse without blocking normal use.

### Cookie authentication (HttpOnly, SameSite, Secure in production)

- **File:** `backend/Program.cs` — `ConfigureApplicationCookie`
- **What:** Cookie is `HttpOnly`, `SameSite=Lax`, `SecurePolicy` is `SameAsRequest` in Development (so login works over `http://localhost`) and `Always` in production.
- **Why:** Mitigates token theft via JS, CSRF in common cases, and enforces HTTPS for cookies when deployed.

### CORS with credentials for the SPA

- **File:** `backend/Program.cs` — `AddCors` policy `Frontend` with explicit origins (e.g. `localhost:3000`, `5173`) and `AllowCredentials()`.
- **Why:** Browser allows the React app to send cookies to the API only from approved origins.

### HTTPS redirection (production only)

- **File:** `backend/Program.cs`
- **What:** `UseHttpsRedirection()` runs when **not** in Development.
- **Why:** Avoids breaking local HTTP dev while still enforcing HTTPS in deployment.

### Identity password policy and lockout

- **File:** `backend/Program.cs` — `Configure<IdentityOptions>`
- **What:** Length **14**; digit/upper/lower/special **not** required; `RequiredUniqueChars = 1`. Lockout: 5 failed attempts, 10-minute lockout.
- **Why:** Aligns with the course pattern (entropy via length); lockout limits password guessing.

### Custom registration with roles

- **File:** `backend/Controllers/AuthController.cs` — `POST register-with-roles`
- **What:** Creates the user, assigns only allowed roles (`Admin` / `Donor`), optionally adds `supporter_display_name` claim, then signs in.
- **Why:** Built-in `/api/auth/register` does not assign your app roles; this endpoint keeps registration and RBAC in one controlled flow.

### Authorization on sensitive APIs

- **Examples:**
  - `backend/Controllers/DonationsController.cs` — `GET /api/donations` and CUD operations use `[Authorize(Policy = ManageData)]` (admin). `GET /api/donations/my` uses `[Authorize(Roles = "Donor,Admin")]` and filters by the current user’s email / display name.
  - `backend/Controllers/ResidentsController.cs`, `SupportersController.cs`, `SocialMediaController.cs`, `AnalyticsController.cs` — admin policy or equivalent as implemented.
- **Why:** Donors only see their own donations on `my`; operational data stays admin-scoped.

### Identity database migrations at startup

- **File:** `backend/Program.cs` — `MigrateAsync` on `AuthIdentityDbContext` before seeding.
- **Why:** Ensures `AspNetRoles` and related tables exist before first login/register.

---

## Frontend (React / Vite)

### Theme preference: light vs warm dark (footer, not navbar)

- **UI:** `frontend/src/components/SiteFooter.tsx` — the shared site footer (same links and copy as the original landing footer) with the button toggling **Light** ↔ **Warm dark**.
- **Cookie + DOM:** `frontend/src/lib/themeCookie.ts` — reads/writes cookie `display_theme` with values `light` or `warm-dark`; sets `document.documentElement` attribute `data-user-theme` (legacy `default` / `ocean` map to `light`).
- **Styles:** `frontend/src/index.css` — `:root[data-user-theme='warm-dark']` overrides CSS variables (warm charcoal background, cream text, muted sage primary — not a cold blue dark theme). Utilities `.gradient-hero` and `.gradient-warm` have warm-dark-specific gradients under the same selector. The footer uses `--site-footer-bg` / `--site-footer-fg` (light mode matches the original `bg-foreground` bar; warm-dark uses a deeper warm band) plus `.site-footer-rule` and `.site-footer-theme-btn` in the `components` layer.
- **Layouts:** `frontend/src/components/PublicLayout.tsx`, `frontend/src/pages/DonorPortal.tsx`, `frontend/src/components/AdminLayout.tsx` — each renders `<SiteFooter />` once at the bottom (no duplicate footer on the home page: `LandingPage` does not render its own footer).
- **Bootstrap on all routes:** `frontend/src/hooks/useThemeCookie.ts` + `frontend/src/App.tsx` — `ThemeBootstrap` applies the saved theme on load so routes without the footer (e.g. 404) still respect the cookie.
- **Navbar:** `frontend/src/components/PublicNavbar.tsx` — theme toggle **removed** from the header for a calmer top bar.

### Auth API usage (cookies)

- **Typical files:** `frontend/src/lib/authAPI.ts`, `frontend/src/contexts/AuthContext.tsx`, and API helpers using `credentials: 'include'`.
- **Why:** Session cookies are sent on API calls so `/api/auth/me` and protected routes work.

### Registration calling `register-with-roles`

- **File:** `frontend/src/pages/RegisterPage.tsx` (and any shared auth helper it calls).
- **Why:** Must hit the custom backend route so selected roles are stored; using only the default Identity register route would skip role assignment.

### Protected routes and roles

- **File:** `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/App.tsx`
- **Why:** Admin and donor areas render only when the session includes the required role(s).

### Dev server port and proxy

- **File:** `frontend/vite.config.ts`
- **What:** Dev server on port 3000 (with proxy to the API as configured).
- **Why:** Matches CORS origins and cookie `SameSite` behavior during development.

---

## Other docs in the repo

- **`AZURE_DB_MIGRATION_CHECKLIST.md`** — moving operational + Identity databases to Azure SQL for deployment.

---

## Quick “video checklist”

1. Show **SiteFooter** on a public page → toggle **Warm dark** → point to **`index.css`** `data-user-theme='warm-dark'` and **`themeCookie.ts`**.
2. Open **Network** → a request to `/api/...` with **cookie** sent; mention **CORS + credentials** in `Program.cs`.
3. Show **`SecurityHeaders`** response headers in DevTools (or describe CSP / `X-Frame-Options`).
4. Mention **rate limit** on `/api/auth` and **lockout** in Identity options.
5. Register with roles → **SQLite** or admin UI → roles present; tie to **`register-with-roles`**.
6. Donor portal → **only my donations** → **`GET /api/donations/my`** in `DonationsController.cs`.
