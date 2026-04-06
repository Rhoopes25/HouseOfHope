# Lighthouse Database Handoff

This document explains how the SQLite database was built from `notebooks/lighthouse_csv_v7`, how it is structured, and how teammates (or other AI agents) should use it safely.

## What This Produces

- Input folder: `notebooks/lighthouse_csv_v7`
- Build script: `build_lighthouse_sqlite.py`
- Output database: `lighthouse_v7.sqlite`

The build script creates:

1. **Base operational tables** (close to CSV shape) for easy app integration.
2. **3NF-style tables** for cleaner relational modeling of repeated categorical values.

## Design Goal

Prioritize reliability for a working deployed app while still giving a normalized data model:

- Base tables are fastest for CRUD and lower implementation risk.
- 3NF tables improve consistency and analytics friendliness.

## Files and Ownership

- `build_lighthouse_sqlite.py`: source of truth for schema + loading logic.
- `lighthouse_v7.sqlite`: generated artifact; can be rebuilt anytime.
- `INTEX W26 Case.md`: business and dictionary reference.

Do not manually edit `lighthouse_v7.sqlite` in place unless it is an intentional hotfix.

## Build Process Summary

`build_lighthouse_sqlite.py` does the following:

1. Reads all 17 CSV files.
2. Cleans values:
   - trims strings
   - converts common null tokens to `NULL`
   - normalizes booleans to `0/1`
   - parses date and datetime fields
   - coerces numeric columns
3. Creates base tables with PK/FK constraints.
4. Loads tables in dependency-safe order.
5. Cleans orphan FK references (if any) before insert.
6. Builds a 3NF layer:
   - `enum_values`
   - `safehouses_3nf`
   - `supporters_3nf`
   - `donations_3nf`
   - `residents_3nf`
7. Adds useful indexes.
8. Verifies relational integrity (`PRAGMA foreign_key_check`).

## Table Usage Guidance

Use this rule of thumb:

- **Use base tables** for app pages and straightforward CRUD.
- **Use 3NF tables** for analytics, aggregation, or when strict normalization matters.

### Base Tables (compatibility layer)

These match the core data entities from CSV/dictionary and are easiest for direct feature development:

- `safehouses`
- `partners`
- `partner_assignments`
- `supporters`
- `donations`
- `in_kind_donation_items`
- `donation_allocations`
- `residents`
- `process_recordings`
- `home_visitations`
- `education_records`
- `health_wellbeing_records`
- `intervention_plans`
- `incident_reports`
- `social_media_posts`
- `safehouse_monthly_metrics`
- `public_impact_snapshots`

### 3NF Layer

- `enum_values`: shared lookup for repeated domain values.  
  - Columns: `enum_id`, `domain`, `value`
- `safehouses_3nf`: uses enum IDs for region/country/status.
- `supporters_3nf`: uses enum IDs for supporter type, relationship type, region, country, status, acquisition channel.
- `donations_3nf`: uses enum IDs for donation type, channel, currency, impact unit.
- `residents_3nf`: uses enum IDs for status/category/referral/reintegration/risk fields.

## Which Layer Should the Web App Use?

For this INTEX timeline:

- Build app features primarily against **base tables**.
- If a feature benefits from strict normalized categories or codebooks, use `*_3nf` plus `enum_values`.

This balances speed and correctness.

## Rebuild Commands

From project root:

```powershell
python ".\build_lighthouse_sqlite.py" --csv-dir ".\notebooks\lighthouse_csv_v7" --out ".\lighthouse_v7.sqlite"
```

## Validation Commands

Check FK integrity:

```powershell
python -c "import sqlite3; c=sqlite3.connect(r'.\lighthouse_v7.sqlite'); c.execute('PRAGMA foreign_keys=ON'); print(len(c.execute('PRAGMA foreign_key_check').fetchall()))"
```

Expected output: `0`

Quick table count spot-check:

```powershell
python -c "import sqlite3; c=sqlite3.connect(r'.\lighthouse_v7.sqlite'); print(c.execute('SELECT COUNT(*) FROM donations').fetchone()[0])"
```

## Known Dictionary vs CSV Differences

The script follows real CSV structure where needed for robustness, while staying aligned with dictionary intent:

- Some dictionary fields are missing or named differently in CSV v7.
- Example: `donations.created_by_partner_id` is in the dictionary but absent in CSV; script adds it as nullable.
- Example: `education_records` and `health_wellbeing_records` include CSV-specific naming variants.

This is intentional to keep the import stable and the app functional.

## Safe Change Protocol

When updating schema/data logic:

1. Edit `build_lighthouse_sqlite.py` first (never only the `.sqlite` file).
2. Rebuild database.
3. Run FK check and row count sanity checks.
4. Confirm downstream queries still work.

## Suggested Next Steps (Optional)

- Add SQL views that present human-readable labels from `enum_values` for `*_3nf` tables.
- Add lightweight migration versioning (e.g., `schema_version` table).
- Add a smoke test script for top app queries.

