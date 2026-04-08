"""Rule-based risk score (transparent baseline)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def heuristic_risk_score(df: pd.DataFrame) -> pd.Series:
    score = (
        0.25 * df["initial_risk_num"].fillna(0)
        + 0.20 * df["inc_n_incidents_to_date"].fillna(0)
        + 0.25 * df["inc_n_high_critical_to_date"].fillna(0)
        + 0.15 * df["inc_unresolved_rate_to_date"].fillna(0)
        + 0.15 * df["hv_unfavorable_rate_to_date"].fillna(0)
    )
    score = (score - score.min()) / (score.max() - score.min() + 1e-9)
    return score


def to_risk_segment(prob: pd.Series | np.ndarray, high: float = 0.65, medium: float = 0.35) -> np.ndarray:
    p = np.asarray(prob)
    return np.where(p >= high, "High risk", np.where(p >= medium, "Medium risk", "Low risk"))
