"""Transparent baseline when no trained artifact is present."""

from __future__ import annotations

import numpy as np
import pandas as pd

from donor_churn.modeling import FEATURE_COLS


def heuristic_churn_probability(frame: pd.DataFrame) -> np.ndarray:
    """Higher score ≈ more likely to churn (longer recency, lower recent frequency)."""
    dsl = frame["days_since_last_gift"].replace([np.inf, -np.inf], np.nan).fillna(365.0).astype(float)
    freq90 = frame["freq_90d"].fillna(0.0).astype(float)
    hi_d = float(np.nanquantile(dsl, 0.95)) + 1e-6
    hi_f = float(np.nanquantile(freq90, 0.95)) + 1e-6
    z1 = np.clip(dsl / hi_d, 0.0, 1.0)
    z2 = 1.0 - np.minimum(freq90 / hi_f, 1.0)
    s = 0.65 * z1 + 0.35 * z2
    return np.clip(s, 0.0, 1.0)


def to_churn_risk_segment(prob: np.ndarray | pd.Series, high: float = 0.65, medium: float = 0.35) -> np.ndarray:
    p = np.asarray(prob, dtype=float)
    return np.where(
        p >= high,
        "High churn risk",
        np.where(p >= medium, "Medium churn risk", "Low churn risk"),
    )


def ensure_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in FEATURE_COLS if c not in frame.columns]
    if missing:
        raise ValueError(f"Missing feature columns: {missing}")
    return frame[FEATURE_COLS].copy()
