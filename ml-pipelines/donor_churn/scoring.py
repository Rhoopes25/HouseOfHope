"""Batch scoring: current snapshot at latest donation date minus prediction window."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from case_management.data import resolve_data_dir
from donor_churn.data import DonorTables, load_tables
from donor_churn.features import build_supporter_features_at_cutoff, enrich_donations
from donor_churn.heuristic import ensure_feature_frame, heuristic_churn_probability, to_churn_risk_segment
from donor_churn.modeling import CONTACT_RATE_DEFAULT, FEATURE_COLS

DEFAULT_ARTIFACTS = Path(__file__).resolve().parent / "artifacts"
PRIMARY_MODEL_FILE = "churn_calibrated.joblib"
META_FILE = "churn_meta.json"


def artifacts_dir(explicit: Path | None = None) -> Path:
    p = explicit if explicit is not None else DEFAULT_ARTIFACTS
    p.mkdir(parents=True, exist_ok=True)
    return p


def topk_decision(proba: np.ndarray, contact_rate: float) -> np.ndarray:
    n = len(proba)
    k = max(1, int(np.ceil(contact_rate * n)))
    order = np.argsort(-proba)
    pred = np.zeros(n, dtype=int)
    pred[order[:k]] = 1
    return pred


def threshold_from_topk_policy(proba: np.ndarray, contact_rate: float) -> float:
    """Equivalent score cutoff for reference (notebook-aligned)."""
    q = float(max(0.0, min(1.0, 1.0 - contact_rate)))
    return float(np.quantile(proba, q))


def load_meta(artifact_dir: Path) -> dict:
    path = artifact_dir / META_FILE
    if not path.is_file():
        return {"contact_rate": CONTACT_RATE_DEFAULT, "feature_columns": FEATURE_COLS}
    return json.loads(path.read_text(encoding="utf-8"))


def snapshot_dates_iso(tables: DonorTables, *, prediction_window_days: int = 90) -> tuple[str, str]:
    """Observation `as_of` and feature `cutoff` (ISO dates) from the donation extract."""
    donations = enrich_donations(tables.donations)
    as_of = donations["donation_date"].max()
    if pd.isna(as_of):
        return "", ""
    as_of = pd.Timestamp(as_of).normalize()
    cutoff = as_of - pd.Timedelta(days=prediction_window_days)
    return as_of.date().isoformat(), cutoff.date().isoformat()


def build_scoring_snapshot(
    tables: DonorTables,
    *,
    prediction_window_days: int = 90,
) -> tuple[pd.DataFrame, pd.Timestamp, pd.Timestamp]:
    """
    Features as of cutoff = max(donation_date) - prediction_window_days.
    Only supporters with gift_count > 0 at cutoff (same as training panel filter).
    """
    donations = enrich_donations(tables.donations)
    as_of = donations["donation_date"].max()
    if pd.isna(as_of):
        raise ValueError("No donation dates in extract.")
    as_of = pd.Timestamp(as_of).normalize()
    cutoff = as_of - pd.Timedelta(days=prediction_window_days)
    snap = build_supporter_features_at_cutoff(donations, tables.supporters, cutoff)
    eligible = snap[snap["gift_count"] > 0].copy()
    return eligible, as_of, cutoff


def score_churn_priorities(
    tables: DonorTables,
    *,
    artifact_dir: Path | None = None,
    prediction_window_days: int = 90,
    contact_rate: float | None = None,
) -> pd.DataFrame:
    adir = artifacts_dir(artifact_dir)
    meta = load_meta(adir)
    cr = float(contact_rate if contact_rate is not None else meta.get("contact_rate", CONTACT_RATE_DEFAULT))

    frame, as_of, cutoff = build_scoring_snapshot(tables, prediction_window_days=prediction_window_days)
    if frame.empty:
        return pd.DataFrame(
            columns=[
                "supporter_id",
                "churn_probability",
                "in_outreach_top_k",
                "churn_risk_segment",
                "model",
                "as_of",
                "feature_cutoff",
            ]
        )

    X = ensure_feature_frame(frame)
    model_path = adir / PRIMARY_MODEL_FILE
    if model_path.is_file():
        model = joblib.load(model_path)
        proba = model.predict_proba(X)[:, 1]
        model_name = "random_forest_calibrated"
    else:
        proba = heuristic_churn_probability(frame)
        model_name = "heuristic_baseline"

    proba = np.asarray(proba, dtype=float)
    in_top = topk_decision(proba, cr).astype(bool)
    seg = to_churn_risk_segment(proba)

    out = pd.DataFrame(
        {
            "supporter_id": frame["supporter_id"].values,
            "churn_probability": proba,
            "in_outreach_top_k": in_top,
            "churn_risk_segment": seg,
            "model": model_name,
            "as_of": as_of.isoformat()[:10],
            "feature_cutoff": cutoff.isoformat()[:10],
        }
    )
    return out.sort_values("churn_probability", ascending=False)


def score_from_csv_dir(data_dir: Path | None = None, **kwargs) -> pd.DataFrame:
    d = resolve_data_dir(data_dir)
    tables = load_tables(d)
    return score_churn_priorities(tables, **kwargs)


def priorities_json_records(df: pd.DataFrame) -> list[dict]:
    """Serialize for FastAPI (native bool/int/float)."""
    if df.empty:
        return []
    export = df.drop(columns=["as_of", "feature_cutoff"], errors="ignore")
    records = json.loads(export.to_json(orient="records"))
    return records
