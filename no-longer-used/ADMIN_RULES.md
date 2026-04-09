# ADMIN_RULES

## 1) Source Authority
- IS413 requirements are authoritative for admin portal behavior.
- These rules are binding for admin pages and related admin APIs.
- If implementation differs from these rules, the rules win.

## 2) Scope
- In scope: IS413 admin/staff pages only:
  - Admin Dashboard
  - Donors & Contributions
  - Caseload Inventory
  - Process Recording
  - Home Visitation & Case Conferences
- Out of scope: public/donor page redesign, except parity work required for donation consistency.
- Reports & Analytics implementation is deferred for now because this page will be fulfilled through ML integration work.

## 3) Terminology Rule
- Use `donor` in all admin UI labels, buttons, filters, helper text, and docs.
- Legacy backend/table/entity names may remain unchanged unless explicitly migrated.

## 4) Per-Page Rules (Display + Admin Actions)
### 4.1 Admin Dashboard
- **Displays:**
  - Active residents across safehouses
  - High/critical risk residents
  - Donations this month
  - Upcoming case conferences
  - Summarized education/health progress trends
- **Admin actions (CRUD):**
  - Read-only command center
  - Must link to pages where create/update/delete actions are performed
- **Implementation notes:**
  - Metrics are loaded from `GET /api/Analytics/dashboard` (high-risk list, monthly donation total, education/health trend series, upcoming conferences from intervention plans) plus `GET /api/Residents` for active counts by safehouse.
  - Reports & Analytics and Social media routes may remain ML placeholders; the dashboard itself is not a placeholder.
  - In the admin UI, safehouse labels derived from seed data may show as **House 1**, **House 2**, etc., while persisted values remain the canonical safehouse names from the API.

### 4.2 Donors & Contributions
- **Displays:**
  - Donor list with type/status/search/filter
  - Donation history by donor
  - Donation details (type/date/value/campaign/notes)
  - Allocation visibility by safehouse/program area
- **Admin actions (CRUD):**
  - Donor: create, read, update, delete
  - Donation/contribution: create, read, update, delete
- **Filtering/search hard requirements:**
  - Text search by donor display name (minimum)
  - Filter by donor type
  - Filter by donor status
  - Donation list filtering by donation type and date range

### 4.3 Caseload Inventory
- **Displays:**
  - Resident list with required filters/search (status, safehouse, case category, etc.)
  - Resident full case profile including demographics and intake/case context
- **Admin actions (CRUD):**
  - Resident: create, read, update, delete
  - Edit form must expose all required resident details needed to match prebuilt records
- **Filtering/search hard requirements:**
  - Search by case control number and internal code
  - Filter by case status
  - Filter by safehouse
  - Filter by case category
  - Filter by risk level
  - Optional combined filtering must be supported (filters can stack)

### 4.4 Process Recording
- **Displays:**
  - Chronological process recording entries per resident
  - Session metadata and narrative details
- **Admin actions (CRUD):**
  - Process recording entry: create, read, update, delete
- **Filtering/search hard requirements:**
  - Filter entries by resident
  - Filter by date range
  - Filter by session type
  - Sort chronologically with newest-first default

### 4.5 Home Visitation & Case Conferences
- **Displays:**
  - Home visitation history per resident
  - Case conference history and upcoming conferences
- **Admin actions (CRUD):**
  - Home visitation entry: create, read, update, delete
  - Case conference-linked records (via intervention plan workflow): create, read, update, delete
- **Filtering/search hard requirements:**
  - Filter by resident
  - Filter by visit type
  - Filter by date range
  - Filter by follow-up-needed/safety-concern flags
  - Separate views for history vs upcoming conferences

### 4.6 Reports & Analytics
- **Displays:**
  - Donation trends
  - Resident outcome metrics
  - Safehouse comparisons
  - Reintegration success rates
- **Admin actions (CRUD):**
  - Read-only analytics/reporting surface
  - No direct create/update/delete on this page
- **Current phase rule:**
  - Reports/Analytics page implementation is deferred in this admin build phase.
  - Placeholder route/page is acceptable temporarily if navigation requires it.
  - Full feature completion for this page is tracked under ML integration scope.

