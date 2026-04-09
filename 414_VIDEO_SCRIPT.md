# IS414 Video Script (Rubric-Aligned)

This script is organized to match the IS414 Security Rubric table in `INTEX W26 Case (1).md`.
Use it as a run-of-show while recording so graders can quickly map each requirement to evidence.

---

## Pre-Recording Checklist (2 minutes)

- Make sure deployed frontend URL and backend URL are ready in browser tabs.
- Have one **admin** and one **donor** account available.
- Open VS Code/Cursor with these files pre-opened:
  - `backend/Program.cs`
  - `backend/Infrastructure/SecurityHeaders.cs`
  - `backend/Controllers/AuthController.cs`
  - `backend/Controllers/DonationsController.cs`
  - `backend/Controllers/ResidentsController.cs`
  - `backend/Controllers/SupportersController.cs`
  - `frontend/src/App.tsx`
  - `frontend/src/components/ProtectedRoute.tsx`
  - `frontend/src/components/ConfirmDeleteDialog.tsx`
  - `frontend/src/pages/PrivacyPolicyPage.tsx`
  - `frontend/src/components/CookieConsentBanner.tsx`
  - `frontend/src/contexts/CookieConsentContext.tsx`
  - `backend/appsettings.Development.json` (to explain local SQLite dev only)
- Have Azure portal open to the SQL resources (or connection settings) for both operational DB and identity DB.

---

## Important Question: Do we need Azure connection strings in `appsettings.json`?

Short answer: **No** (and you should avoid it).

For security grading, it is better to show:
- Production secrets are provided via **Azure App Service Configuration / environment variables**.
- Local dev can still use SQLite via `appsettings.Development.json`.
- Production uses SQL Server provider path in `backend/Program.cs`.

If asked in video, say:
"We intentionally do not commit production connection strings to source control. In Azure, we set them as app configuration values/secrets."

---

## Recording Plan (Rubric Order)

## 1) Confidentiality - Use HTTPS/TLS (1 pt)

### Show
- Browser address bar with deployed site at `https://...` (lock icon visible).

### Say
"Our production site is deployed with HTTPS and a valid TLS certificate."

---

## 2) Confidentiality - Redirect HTTP to HTTPS (0.5 pt)

### Show
- Enter `http://<your-domain>` and show redirect to `https://...`.
- Open `backend/Program.cs` and highlight `app.UseHttpsRedirection();`.

### Say
"HTTP requests are automatically redirected to HTTPS, both in deployment behavior and in middleware configuration."

---

## 3) Auth - Username/password authentication (3 pts)

### Show (UI)
- `Login` page and successful login flow.
- Optional: donor registration flow.

### Show (code)
- `backend/Program.cs`:
  - `AddIdentityApiEndpoints<ApplicationUser>()`
  - `.AddRoles<IdentityRole>()`
  - `MapIdentityApi<ApplicationUser>()`
- `backend/Controllers/AuthController.cs`:
  - `/api/auth/register-with-roles`
  - `/api/auth/me`
  - `/api/auth/logout`

### Say
"Users authenticate with email/password through ASP.NET Identity endpoints and role-backed sessions."

---

## 4) Auth - Better password policy (1 pt)

### Show (code)
- `backend/Program.cs`, `Configure<IdentityOptions>(...)` block.

### Say
"We configured password requirements beyond defaults according to class policy settings."

Note: Be precise to your class's required values when narrating.

---

## 5) Auth - Pages and APIs require auth where needed (1 pt)

### Show (frontend route protection)
- `frontend/src/App.tsx`:
  - public routes (`/`, `/impact`, `/privacy`, `/login`)
  - protected donor route (`/donor-portal`)
  - protected admin route tree (`/admin/*`)
- `frontend/src/components/ProtectedRoute.tsx` logic.

### Show (backend API protection)
- Controller-level/endpoint-level `[Authorize]` usage:
  - `backend/Controllers/ResidentsController.cs`
  - `backend/Controllers/SupportersController.cs`
  - `backend/Controllers/DonationsController.cs`

### Say
"Public users can access public pages only; protected pages and protected APIs require authentication."

---

## 6) Auth - RBAC: admin-only CUD; donor-only donor history (1.5 pts)

### Show (code)
- `backend/Data/AuthPolicies.cs` and `backend/Data/AuthRoles.cs`.
- Admin policy usage:
  - `[Authorize(Policy = AuthPolicies.ManageData)]` on CUD endpoints in residents/supporters/donations controllers.
- Donor/admin usage:
  - `backend/Controllers/DonationsController.cs` endpoint `/api/Donations/my` with donor/admin role.

### Show (UI behavior)
- Donor account can access `/donor-portal` but not `/admin`.
- Admin account can access `/admin` and perform CUD actions.

### Say
"Role-based authorization is enforced in both page routing and API endpoints."

---

## 7) Integrity - Confirmation before delete (1 pt)

### Show (UI)
- Any delete action in admin UI prompts confirmation modal.

### Show (code)
- `frontend/src/components/ConfirmDeleteDialog.tsx`
- Backend delete endpoints requiring `confirm=true`:
  - `backend/Controllers/ResidentsController.cs`
  - `backend/Controllers/SupportersController.cs`
  - `backend/Controllers/DonationsController.cs`

