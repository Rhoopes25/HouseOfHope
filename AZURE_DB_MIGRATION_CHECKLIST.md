# Azure DB, merge to `main`, and deployment playbook

This document is for **humans** doing a release and for **AI assistants** resolving merge conflicts when this feature branch is merged into `main`, where **continuous deployment** already publishes the frontend and backend and the **operational (Lighthouse) database is already on Azure SQL**.

---

## Is this branch ready to merge?

Treat merge as ready when all of the following are true:

| Check | Notes |
|--------|--------|
| **Backend builds** | `dotnet build` on the API project succeeds. |
| **Frontend builds** | `npm run build` in `frontend/` succeeds. |
| **No secrets in repo** | Connection strings in committed `appsettings*.json` use placeholders or local SQLite paths only; production secrets live in Azure App Service / pipeline variables. |
| **Identity provider for production** | Today, `Program.cs` registers **Identity with SQLite for every environment**. Before or immediately after merge, production must use **Azure SQL for Identity** (see §7). Do not deploy production with Identity still pointing at a local SQLite path. |
| **CORS matches deployed frontend URL** | `Program.cs` `WithOrigins(...)` includes your real production SPA origin (HTTPS). Merge conflicts often occur here—keep **both** local dev origins and **production** URLs. |
| **Smoke tests pass** | Login, register-with-roles, donor `/api/donations/my`, admin routes, cookie auth over HTTPS in staging. |

If Identity is intentionally still SQLite until the next deploy, merge is still possible, but **track §7 as a blocking follow-up** before production cutover.

---

## What this branch adds (context for merges)

Use this list so conflict resolution keeps **security + auth behavior** intact.

### Backend (`backend/`)

- **ASP.NET Identity** (separate DB + EF migrations under `Migrations/AuthIdentityDb/`).
- **Cookie auth**, `MapIdentityApi<ApplicationUser>()`, roles **Admin** / **Donor**, policy **`ManageData`** (admin).
- **`AuthController`**: `POST /api/auth/register-with-roles` (custom registration + role assignment + sign-in). Do **not** resolve conflicts by removing this route in favor of only the built-in `/register` if the frontend depends on roles.
- **`GET /api/donations/my`**: donor-scoped list (by email / `supporter_display_name` claim)—keep donor behavior; do not restore an “admin sees all” shortcut on this action.
- **`Infrastructure/SecurityHeaders.cs`**: CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. **Keep** `app.UseSecurityHeaders()` in `Program.cs`.
- **Rate limiting** on `/api/auth` (fixed window). **Keep** `AddRateLimiter`, `UseRateLimiter`, and `RequireRateLimiting("AuthEndpoints")` on the Identity map group.
- **Identity options**: password length 14, lockout enabled—align with course/rubric; don’t drop lockout when merging.
- **CORS** with `AllowCredentials()` for the SPA; **cookie** `SecurePolicy` `SameAsRequest` in Development, `Always` in production.
- **`UseHttpsRedirection()`** only when **not** Development (local HTTP dev stays usable).

### Frontend (`frontend/`)

- **Auth**: `credentials: 'include'`, `AuthContext`, protected routes, **`register-with-roles`** registration flow.
- **Vite**: dev server port **3000**, `strictPort`, `/api` **proxy** to backend (e.g. port 4000—confirm `vite.config.ts` matches local API port).
- **UI**: **`SiteFooter`** with theme toggle; **`themeCookie.ts`** + `data-user-theme` (`light` | `warm-dark`); styles in `index.css`. Navbar does **not** host the theme toggle.

### Docs

- **`SECURITY_ADDITIONAL_FEATURES_AND_CHANGES.md`**: rubric-oriented list of security/UX changes and file pointers (for demo video).

---

## Merge conflict guide (for an AI or reviewer)

Resolve conflicts **by capability**, not by blindly choosing “ours” or “theirs.”

### 1. `backend/Program.cs` (high conflict risk)

**Goal:** One pipeline that includes everything below.

- Keep **both** DB registrations: `LighthouseDbContext` (SQLite dev / SQL Server prod) **and** `AuthIdentityDbContext` (see §7 for production provider).
- Preserve **`MigrateAsync`** for the identity context at startup (and app DB migrations if present on `main`).
- Preserve **`UseCors` → `UseSecurityHeaders` → conditional `UseHttpsRedirection` → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization`** order unless `main` has a documented reason to differ.
- **`MapControllers()`** and **`MapGroup("/api/auth").RequireRateLimiting(...).MapIdentityApi<ApplicationUser>()`** must remain.
- **CORS `WithOrigins`**: **Union** origins from both branches: localhost/127.0.0.1 ports **3000** and **5173** for dev, **plus** the production frontend URL(s) from `main` (e.g. `https://<your-app>.azurestaticapps.net` or custom domain).

