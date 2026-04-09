# IS414 Video Script (Rubric-Aligned, Azure-Hosted Proof Only)

This document matches the **IS414 Security Rubric** in `INTEX W26 Case (1).md`.  
**Grading rule:** If it is not shown on the **deployed Azure** site/API, treat it as not demonstrated. **Do not use localhost as proof**—use your production URLs only.

---

## Your production URLs (fill in / verify before recording)

| Layer | Example in repo | You confirm |
|--------|-----------------|-------------|
| **Frontend (Azure Static Web Apps)** | `https://polite-bush-0e7f0950f.1.azurestaticapps.net` (also allowed in `backend/Program.cs` CORS) | `___________________________` |
| **Backend (Azure App Service)** | `https://houseofhope-backend-gheuhcbwbba2bhbb.eastus-01.azurewebsites.net` (`frontend/.env.production` → `VITE_API_BASE_URL`) | `___________________________` |

The SPA calls the API via `VITE_API_BASE_URL` (`frontend/.env.production`, `frontend/src/lib/api.ts`, `frontend/src/lib/authAPI.ts`). All login and API traffic in the video should visibly target the **azurewebsites.net** host (Network tab).

---

## Rubric quick map (Azure proof → code location)

| Rubric item | Points | Prove on Azure (not localhost) | Code / config to open on camera |
|-------------|--------|----------------------------------|----------------------------------|
| HTTPS/TLS | 1 | Open **frontend** URL with `https://`; show valid lock / certificate | `backend/Program.cs` (prod cookie `Secure`, CORS HTTPS) |
| HTTP → HTTPS redirect | 0.5 | Type **`http://`** + your frontend domain; show redirect to `https://` | `backend/Program.cs` → `UseHttpsRedirection()` (non-Development) |
| **HSTS** (additional / IS414 list) | — | API response on **`https://…azurewebsites.net`**: header **`Strict-Transport-Security`** | `Program.cs` → `AddHsts` + `UseHsts()` (non-Development) |
| Username/password auth | 3 | On **deployed** site: **Login** → session works; optional **Register** | `Program.cs` Identity + `MapIdentityApi`; `AuthController.cs` (`/api/auth/me`, register, logout) |
| Better passwords | 1 | Show **register** or password change failing/succeeding per rules **against live API** | `Program.cs` → `Configure<IdentityOptions>` |
| Auth on pages & APIs | 1 | **Unauthenticated:** try `/admin` or hit protected API → blocked. **Authenticated:** donor/admin flows work | `App.tsx`, `ProtectedRoute.tsx`; controllers with `[Authorize]` |
| RBAC (admin CUD, donor history) | 1.5 | **Donor:** `/donor-portal` + history; **cannot** open admin. **Admin:** `/admin` + CUD | `AuthPolicies.cs`, `AuthRoles.cs`; `ResidentsController`, `SupportersController`, `DonationsController` |
| Delete confirmation | 1 | On **deployed** admin UI: delete → modal; optional DevTools DELETE with/without `confirm` | `ConfirmDeleteDialog.tsx`; delete actions in `*Controller.cs` (`confirm=true`) |
| Credentials secure | 1 | **Azure Portal:** App Service **Configuration** / connection strings (blur values). **Repo:** `appsettings.json` has **no** production secrets | `appsettings.json` (placeholders only); `Program.cs` `else` branch `UseSqlServer` + `GetConnectionString("DefaultConnection")` |
| Privacy policy | 1 | **Deployed** site: footer → **Privacy** page | `PrivacyPolicyPage.tsx`, `SiteFooter.tsx` |
| GDPR cookie consent | 1 | **Deployed** site: banner; Accept/Decline; refresh shows persistence | `CookieConsentBanner.tsx`, `CookieConsentContext.tsx` |
| CSP header | 2 | **Network** tab: request to **`https://…azurewebsites.net/...`** → Response Headers → `Content-Security-Policy` | `Infrastructure/SecurityHeaders.cs`, `Program.cs` `UseSecurityHeaders()` |
| Availability | 4 | Both **Azure** frontend + backend load; short happy path on production | `.github/workflows/*` optional mention |
| **Additional** features | 2 | Pick what you actually implemented (see section below) | See “Additional security features” |

---

## Pre-recording checklist

- [ ] Browser: **only** tabs using your **Azure Static Web Apps** and **Azure App Service** URLs.
- [ ] Incognito (or clear site data) ready for cookie-consent first visit.
- [ ] Admin and donor credentials for **production** (as submitted to faculty).
- [ ] Azure Portal: **App Service** → Configuration (connection strings / app settings—**do not** read secrets aloud).
- [ ] Azure Portal: **Azure SQL** (logical server + database(s)) showing hosted data—operational + identity storage.
- [ ] VS Code: files listed in the table above open for side-by-side “where in code” segments.

