"""
Canonical locations for ML *training* data.

Training scripts and notebooks should read CSVs from the repo’s `backend/SeedData`
(or override with ML_SEED_DATA_DIR). Do not read SQLite or Azure SQL for training:
those are runtime stores only; Azure has no .sqlite files on disk.

Runtime inference in the API still uses the configured database (SQLite in dev,
SQL Server in production) because predictions must reflect live data.
"""
from __future__ import annotations

import os
from pathlib import Path

_ENV_KEY = "ML_SEED_DATA_DIR"


def resolve_seed_data_dir() -> Path:
    """
    Return the directory containing Lighthouse CSVs used for training.

    Resolution order:
    1. Environment variable ML_SEED_DATA_DIR (absolute or relative path).
    2. `<repo>/backend/SeedData` (same files the API seeds in development).
    3. Legacy fallback: `ml-pipelines/lighthouse_csv_v7` if present.
    """
    override = os.environ.get(_ENV_KEY, "").strip()
    if override:
        p = Path(override).expanduser().resolve()
        if not p.is_dir():
            raise FileNotFoundError(f"{_ENV_KEY} is not a directory: {p}")
        return p

    # helpers/ml_data.py lives one level below ml-pipelines root.
    pipelines_dir = Path(__file__).resolve().parents[1]
    repo_root = pipelines_dir.parent
    seed = repo_root / "backend" / "SeedData"
    if seed.is_dir():
        return seed

    legacy = pipelines_dir / "lighthouse_csv_v7"
    if legacy.is_dir():
        return legacy

    raise FileNotFoundError(
        f"ML training CSVs not found. Expected backend/SeedData at {seed}, "
        f"or legacy {legacy}, or set {_ENV_KEY}."
    )
