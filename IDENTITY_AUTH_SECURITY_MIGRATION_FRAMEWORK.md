# Identity, Authorization, and Security Migration Framework (ASP.NET Core API + SPA)

This document captures all meaningful auth/security changes introduced in `RootkitIdentityW26-PostVideos` compared to `RootkitIdentityW26-main`, and translates them into a reusable framework for another domain project.

Use this as a step-by-step implementation guide, not as a copy/paste of rootbeer-specific behavior.

---

## 1) Scope of Comparison

Compared folders:
- Baseline: `RootkitIdentityW26-main/RootkitIdentityW26-main`
- Enhanced: `RootkitIdentityW26-PostVideos/RootkitIdentityW26-PostVideos`

Excluded from analysis:
- `node_modules`, `bin`, `obj`, `.vs`

File-level summary:
- Baseline files: 47
- Enhanced files: 72
- Unchanged: 36
- Changed: 11
- Added: 25
- Removed: 0

Notes:
- Binary SQLite files changed/added (`.sqlite`, `.sqlite-shm`, `.sqlite-wal`) are data artifacts, not source-level feature definitions.
- Transcript was used to confirm intent/order and implementation caveats.

---

## 2) What Was Added (High-Level Feature Set)

The enhanced project adds:
- ASP.NET Core Identity with API endpoints and cookie auth.
- Separate Identity EF Core context and database from app data.
- Role-based authorization with policies (`Admin` and `Customer` roles, admin policy).
- Startup seeding for roles + default admin user.
- Auth/session controller endpoints (`me`, `logout`, external auth support).
- External login (Google) with callback handling.
- Security hardening: cookie settings, HSTS, CSP/security headers middleware.
- Frontend auth state management and auth pages (login/register/logout).
- Frontend role-aware navigation and admin UX route.
- Frontend MFA management UI with QR code/recovery codes.
- Frontend cookie consent banner/context and cookie policy page.

---

## 3) Complete File Delta

### 3.1 Added Files (25)

Backend:
- `backend/RootkitAuth.API/Controllers/AuthController.cs`
- `backend/RootkitAuth.API/Data/ApplicationUser.cs`
- `backend/RootkitAuth.API/Data/AuthIdentityDbContext.cs`
- `backend/RootkitAuth.API/Data/AuthIdentityGenerator.cs`
- `backend/RootkitAuth.API/Data/AuthPolicies.cs`
- `backend/RootkitAuth.API/Data/AuthRoles.cs`
- `backend/RootkitAuth.API/Infrastructure/SecurityHeaders.cs`
- `backend/RootkitAuth.API/Migrations/20260323173923_InitialIdentity.Designer.cs`
- `backend/RootkitAuth.API/Migrations/20260323173923_InitialIdentity.cs`
- `backend/RootkitAuth.API/Migrations/AuthIdentityDbContextModelSnapshot.cs`
- `backend/RootkitAuth.API/RootkitIdentity.sqlite`
- `backend/RootkitAuth.API/RootkitIdentity.sqlite-shm`
- `backend/RootkitAuth.API/RootkitIdentity.sqlite-wal`

Frontend:
- `frontend/src/components/CookieConsentBanner.tsx`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/context/CookieConsentContext.tsx`
- `frontend/src/lib/authAPI.ts`
- `frontend/src/pages/AdminRootbeerPage.tsx`
- `frontend/src/pages/CookiePolicyPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/LogoutPage.tsx`
- `frontend/src/pages/ManageMFAPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/types/AuthSession.ts`
- `frontend/src/types/TwofactorStatus.ts`

### 3.2 Changed Files (11)

Backend:
- `backend/RootkitAuth.API/Controllers/RootbeersController.cs`
- `backend/RootkitAuth.API/Program.cs`
- `backend/RootkitAuth.API/RootkitAuth.API.csproj`
- `backend/RootkitAuth.API/RootkitAuth.sqlite` (data artifact)
- `backend/RootkitAuth.API/appsettings.json`

Frontend:
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/lib/rootbeerApi.ts`

### 3.3 Removed Files

- None

---

## 4) Migration Blueprint (Generalized, Domain-Agnostic)

Apply these phases in order to another ASP.NET Core API + SPA project.

## Phase A: Add Identity Foundation (Backend)

1. Create an app user type:
- Add `ApplicationUser : IdentityUser`.

2. Add dedicated identity DB context:
- `AuthIdentityDbContext : IdentityDbContext<ApplicationUser>`.
- Keep identity data separate from business/app DB context.

3. Register Identity in startup (`Program.cs`):
- Register identity context with a separate connection string.
- Add Identity API endpoint services.
- Enable roles.
- Configure password policy.

