# FOR THE TEAM — Rubric Check (Missing Items Only)

## Misses Found in Code Review

- `Caseload Inventory` / resident editing does **not** expose disability and special-needs fields required by the case narrative.
  - Missing examples: child PWD flag, disability type, special-needs diagnosis.
  - Evidence: these fields are not represented in API DTOs (e.g., `backend/Contracts/ApiDtos.cs`) or surfaced in the resident forms/pages.

- `Home Visitation & Case Conferences` appears to miss explicit **follow-up actions/notes** capture in the implemented flow.
  - Dataset includes `follow_up_notes`, but app flow appears to only capture follow-up needed as a boolean plus general notes/observations.

- `Reports & Analytics` does not currently present the full required reporting scope in one reports surface (IS413 expectations).
  - Gaps include clearer required reporting coverage for donation trends over time, resident outcomes, and reintegration success summaries in the staff reports page.
  - Current page is heavily ML-focused (`frontend/src/pages/ReportsAnalytics.tsx`).