**Rule:** When you say “here it works,” the address bar and Network tab must show **azurestaticapps.net** / **azurewebsites.net**, not `localhost`.

---

## 1) Confidentiality — HTTPS/TLS (1 pt)

### Azure proof

- Navigate to `https://<your-static-web-app>.azurestaticapps.net` (or your custom domain on Azure).
- Show browser **lock** / certificate valid for that host.

### Code (narrate)

- `backend/Program.cs`: in **non-Development**, `CookieSecurePolicy.Always` and `SameSiteMode.None` so auth cookies are only sent over **HTTPS** in production.

### Say

“Our public site is served over HTTPS with a valid certificate from Azure; production auth cookies require Secure transport.”

---

## 2) Confidentiality — HTTP redirects to HTTPS (0.5 pt)

### Azure proof

- In the address bar, go to **`http://<same-frontend-host>`** (not https).
- Show the browser ending on **`https://`** (redirect).

**Note:** Redirect may be enforced at **Azure Front Door / Static Web Apps / App Service** edge as well as app middleware.

### Code

- `backend/Program.cs`: `if (!app.Environment.IsDevelopment()) { app.UseHttpsRedirection(); }`

### Say

“HTTP is redirected to HTTPS; the API is configured to use HTTPS redirection in production.”

---

## 2b) HSTS — HTTP Strict Transport Security (IS414 additional feature)

Browsers that receive this header remember to use **HTTPS only** for the host for `max-age` seconds.

### Azure proof

- DevTools → **Network** → pick any **`200`** response from **`https://<backend>.azurewebsites.net`** (e.g. `GET /api/auth/me` or `OPTIONS` preflight).
- **Response Headers** → show **`Strict-Transport-Security`** (e.g. `max-age=31536000` for 365 days).

**Note:** The **API** (App Service) emits this header from Kestrel. Azure Static Web Apps may add its own HSTS at the edge for the **frontend** host; both are valid to mention.

### Code

- `backend/Program.cs`:
  - `builder.Services.AddHsts(options => { ... MaxAge = 365 days; IncludeSubDomains = false; Preload = false; })`
  - Inside production middleware: `app.UseHsts()` **before** `app.UseHttpsRedirection()`.

### Say

“We enable HSTS in production so compliant browsers cache HTTPS-only for our API host; we use a one-year max-age and do not enable preload to avoid accidental lock-in while the domain setup is stable.”

---

## 3) Auth — Username/password (3 pts)

### Azure proof

- On **deployed** frontend, open **Login** (`/login`).
- Sign in; show **Network** requests to `https://<backend>.azurewebsites.net/api/auth/login?...` and subsequent authenticated calls with cookies.
- Optional: **Register** on production (`/register`) if enabled.

### Code

- `backend/Program.cs`: `AddIdentityApiEndpoints<ApplicationUser>()`, `AddRoles`, `AddEntityFrameworkStores`, `MapGroup("/api/auth").MapIdentityApi<ApplicationUser>()`.
- `backend/Controllers/AuthController.cs`: `/api/auth/me`, `/api/auth/logout`, `/api/auth/register-with-roles`, profile routes.

### Say

“Authentication uses ASP.NET Identity with email and password; the hosted SPA talks to the hosted API with credential cookies.”

---

## 4) Auth — Better password policy (1 pt)

### Azure proof

- On **deployed** site, attempt registration (or password change) with a password that **fails** policy, then one that **passes**—errors must come from **live** API.

### Code

- `backend/Program.cs` → `Configure<IdentityOptions>`: `RequiredLength`, complexity flags, lockout settings.

### Say

“We strengthened passwords versus Identity defaults per our course requirements; enforcement happens server-side on every request.”

---

## 5) Auth — Pages and APIs require auth where needed (1 pt)

### Azure proof

- **While logged out** on **deployed** site:
  - Manually open `/admin` or `/donor-portal` → should redirect or show unauthorized.
- **Optional API proof:** In DevTools, copy a `fetch` to e.g. `GET https://<backend>.azurewebsites.net/api/Residents` **without** session cookie → **401/403**.

### Code

- `frontend/src/App.tsx`: public routes vs `ProtectedRoute` for donor/admin.
- `frontend/src/components/ProtectedRoute.tsx`.
- `backend/Controllers/ResidentsController.cs`: class-level `[Authorize(Policy = AuthPolicies.ManageData)]`.
- `DonationsController.cs`, `SupportersController.cs`: `[Authorize]` on sensitive verbs.
- `AuthController.cs`: `/api/auth/me` allows anonymous when not signed in (returns `isAuthenticated: false`).