### 2. `backend/appsettings.json` / `appsettings.Development.json`

- **Merge keys**, not values for secrets: ensure **`ConnectionStrings`** includes `DefaultConnection`, `Lighthouse`, and `IdentityConnection` keys as expected by `Program.cs`.
- **Never** commit real Azure passwords; production uses Azure Portal / Key Vault / pipeline variables.

### 3. `backend/Controllers/*`, `Infrastructure/*`

- Prefer the branch version for **`AuthController`**, **`DonationsController`** (`my` action behavior), and **`SecurityHeaders.cs`** unless `main` has newer bugfixes—then **merge** carefully.

### 4. `frontend/vite.config.ts`

- Keep **port 3000**, **strictPort**, and **`/api` proxy** to the backend port your team uses (align with API launchSettings / README).

### 5. `frontend/src` (auth, layout, footer, theme)

- Keep **`SiteFooter`**, **`lib/themeCookie.ts`**, **`useThemeCookie` bootstrap in `App.tsx`**, and auth/register flow calling **`register-with-roles`**.

### 6. Generated / local artifacts (should not be in Git)

- **`backend/bin/`**, **`backend/obj/`**, **`*.sqlite`** (if accidentally tracked), **`frontend/dist/`**: ensure **`.gitignore`** excludes them; **do not** merge binary build outputs—delete from index if needed.

---

## Azure: operational DB vs Identity DB

| Database | Role | Typical state on `main` |
|----------|------|-------------------------|
| **Lighthouse (app data)** | Residents, donations, supporters, etc. | Often **already on Azure SQL** via `DefaultConnection` in production. |
| **Identity** | Users, roles, claims | This branch defaults to **SQLite file** in repo settings; production should use a **dedicated Azure SQL database** and `IdentityConnection`. |

---

## 7) Identity on Azure SQL (required for production)

Today’s `Program.cs` uses **`UseSqlite`** for `AuthIdentityDbContext` only. For Azure Identity DB, update registration to match Lighthouse pattern, for example:

```csharp
builder.Services.AddDbContext<AuthIdentityDbContext>(options =>
{
    if (builder.Environment.IsDevelopment())
    {
        var identityConnection = builder.Configuration.GetConnectionString("IdentityConnection")
            ?? "Data Source=houseofhope_identity.sqlite";
        options.UseSqlite(identityConnection);
    }
    else
    {
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("IdentityConnection"));
    }
});
```

Then:

1. Set **`IdentityConnection`** in Azure App Service Configuration to the Azure SQL connection string (same pattern as `DefaultConnection`).
2. Run **EF migrations** for `AuthIdentityDbContext` against that database (see `Migrations/AuthIdentityDb/`).
3. Redeploy; verify **`MigrateAsync`** creates tables on first run, or run `dotnet ef database update` from a secure migration runner.

---

## 8) Provisioning checklist (if not already done)

- Azure SQL Server + database for **app** data (`DefaultConnection`).
- Optional **second database** for **Identity** (`IdentityConnection`), or separate server—team choice.
- Firewall: allow Azure services and/or your App Service outbound IP.
- **No passwords in Git**; use App Service **Connection strings** or Key Vault references.

---

## 9) Connection strings in Azure (deployment)

| Name | Typical use |
|------|-------------|
| `DefaultConnection` | Lighthouse / operational SQL (already on Azure on `main`). |
| `IdentityConnection` | Identity SQL after cutover (§7). |
| `Lighthouse` | Dev-only SQLite path in Development—omit or ignore in production. |

---

## 10) Smoke tests after merge / deploy

- Register with **Donor** (and optionally **Admin**) via **`/api/auth/register-with-roles`**; confirm roles in Identity DB.
- Login; cookie set; **`/api/auth/me`** returns user + roles.
- Donor: **`/api/donations/my`** only returns that donor’s rows.
- Admin: CUD on protected resources still enforced.
- **Rate limit**: burst `/api/auth` and expect **429** after threshold.
- **HTTPS** production: cookie **Secure**; SPA and API **same-site** policy respected.
- **Footer**: theme toggle persists (`display_theme` cookie) across refresh.

---

## 11) Video / rubric evidence (optional)

- Show Azure Portal connection strings **names** (blur values).
- Show Identity tables in Azure SQL (not a local `.sqlite` file) after cutover.
- Show security headers in DevTools for an API response.
- Reference **`SECURITY_ADDITIONAL_FEATURES_AND_CHANGES.md`** for file-level talking points.

---

## Quick “AI merge” summary

1. **Union** `Program.cs`: auth + security + rate limit + CORS **including production SPA origin**.  
2. **Implement §7** before production if Identity is still SQLite-only in the merged file.  
3. **Preserve** `register-with-roles`, donor `my` donations, security headers, and footer/theme files.  
4. **Strip** build artifacts and secrets from commits; **configure** secrets only in Azure/CD.
