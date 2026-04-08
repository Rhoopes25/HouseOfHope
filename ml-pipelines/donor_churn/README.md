# Donor churn ML (integration)

Leakage-safe features and training match `Donor_Churn_Analysis.ipynb`: **90-day** outcome window, panel built from rolling observation dates, primary model **Random Forest + sigmoid calibration**.

## Prerequisites

From `ml-pipelines` (same stack as case management):

```bash
pip install -r requirements-donor-churn.txt
```

This package imports `case_management.data` for CSV path resolution (`HOUSE_OF_HOPE_CSV_DIR` and the same folder search order).

## Train (writes `artifacts/churn_calibrated.joblib`)

```bash
cd ml-pipelines
python -m donor_churn.train --data-dir lighthouse_csv_v7
```

If the panel has fewer than two observation dates, lower `MIN_HISTORY_BEFORE_FIRST_OBS_DAYS` or `OBSERVATION_STEP_DAYS` in `train.py` for small extracts.

## Score in Python

```python
from donor_churn.scoring import score_from_csv_dir
df = score_from_csv_dir()
print(df.head())
```

Uses **`churn_calibrated.joblib`** when present; otherwise **heuristic** scores.

## Run the HTTP service (default port **5056** so case management can use 5055)

Run **from the `ml-pipelines` folder** (the repo root is `HouseOfHope`, not `ml-pipelines/ml-pipelines`). If your shell is already in `ml-pipelines`, do not `cd ml-pipelines` again.

```bash
cd ml-pipelines
set HOUSE_OF_HOPE_CSV_DIR=%CD%\lighthouse_csv_v7
uvicorn donor_churn.app:app --host 127.0.0.1 --port 5056
```

### Troubleshooting “Could not reach donor churn ML service”

1. Confirm the service responds: open `http://127.0.0.1:5056/health` in a browser or run `curl http://127.0.0.1:5056/health`.
2. Restart the **ASP.NET API** after pulling updates: the API uses a dedicated `HttpClient` that **does not use the system proxy**, so calls to `127.0.0.1` work on Windows even when a corporate proxy is enabled.
3. If the API runs **inside Docker**, `127.0.0.1` is the container itself. Set `DonorChurnMl:BaseUrl` to `http://host.docker.internal:5056` (and run uvicorn on the host, or publish port `5056`).

## ASP.NET Core

- Development: `DonorChurnMl:BaseUrl` → `http://127.0.0.1:5056` (or empty → same default when `Development`).
- Staff endpoint: **GET** `/api/DonorChurn/churn-priorities`.

Response: `csv_dir`, `as_of`, `feature_cutoff`, `priorities[]` with `supporter_id`, `churn_probability`, `in_outreach_top_k`, `churn_risk_segment`, `model`.