### Say

“Public visitors only see public routes; CRUD and staff data require authentication, enforced in both the React router and the API.”

---

## 6) Auth — RBAC: admin CUD, donor history (1.5 pts)

### Azure proof

- **Donor account** on **deployed** site: open `/donor-portal`, view **My donations** (data from Azure DB).
- Same session: try `/admin` → **blocked**.
- **Admin account:** open `/admin`, perform a safe CUD (e.g. edit donor or add a test record) to show write access.

### Code

- `backend/Data/AuthPolicies.cs` — `ManageData` policy.
- `backend/Data/AuthRoles.cs` — role names.
- `Program.cs` — `RequireRole(AuthRoles.Admin)` for `ManageData`.
- `DonationsController.cs` — `GET .../my` with `[Authorize(Roles = Donor, Admin)]`.
- Admin-only CUD: `ResidentsController`, `SupportersController`, `DonationsController` admin endpoints.

### Say

“Only admins can manage operational data through the API; donors only see their own contribution history plus public pages.”

---

## 7) Integrity — Confirmation before delete (1 pt)

### Azure proof

- Logged in as **admin** on **deployed** site, trigger **Delete** on a donor or donation (or similar).
- Show **confirmation modal** before the request fires.
- (Optional) Mention API requires `?confirm=true` on DELETE.

### Code

- `frontend/src/components/ConfirmDeleteDialog.tsx` and pages that use it (e.g. `DonorsContributions.tsx`).
- `ResidentsController.cs` / `SupportersController.cs` / `DonationsController.cs` — `Delete` actions check `confirm`.

### Say

“Destructive actions require explicit user confirmation in the UI and a confirm flag on the server.”

---

## 8) Credentials — Stored securely, not in public repo (1 pt)

### Azure proof

- **Azure Portal** → App Service → **Configuration**: show **Connection strings** / **Application settings** **names** only (e.g. `DefaultConnection`)—**mask or blur values** on screen.
- **GitHub / local repo** on camera: open `backend/appsettings.json` and show it contains **only** non-secret placeholders (e.g. local SQLite file names for dev keys) and **no** Azure SQL password.

### Code

- `backend/Program.cs`: **Production** uses `UseSqlServer` + `GetConnectionString("DefaultConnection")` for both `LighthouseDbContext` and `AuthIdentityDbContext`.
- Identity in prod uses the **same configuration key** as operational DB in this codebase (both SQL Server in Azure); migration history tables are separated via `EfMigrationHistory`.

### Say

“Production connection strings and secrets live in Azure App Service configuration, not in the repository.”

---

## 9) Privacy — Privacy policy on site (1 pt)

### Azure proof

- On **deployed** frontend, scroll to footer → **Privacy Policy** → full page loads.

### Code

- `frontend/src/pages/PrivacyPolicyPage.tsx`
- `frontend/src/components/SiteFooter.tsx` (link to `/privacy`)

### Say

“Our GDPR-oriented privacy policy is linked from the footer on the live site.”

---

## 10) Privacy — GDPR cookie consent (1 pt)

### Azure proof

- **New session** (incognito) on **deployed** URL → banner appears.
- Click **Accept** or **Decline**, reload → choice **persists** (localStorage key in code).

### Code

- `frontend/src/components/CookieConsentBanner.tsx`
- `frontend/src/contexts/CookieConsentContext.tsx`

### Say

“We collect consent before treating analytics or preference storage as optional; users can accept or decline.”

**If** non-essential cookies are not gated: say honestly: “Banner records preference; essential auth cookies still apply for logged-in users.”

---

## 11) Attack mitigations — CSP HTTP header (2 pts)

### Azure proof

- Open DevTools → **Network**.
- Select a response from **`https://<backend>.azurewebsites.net`** (e.g. `GET /api/auth/me` or any API call after CORS).
- **Response Headers** → show **`Content-Security-Policy`** (must be a **header**, not a `<meta>` tag—rubric).

### Code

- `backend/Infrastructure/SecurityHeaders.cs` — CSP string + other headers.
- `backend/Program.cs` — `app.UseSecurityHeaders();`

### Say

“CSP is emitted as an HTTP response header from our hosted API middleware.”

---

## 12) Availability — Publicly deployed (4 pts)

### Azure proof

- Load **frontend** URL (Azure Static Web Apps).
- Show **backend** health or any `200` from `https://<backend>.azurewebsites.net/...`.
- Short flow: **Impact** or **Home** → **Login** → **Donor portal** or **Admin** (all on production).

