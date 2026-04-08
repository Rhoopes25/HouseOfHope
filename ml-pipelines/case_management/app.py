"""Optional FastAPI service for case risk priorities (staff-only integration via backend proxy)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException

from case_management.data import resolve_data_dir
from case_management.scoring import priorities_json_records, score_from_csv_dir

app = FastAPI(title="House of Hope — Case management risk priorities", version="1.0.0")


def _csv_dir() -> Path:
    return resolve_data_dir()


@app.get("/health")
def health():
    return {"status": "ok", "csv_dir": str(_csv_dir())}


@app.get("/v1/priorities")
def get_priorities():
    """Return residents sorted by escalation risk probability (heuristic if model artifact missing)."""
    try:
        d = _csv_dir()
        df = score_from_csv_dir(data_dir=d)
        return {"csv_dir": str(d), "priorities": priorities_json_records(df)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