## 5) Form Standard (Global)
- Any categorical/repeatable create/edit field uses a dropdown.
- Dropdown options must be:
  - sourced from existing values and/or fixed domain values,
  - deduplicated,
  - alphabetized case-insensitively.
- Every eligible dropdown must include an `Add new` path.
- New values must be validated/sanitized, persisted, and reinserted in sorted order.
- Fixed case-required enums remain fixed unless explicit business approval allows extension.
- Create and edit forms must support complete field coverage for the record type (no hidden/non-editable required details).
- For records with extensive detail (for example resident demographics and case profile), forms may be sectioned, but every persisted field must be viewable and editable by admin unless explicitly restricted by security policy.

## 5.1 Full Detail Editing Rule
- If a detail exists in prebuilt records and is in scope for admin management, admin must be able to edit it.
- Resident forms must include demographic and related case-profile fields, not only a simplified subset.
- If any field is intentionally omitted from UI, it must be documented in this file with a reason; otherwise omission is considered non-compliant.

## 5.2 Modal/Dialog Layout and Responsiveness Rule
- No edit/create dialog may hide fields due to viewport size.
- Every dialog that can exceed viewport height must:
  - have internal vertical scrolling,
  - set a max height relative to viewport,
  - keep primary actions reachable.
- Dialog width should be large enough for complex forms on desktop, while still adapting to smaller screens.
- On mobile, forms must remain fully operable with responsive layout (single-column fallback where needed).
- If dialog UX cannot reliably expose all fields, the form must move to a dedicated full page.

## 5.3 Edit Context Persistence Rule
- When the admin opens **edit** for a record, the UI must keep that record in focus for the whole edit session.
- The admin must be able to change **any** in-scope field or section for that same record (demographics, related lists, nested items) **without** closing and reopening edit for each part.
- Prefer a **single persistent surface** for that entity: dedicated detail page, slide-over with stable route, or one modal that stays open with **tabs/sections** for all field groups—not a chain of separate dialogs that drop context.
- Saving one section must not navigate away or clear selection unless the user explicitly cancels or navigates elsewhere.
- Nested CRUD (for example donations under a donor, sessions under a resident) must remain reachable from the same parent record context without losing the parent selection.

### 5.4 Admin table pagination (default page size)
- Paginated admin data tables use `usePagination` and `PaginationControl` from `@/components/PaginationControl`.
- **Default initial page size is 25 rows** (`DEFAULT_PAGE_SIZE`). Do not pass a smaller second argument to `usePagination` unless there is a documented exception in this file.
- The per-page dropdown must offer the shared option set `PAGE_SIZE_OPTIONS` (`5, 10, 15, 25, 50, 100`) and wire `onPageSizeChange` to `setPageSize` from the hook.
- New admin list pages that add pagination must follow the same pattern so behavior stays consistent across Caseload, Donors, resident nested lists, Process recording, and future screens.
- Primary data tables use `className="table-striped"` on `Table` (even rows use `bg-muted/40` via `index.css`) for scanability; filter controls stay **outside** that bordered table shell—filters use a plain flex row (search + selects + dates), matching Caseload / Donors / Process recording / Field ops.

## 6) Donation Entry Parity (Donor Portal vs Admin)
- Same intent must produce equivalent persisted donation semantics.

### 6.1 Type Mapping
- Canonical types:
  - `Monetary`
  - `InKind`
  - `Time`
  - `Skills`
  - `SocialMedia`
- No divergent casing/labels/mapping logic between donor and admin flows.

### 6.2 Required Core Fields
- `donationDate` required in both flows (`yyyy-mm-dd`).
- Required-value behavior by type must match in both flows.

### 6.3 Value Semantics
- Monetary: persist `amount` in PHP.
- Non-monetary (`InKind`, `Time`, `Skills`, `SocialMedia`): persist `estimatedValue`.
- `Time` keeps hour semantics in current model.
- Contradictory payloads are rejected (for example, missing required value field).

### 6.4 Currency Handling
- Canonical persisted currency is PHP for parity.
- If non-PHP input is offered in admin, conversion rules must match donor portal conversion.
- If admin is PHP-only input, UI must clearly state parity behavior with donor flow storage.

