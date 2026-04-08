"""Batch scoring for integration (CLI + FastAPI)."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from case_management.data import CaseTables, load_tables, resolve_data_dir
from case_management.features import build_feature_frame
from case_management.heuristic import heuristic_risk_score, to_risk_segment
from case_management.modeling import FEATURE_COLUMNS

DEFAULT_ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
PRIMARY_TARGET = "risk_escalation_30d"


def artifacts_dir(explicit: Path | None = None) -> Path:
    p = explicit if explicit is not None else DEFAULT_ARTIFACTS
    p.mkdir(parents=True, exist_ok=True)
    return p


def score_risk_escalation(
    tables: CaseTables,
    *,
    pipeline_path: Path | None = None,
    high: float = 0.65,
    medium: float = 0.35,
) -> pd.DataFrame:
    """Return one row per resident with probability and segment (higher = more concern)."""
    frame = build_feature_frame(tables)
    X = frame[FEATURE_COLUMNS]

    path = pipeline_path or (DEFAULT_ARTIFACTS / f"{PRIMARY_TARGET}_pipeline.joblib")
    if path.is_file():
        pipe = joblib.load(path)
        proba = pipe.predict_proba(X)[:, 1]
        model_name = "random_forest_balanced"
    else:
        proba = heuristic_risk_score(frame).to_numpy()
        model_name = "heuristic_baseline"

    seg = to_risk_segment(proba, high=high, medium=medium)
    out = pd.DataFrame(
        {
            "resident_id": frame["resident_id"].values,
            "risk_probability": np.asarray(proba, dtype=float),
            "risk_segment": seg,
            "model": model_name,
        }
    )
    return out.sort_values("risk_probability", ascending=False)


def score_from_csv_dir(data_dir: Path | None = None, **kwargs) -> pd.DataFrame:
    d = resolve_data_dir(data_dir)
    tables = load_tables(d)
    return score_risk_escalation(tables, **kwargs)


def priorities_json_records(df: pd.DataFrame) -> list[dict]:
    return json.loads(df.to_json(orient="records"))
