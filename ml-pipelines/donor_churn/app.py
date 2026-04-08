"""FastAPI service for donor churn priorities (staff-only integration via backend proxy)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException

from case_management.data import resolve_data_dir
from donor_churn.data import load_tables
from donor_churn.scoring import priorities_json_records, score_churn_priorities, snapshot_dates_iso


app = FastAPI(title="House of Hope — Donor churn priorities", version="1.0.0")


def _csv_dir() -> Path:
    return resolve_data_dir()


@app.get("/health")
def health():
    return {"status": "ok", "csv_dir": str(_csv_dir())}


@app.get("/v1/churn-priorities")
def get_churn_priorities():
    """Supporters with history at feature cutoff, ranked by P(churn) in the next 90 days."""
    try:
        d = _csv_dir()
        tables = load_tables(d)
        as_of_iso, cutoff_iso = snapshot_dates_iso(tables)
        df = score_churn_priorities(tables)
        if not df.empty:
            as_of_iso = str(df["as_of"].iloc[0])
            cutoff_iso = str(df["feature_cutoff"].iloc[0])
        return {
            "csv_dir": str(d),
            "as_of": as_of_iso,
            "feature_cutoff": cutoff_iso,
            "priorities": priorities_json_records(df),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