### 6.5 Campaign and Notes
- `campaignName` and `notes` are optional in both flows.
- Normalization must match:
  - trim whitespace,
  - empty values normalize consistently (for example, null/undefined policy).
- Fallback/default campaign policy must be shared across both flows.

### 6.6 Identity Binding
- Donor portal binds by logged-in donor identity.
- Admin binds by selected donor record.
- Both must resolve to the same donor entity model for consistent history/reporting.
- Admin donor selector options must be alphabetized.

## 7) Security and RBAC
- Admin CUD operations require admin authorization policy.
- Donor-specific views/actions are donor/admin only.
- Auth bootstrap endpoints remain accessible as required (`/auth/*` session/login paths).
- Delete operations require an explicit confirmation window (modal/dialog) before any delete request is submitted.
- No delete action may execute from a single click without confirmation.

## 8) Data Quality and UX Consistency
- Enforce stable mapping and normalization rules across forms and pages.
- Use consistent empty/loading/error states with actionable recovery.
- Ensure round-trip consistency for type labels, values, campaign, and notes in list/history views.
- The API client must treat successful responses with **no body** (for example HTTP 204 on `PUT`/`DELETE`) as success and must not parse them as JSON (avoids false error toasts after a successful save).
- **Sortable admin tables:** On admin data tables, clicking a **column header** sorts by that column: the **first** click applies **ascending** order; clicking the **same** header again toggles **descending**. Clicking a **different** column starts again at **ascending** for that column. Headers that are action-only (for example **Actions**, icon-only toolbars) are not sort controls and stay plain text.
- **Paginated admin tables:** Follow `5.4` (default **25** rows per page, shared `PAGE_SIZE_OPTIONS` and `PaginationControl`).

## 9) Verification Gate (Must Pass)
- IS413 Traceability Matrix checks are satisfied for all in-scope admin pages.
- All required IS413 admin pages exist and satisfy acceptance rules.
- Every page section above is implemented with required display and CRUD capabilities.
- Global dropdown + add-new standard is implemented where applicable.
- Resident create/edit supports full required detail coverage (including demographics) and not just minimal fields.
- Donation parity checks pass for:
  - type mapping,
  - value semantics (`amount` vs `estimatedValue`),
  - currency handling,
  - campaign/notes normalization,
  - donor identity binding.
- Admin UI terminology uses `donor` consistently.
- Every delete path uses a confirmation window and blocks deletion until confirmed.
- Every edit/create experience allows access to all fields on desktop and mobile (scroll/size/responsive behavior verified).
- Edit flows keep the active record in context while editing all related details (`5.3 Edit Context Persistence Rule`).
- Required filtering/search behavior is implemented for Donors, Caseload, Process Recording, and Home Visitation/Case Conferences.
- Paginated admin tables meet `5.4` (default page size 25, shared controls).

## 10) IS413 Traceability Matrix (Admin Scope)
- **IS413 Admin Dashboard requirement**
  - Covered by: `4.1 Admin Dashboard`
  - Required outcome: command-center metrics and triage visibility
  - Status target: in scope now

- **IS413 Donors & Contributions requirement**
  - Covered by: `4.2 Donors & Contributions`, `5) Form Standard`, `5.3 Edit Context Persistence Rule`, `6) Donation Entry Parity`
  - Required outcome: donor/contribution CRUD, allocation visibility, filtering, donor/admin parity
  - Status target: in scope now

- **IS413 Caseload Inventory requirement**
  - Covered by: `4.3 Caseload Inventory`, `5.1 Full Detail Editing Rule`, `5.3 Edit Context Persistence Rule`
  - Required outcome: full resident profile CRUD with demographic/case detail and required filtering
  - Status target: in scope now

- **IS413 Process Recording requirement**
  - Covered by: `4.4 Process Recording`
  - Required outcome: chronological counseling history and full CRUD
  - Status target: in scope now

- **IS413 Home Visitation & Case Conferences requirement**
  - Covered by: `4.5 Home Visitation & Case Conferences`
  - Required outcome: visitation/conference history + upcoming + CRUD workflows
  - Status target: in scope now

- **IS413 Reports & Analytics requirement**
  - Covered by: `4.6 Reports & Analytics`
  - Required outcome: trends/analytics reporting
  - Status target: deferred to ML integration scope (not part of current admin build phase)