4. Middleware and endpoint mapping:
- Ensure `UseAuthentication()` is before `UseAuthorization()`.
- Map identity API endpoints under a dedicated route group (example: `/api/auth`).

5. Add/apply identity migration:
- Generate migration against identity context.
- Apply database update.

Expected result:
- Identity tables exist (`AspNetUsers`, `AspNetRoles`, join/claims tables).

## Phase B: Add Authorization Model (Roles + Policies)

1. Define role constants:
- Example: `Admin`, `Customer` (or your own role set).

2. Define policy constants:
- Example policy: `ManageCatalog` (rename to your domain capability, e.g., `ManageInventory`, `ManageOrders`).

3. Register policies in startup:
- Policy requires one or more roles.

4. Protect sensitive business endpoints:
- Apply `[Authorize(Policy = "...")]` on privileged API actions.
- Keep public endpoints anonymous if desired.

Expected result:
- Role-based access is enforced server-side, independent of client UI.

## Phase C: Seed Roles and Default Admin (Development Bootstrap)

1. Add startup seed utility:
- Ensure role creation is idempotent.
- Ensure default admin user creation is idempotent.
- Assign admin role if missing.

2. Add config keys for bootstrap account:
- Example section: `GenerateDefaultIdentityAdmin` with `Email` and `Password`.

3. Invoke seeding during app startup in a scoped service provider.

Important:
- Treat default admin credentials as dev/bootstrap only.
- Replace with secure provisioning in production.

## Phase D: Harden Auth and Transport Security

1. Configure identity cookie settings:
- `HttpOnly = true`
- `SecurePolicy = Always`
- `SameSite = Lax` (tune for your deployment topology)
- Explicit expiration + sliding expiration

2. Enable HSTS outside development.

3. Add security headers middleware:
- At minimum include CSP baseline:
  - `default-src 'self'`
  - `base-uri 'self'`
  - `frame-ancestors 'none'`
  - `object-src 'none'`
- Consider environment exceptions (for dev tooling like Swagger if needed).

Expected result:
- Improved baseline against XSS/clickjacking/object injection and insecure cookie transport.

## Phase E: Add Auth Session APIs for SPA

In addition to built-in Identity endpoints, add app-specific helper endpoints:

1. Session introspection endpoint:
- `GET /api/auth/me`
- Returns: `isAuthenticated`, user identity fields, roles list.

2. Logout endpoint:
- `POST /api/auth/logout` (server-side sign-out).

3. (Optional but implemented) external-provider endpoints:
- `GET /api/auth/providers`
- `GET /api/auth/external-login`
- `GET /api/auth/external-callback`

Expected result:
- SPA can reliably detect current auth state and roles via a stable contract.

## Phase F: External Login (Google Pattern, Generalizable)

1. Add provider package (Google in source project).
2. Read provider credentials from secure configuration (user-secrets/dev, secret store/prod).
3. Configure provider only when credentials are present.
4. Implement challenge + callback flow:
- Callback handled by backend.
- Backend signs in/links local account.
- Backend redirects SPA with success/failure context.

Common pitfall:
- OAuth redirect URI must exactly match provider registration and backend callback path.

## Phase G: Frontend Auth State and Flows

1. Add typed auth session model.
2. Add auth API client with credentialed fetch:
- Every auth/session request uses `credentials: 'include'` for cookie auth.

3. Add auth context/provider:
- Tracks `session`, `isAuthenticated`, `isLoading`.
- Provides refresh method after login/logout.

4. Add auth pages/routes:
- Register page
- Login page
- Logout page

5. Wire provider at app root and expose routes.

Expected result:
- Persistent server-cookie sessions and reactive SPA auth UI.

## Phase H: Frontend Authorization UX

1. Make navigation role-aware:
- Show/hide admin links based on roles from `session`.

2. Add admin page for protected operations.
3. Call protected backend endpoints with cookies included.
4. Keep backend as source of truth (frontend gating is only UX).

Expected result:
- Users see only relevant actions, but backend still enforces permissions.

## Phase I: MFA (2FA) UX Integration

1. Add typed contract for 2FA status.
2. Add API wrappers for:
- get status
- enable/disable 2FA
- reset recovery codes

3. Add manage-MFA page:
- Show current 2FA state.
- Generate and display QR code from `otpauth://` URI.
- Confirm setup with TOTP code.
- Support recovery code workflows.

4. Extend login flow:
- Accept optional 2FA code and recovery code inputs.

Expected result:
- End users can self-manage authenticator-based MFA.

## Phase J: Cookie Consent and Policy UX for SPA

1. Add cookie consent context/provider.
2. Persist consent acknowledgment in local storage.
3. Add consent banner component mounted app-wide.
4. Add cookie policy page + route + nav link.
5. Document cookie categories used by your app (auth/security vs analytics, etc.).