### Code (optional mention)

- `frontend/.env.production` — `VITE_API_BASE_URL` pointing at Azure App Service.
- `.github/workflows/` — CI/CD to Azure (if you want to mention automation).

### Say

“Frontend and API are both publicly reachable on Azure.”

---

## 13) Additional security features (2 pts) — claim only what you ship

Use this list against **hosted** behavior + code.

| Feature | Azure / demo | Code |
|--------|--------------|------|
| **Rate limiting** on auth routes | Many rapid login attempts → **429** from **azurewebsites.net** `/api/auth/...` | `Program.cs` — `AddRateLimiter`, `RequireRateLimiting("AuthEndpoints")` |
| **HSTS** | **`Strict-Transport-Security`** on hosted **API** responses | `Program.cs` — `AddHsts`, `UseHsts()` (with `UseHttpsRedirection`) |
| **Extra security headers** | Same API response headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | `SecurityHeaders.cs` |
| **Production cookie hardening** | Session only works on HTTPS cross-site SPA | `Program.cs` — `SameSite=None`, `SecurePolicy.Always` when not Development |
| **CORS restricted** | Only approved origins (e.g. `*.azurestaticapps.net`) can call API with credentials | `Program.cs` — `AddCors`, `SetIsOriginAllowed` |
| **Operational + identity DB on Azure SQL** | Portal + live CRUD/login | `Program.cs` — both contexts `UseSqlServer` + `DefaultConnection` in production |
| **Browser-accessible preference (non-HttpOnly)** | Theme toggle on **deployed** site persists | `SiteFooter.tsx`, `lib/themeCookie.ts` |

**Not in current main codebase (do not claim unless you added it):** third-party OAuth, MFA UI, Docker deploy.

---

## Hosted databases — operational + identity on Azure SQL

### Azure proof

1. **Azure Portal** → **SQL databases** (or elastic pool): show the database(s) your team uses for this app.
2. **App Service** → Configuration: show **`DefaultConnection`** (name only, value hidden)—this is what production uses.
3. **Runtime:** On **deployed** app, **log in** (identity tables on Azure) and **load or change** operational data (e.g. residents list)—both prove live DB on Azure.

### Code

- `backend/Program.cs`:
  - `else` (non-Development): `LighthouseDbContext` → `UseSqlServer(..., DefaultConnection)` with `EfMigrationHistory.LighthouseTable`.
  - `else`: `AuthIdentityDbContext` → `UseSqlServer(..., DefaultConnection)` with `EfMigrationHistory.IdentityTable`.

### Say

“In production, both the Lighthouse operational schema and ASP.NET Identity use SQL Server via the configured Azure connection string; SQLite branches apply only when `Development` is true locally.”

---

## One-take spoken script (~4–6 minutes, Azure only)

“IS414 security, demonstrated only on our **Azure-hosted** frontend and API.

**HTTPS:** Here is our live site on HTTPS with a valid certificate.

**Redirect:** I open the same host with `http://` and it redirects to HTTPS.

**Authentication:** I log in on the **production** site; Network shows the call to our **azurewebsites.net** API and the session cookie behavior.

**Password policy:** Registration or password change on production is rejected unless it meets our configured rules—enforced in `IdentityOptions` in `Program.cs`.

**Authorization:** Logged out, I cannot use staff routes; the API returns unauthorized without a session. Logged in as donor versus admin, access matches roles—donor history only for donors, CUD only for admins—see `AuthPolicies`, `AuthRoles`, and controller attributes.

**Integrity:** Deleting on production requires confirmation in the UI and server-side confirm on delete endpoints.

**Credentials:** In Azure Portal, connection strings are configured on the App Service; our committed `appsettings.json` does not contain production secrets.

**Privacy:** On the live site, the footer links to our privacy policy.

**Cookie consent:** First visit shows the banner; accept or decline persists.

**CSP:** On a response from our **hosted API**, Response Headers include `Content-Security-Policy` from `SecurityHeaders` middleware.

**HSTS:** The same API responses include `Strict-Transport-Security` from `UseHsts` in `Program.cs` in production.

**Availability:** Frontend on Azure Static Web Apps and API on Azure App Service are both public.

**Additional:** We use rate limiting on identity endpoints, HSTS, extra security headers, strict production cookie settings, locked-down CORS, a theme preference cookie, and both operational and identity data on **Azure SQL** in production.”

---

## Final tips

- Say the **rubric label** before each segment.
- Keep **address bar** and **Network → Request URL** visible whenever you claim “this works.”
- **Never** paste connection strings or passwords on screen.
- If something works locally but not in Azure, **fix Azure first**—graders grade what the video shows.
