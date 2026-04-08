# Case management ML (integration starter)

This package contains the same **leakage-safe** feature logic as `CaseManagement_Analysis.ipynb`, packaged for **training**, **batch scoring**, and an optional **HTTP service** the .NET API can proxy.

## Prerequisites

From the `ml-pipelines` directory (with a virtualenv that has `pandas`, `scikit-learn`, `joblib`; for the API also `fastapi`, `uvicorn`):

```bash
pip install -r requirements-case-management.txt
```

## Train pipelines (writes `artifacts/*.joblib`)

```bash
cd ml-pipelines
python -m case_management.train --data-dir lighthouse_csv_v7
```

If the **risk escalation** label has only one class in your export, that target is skipped; **reintegration** may still train.

## Score in Python

```python
from case_management.scoring import score_from_csv_dir
df = score_from_csv_dir()  # auto-detects CSV folder or set HOUSE_OF_HOPE_CSV_DIR
print(df.head())
```

Uses the saved **`risk_escalation_30d_pipeline.joblib`** when present; otherwise **heuristic** scores.

## Run the ML HTTP service (for the website API)

```bash
cd ml-pipelines
set HOUSE_OF_HOPE_CSV_DIR=%CD%\lighthouse_csv_v7
uvicorn case_management.app:app --host 127.0.0.1 --port 5055
```

## Wire the ASP.NET Core API

1. **Development:** `appsettings.Development.json` already sets `CaseManagementMl:BaseUrl` to `http://127.0.0.1:5055`. If you leave it blank, the API still defaults to that URL when `ASPNETCORE_ENVIRONMENT=Development`.

2. **Production:** set `CaseManagementMl:BaseUrl` (or an environment variable `CaseManagementMl__BaseUrl`) to your deployed ML service URL.

3. Start the Python service (above) before opening **Case risk (ML)** in the admin portal.

4. Staff endpoint: **GET** `/api/CaseManagement/risk-priorities` (requires `ManageData` / admin policy).

Returns JSON: `csv_dir`, `priorities[]` with `resident_id`, `risk_probability`, `risk_segment`, `model`.

If `BaseUrl` is empty or the service is down, the API returns **503** with an explanatory payload.

## Notebook

Keep using `CaseManagement_Analysis.ipynb` for exploration; for production paths, prefer importing from `case_management` so logic stays in one place (you can thin the notebook to `from case_management import ...` in a follow-up).