Expected result:
- Transparent cookie disclosure for cookie-based auth in SPA deployments.

---

## 5) Backend Implementation Matrix (What to Create/Modify)

Create:
- `ApplicationUser` type.
- Identity DB context.
- Role constants file.
- Policy constants file.
- Identity seed generator.
- Security headers middleware/extension.
- Auth controller for session/external helper endpoints.
- Identity migration(s).

Modify:
- `Program.cs`:
  - Identity service registration
  - Auth cookie options
  - External provider setup
  - Policy registration
  - `UseAuthentication()` + `UseAuthorization()`
  - Security middleware (`UseHsts`, custom headers)
  - Identity endpoint mapping
  - startup seeding invocation
- Business controllers:
  - Apply `[Authorize(Policy=...)]` on protected endpoints.
- `appsettings.json`:
  - Identity connection string
  - bootstrap admin config section
- Project file (`.csproj`):
  - required package references
  - user secrets support for local dev

---

## 6) Frontend Implementation Matrix (What to Create/Modify)

Create:
- `authAPI` client module.
- `AuthContext` provider.
- `CookieConsentContext` provider.
- `CookieConsentBanner` component.
- Auth pages: login/register/logout.
- Admin page for protected actions.
- MFA management page.
- Types for auth session + 2FA status.

Modify:
- App root routing/component tree:
  - Wrap providers
  - add auth/admin/mfa/cookie routes
  - mount consent banner globally
- Header/nav:
  - auth session status
  - role-aware links
  - login/logout transitions
- Domain API helper:
  - protected admin calls
  - robust API error parsing
- `package.json`:
  - add QR generation dependency for MFA UI
- styles:
  - banner and auth-related UX styles

---

## 7) API Contract Patterns to Reuse

These patterns are domain-neutral and should be preserved:

- Session:
  - `GET /api/auth/me` -> authenticated flag + identity + roles.

- Logout:
  - `POST /api/auth/logout`.

- Protected business endpoints:
  - Require policy/role on server.
  - Frontend sends credentials for cookie auth.

- External login:
  - Provider discovery endpoint.
  - Challenge endpoint with provider + return path.
  - Callback endpoint that finishes sign-in and redirects SPA.

- MFA:
  - Status endpoint.
  - Enable/disable endpoint(s).
  - Recovery code reset endpoint.
  - Login supports second factor payload.

---

## 8) Transcript-Derived Commands and Configuration (Generalized)

Common commands used in the workflow:
- `dotnet add package Microsoft.AspNetCore.Identity`
- `dotnet add package Microsoft.AspNetCore.Authentication.Google`
- `dotnet ef migrations add <MigrationName> --context <IdentityDbContext>`
- `dotnet ef database update --context <IdentityDbContext>`
- `dotnet user-secrets init`
- `dotnet user-secrets set "Authentication:Google:ClientId" "<id>"`
- `dotnet user-secrets set "Authentication:Google:ClientSecret" "<secret>"`
- `npm install`

Common config practices:
- Keep OAuth secrets out of source control.
- Use cookie auth with `credentials: 'include'` on SPA requests.
- Ensure callback URLs match provider registration exactly.

---

## 9) Verification Checklist (Porting to a New Project)

Backend:
- Identity tables created and populated after registration/login.
- `UseAuthentication()` and `UseAuthorization()` order is correct.
- Role policies block unauthorized users as expected.
- Seed logic is idempotent across restarts.
- CSP/HSTS/cookie options present and environment-aware.
- External provider login round-trip succeeds.

Frontend:
- Auth context correctly reflects login/logout without hard refresh.
- Admin link/page only shown for users with required role.
- Protected API calls succeed only when authorized.
- MFA setup, verification, and recovery flows work.
- Cookie consent banner persists acknowledgment.

Cross-cutting:
- No secrets committed.
- No domain-specific names hardcoded in shared auth components.
- Error responses surfaced clearly in UI and logs.

---

## 10) Porting Template (Quick Action Plan)

1. Add Identity core (user type, identity context, service registration, endpoints, migrations).
2. Add roles/policies and protect high-risk business endpoints.
3. Add startup role/admin seeding for dev bootstrap.
4. Add session/me + logout + optional external auth helper controller.
5. Harden cookie settings + HSTS + CSP middleware.
6. Add frontend auth API + context + auth pages/routes.
7. Add role-aware header/nav and admin UI route.
8. Add MFA manage page and QR-based onboarding.
9. Add cookie consent context/banner/policy page.
10. Run end-to-end tests for authn/authz/security and adjust environment-specific settings.

This sequence matches the discovered progression and dependencies from the compared projects.

