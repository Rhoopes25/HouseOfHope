# Azure SQL — apply Lighthouse schema update

Use this after deploying API code that adds **`residents.initial_risk_level`** and **`safehouse_monthly_metrics`**. Production does **not** run migrations on startup (`Program.cs`); the database must be updated explicitly.

## What you need (Azure / ops)

- **Connection string** for the **production** SQL database the API uses. In code this is `ConnectionStrings:DefaultConnection` (set in Azure App Service / Key Vault / pipeline secrets — **not** in committed `appsettings.json`).
- **Firewall**: your IP allowed on the SQL server (portal or `az sql server firewall-rule create`), or run the update from a host that already has access.
- **Permission** on that database to `ALTER` / `CREATE TABLE` (e.g. user in connection string).

## Nothing special required from app dev

Repo already contains the migration. Optional: confirm **which** subscription / server / database is tied to the live API so you patch the right DB.

## Critical: custom EF history table

This app uses a **non-default** migrations history table for Lighthouse:

| Item | Value |
|------|--------|
| DbContext | `LighthouseDbContext` |
| History table | **`__LighthouseMigrationsHistory`** |

`dotnet ef` must use the same history table as the running API (`Program.cs` → `EfMigrationHistory.LighthouseTable`). If you apply SQL by hand without inserting into that table, the next `database update` may try to re-apply migrations.

## Migration to apply

| Migration ID | Class |
|--------------|--------|
| `20260410004500_AddInitialRiskAndMetrics` | `AddInitialRiskAndMetrics` |

**`Up` does:** nullable column `initial_risk_level` on `residents`; creates `safehouse_monthly_metrics` with FK to `safehouses` and index on `safehouse_id`.

Source: `Migrations/20260410004500_AddInitialRiskAndMetrics.cs`.

## Suggested command (from laptop, with prod connection string)

From the repo root (or adjust `--project` path):

```bash
cd backend
dotnet ef database update 20260410004500_AddInitialRiskAndMetrics ^
  --project HouseOfHope.API.csproj ^
  --context LighthouseDbContext ^
  --connection "YOUR_AZURE_SQL_CONNECTION_STRING"
```

On macOS/Linux use `\` instead of `^` for line continuation, or put the command on one line.

If `20260408233219_InitialCreate` was never applied via EF on this database (unusual), use `dotnet ef database update` without a target migration so EF applies in order — only if you know the history table state.

## Identity context

Auth uses **`AuthIdentityDbContext`** with history table **`__IdentityMigrationsHistory`**. This Lighthouse change does **not** require an Identity migration for the residents fix.

## Afterward

Redeploy is **not** required if only the DB changed; restart the API only if it had cached failures. Smoke-test **`GET /api/residents`**.