### Say
"Deletes require explicit confirmation in UI and API, preventing accidental destructive actions."

---

## 8) Credentials - Stored securely, not in public repo (1 pt)

### Show
- Azure App Service Configuration (or equivalent secret store) for connection strings/secrets.
- `backend/appsettings.Development.json` to explain local-only SQLite dev settings.
- `backend/Program.cs` environment-based branching:
  - Development -> SQLite
  - Production -> SQL Server connection string from config/environment

### Say
"Production credentials are stored in Azure configuration/secrets, not hardcoded in source code."

Important: If any secrets are currently committed, rotate them and avoid showing them.

---

## 9) Privacy - Privacy policy on site (1 pt)

### Show
- Footer link to privacy policy in UI.
- `frontend/src/pages/PrivacyPolicyPage.tsx`.
- `frontend/src/components/SiteFooter.tsx` link.

### Say
"Our GDPR-tailored privacy policy is publicly available from the site footer."

---

## 10) Privacy - GDPR cookie consent fully functional (1 pt)

### Show
- Cookie banner appears for new session.
- Accept/decline actions.
- Refresh behavior (consent persisted).

### Show (code)
- `frontend/src/components/CookieConsentBanner.tsx`
- `frontend/src/contexts/CookieConsentContext.tsx`

### Say
"Cookie consent is explicitly collected and persisted on the client; users can choose accept or decline."

If partly cosmetic, say that clearly.

---

## 11) Attack Mitigations - CSP header properly set (2 pts)

### Show
- Browser DevTools -> Network -> response headers for backend request showing `Content-Security-Policy`.

### Show (code)
- `backend/Infrastructure/SecurityHeaders.cs` (`Content-Security-Policy` header set).
- `backend/Program.cs` (`app.UseSecurityHeaders();`).

### Say
"CSP is sent as an HTTP response header from backend middleware, along with additional hardening headers."

---

## 12) Availability - Publicly accessible deployment (4 pts)

### Show
- Live frontend URL reachable.
- Live backend endpoint reachable.
- Quick live flow: public page -> login -> protected page.

### Say
"Both application tiers are deployed publicly and accessible in production."

---

## 13) Additional Security Features (2 pts)

You can claim at least these:

1. **Rate limiting** on auth endpoints  
   - File: `backend/Program.cs` (`AddRateLimiter`, `RequireRateLimiting("AuthEndpoints")`)

2. **Additional hardening headers**  
   - File: `backend/Infrastructure/SecurityHeaders.cs`
   - Includes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

3. **Browser-accessible preference cookie**  
   - File: `frontend/src/components/SiteFooter.tsx`
   - Theme preference persisted for frontend behavior

### Say
"Beyond rubric minimums, we added rate limiting, extra security headers, and a browser-accessible preference cookie used by React."

---

## Segment for Azure SQL Databases (your added requirement)

Goal: prove both operational and identity DBs are in Azure DBMS (not SQLite) in production.

### Show
1. `backend/Program.cs`:
   - Production path uses `UseSqlServer(...)` for:
     - `LighthouseDbContext` (operational data)
     - `AuthIdentityDbContext` (identity data)
2. Azure portal:
   - SQL server/database for operational DB.
   - SQL server/database for identity DB (or same server with separate DB/schemas, depending your setup).
3. App Service Configuration:
   - Connection string values present in Azure settings (do not reveal secret text).
4. Optional runtime proof:
   - Live app login + CRUD works in production.
   - Optional query in Azure portal showing new row after action.

### Say
"In production, both our operational and identity data are routed to Azure SQL through environment configuration; SQLite is used only for local development."

---

## 5-Minute Spoken Script (Quick Version)

"This video follows the IS414 rubric in order.  
First, confidentiality: our deployed app is served over HTTPS with a valid certificate, and HTTP redirects to HTTPS. In code, that is enforced with `UseHttpsRedirection` in `Program.cs`.  
Second, authentication: we use ASP.NET Identity with username/password login, role support, and session-based auth endpoints.  
Third, password policy: we configured Identity options in `Program.cs` to enforce our class password rules.  
Fourth, authorization and RBAC: public users can view public pages, donors can access donor features, and admins can access and modify protected operational data. This is enforced in frontend protected routes and backend `[Authorize]` policies and role attributes.  
Fifth, integrity: destructive actions require confirmation in both the UI and API with explicit `confirm=true` checks.  
Sixth, privacy: we provide a GDPR-style privacy policy linked in the footer and a cookie consent mechanism with persisted user choice.  
Seventh, attack mitigation: CSP is sent as an HTTP header, verified in DevTools, and configured in security middleware.  
Eighth, availability: frontend and backend are both publicly deployed and accessible.  
For credentials, production secrets are stored in Azure configuration rather than source code.  
As additional features, we implemented auth rate limiting, extra hardening headers, and a browser-accessible preference cookie.  
Finally, for database security architecture: both identity and operational databases are hosted in Azure SQL in production, while SQLite is only used in local development."

---

## Final Recording Tips

- Keep each rubric item as its own mini chapter.
- Say the rubric label out loud ("This covers Auth - RBAC...").
- Keep proof tight: **UI proof + code proof** for each item.
- Do not expose any actual secret values on screen.
