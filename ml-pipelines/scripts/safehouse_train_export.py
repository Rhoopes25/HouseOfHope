"""
Train safehouse performance benchmark model and export ONNX + JSON metadata.
Run from ml-pipelines/:  python scripts/safehouse_train_export.py

Training data: CSVs under backend/SeedData (see ml_data.resolve_seed_data_dir), not SQLite.

Azure safety constraint:
- Only use inputs that exist in the *runtime* Azure SQL schema. Even if a CSV exists in SeedData,
  do not depend on it unless the corresponding table exists in production.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
except ImportError as e:
    raise SystemExit(
        "Install skl2onnx: pip install skl2onnx onnx onnxruntime"
    ) from e

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from helpers.ml_data import resolve_seed_data_dir

DATA_DIR = resolve_seed_data_dir()
# Keep a local artifact copy; deployable files still belong in backend/Models/.
OUT_ONNX = ROOT / "artifacts" / "onnx" / "safehouse_performance_model.onnx"
OUT_JSON = ROOT / "artifacts" / "metadata" / "safehouse_performance_preprocessing.json"

def load_tables() -> tuple[pd.DataFrame, ...]:
    """
    Load only CSVs that map to runtime tables (InitialCreate + verified production schema).

    NOTE: `safehouse_monthly_metrics.csv` exists in SeedData but there is no corresponding
    table in the production EF schema, so it must NOT be used as a model input.
    """
    sh = pd.read_csv(DATA_DIR / "safehouses.csv")
    res = pd.read_csv(DATA_DIR / "residents.csv")
    pr = pd.read_csv(DATA_DIR / "process_recordings.csv")
    hv = pd.read_csv(DATA_DIR / "home_visitations.csv")
    ip = pd.read_csv(DATA_DIR / "intervention_plans.csv")
    edu = pd.read_csv(DATA_DIR / "education_records.csv")
    hlth = pd.read_csv(DATA_DIR / "health_wellbeing_records.csv")
    return sh, res, pr, hv, ip, edu, hlth


def subcat_sum(row: pd.Series) -> int:
    cols = [c for c in row.index if c.startswith("sub_cat_")]
    return int(row[cols].fillna(0).astype(int).sum())


def build_safehouse_frames(
    sh: pd.DataFrame,
    res: pd.DataFrame,
    pr: pd.DataFrame,
    hv: pd.DataFrame,
    ip: pd.DataFrame,
    edu: pd.DataFrame,
    hlth: pd.DataFrame,
) -> pd.DataFrame:
    """One row per safehouse with operational features (X) and outcome index (y)."""
    res = res.copy()
    res["complexity"] = res.apply(subcat_sum, axis=1)

    rows = []
    for sid, g in res.groupby("safehouse_id"):
        n = len(g)
        if n == 0:
            continue

        ids = set(g["resident_id"])
        pr_c = pr[pr["resident_id"].isin(ids)]
        hv_c = hv[hv["resident_id"].isin(ids)]
        ip_c = ip[ip["resident_id"].isin(ids)]
        edu_c = edu[edu["resident_id"].isin(ids)]
        hl_c = hlth[hlth["resident_id"].isin(ids)]

        process_per_res = len(pr_c) / max(n, 1)
        visits_per_res = len(hv_c) / max(n, 1)

        plans = len(ip_c)
        achieved = (ip_c["status"].astype(str) == "Achieved").sum()
        intervention_achieve_rate = achieved / max(plans, 1)

        complexity_mean = g["complexity"].mean()
        pct_hi = (
            g["current_risk_level"].isin(["High", "Critical"]).mean() * 100.0
        )

        avg_edu = float(edu_c["progress_percent"].mean()) if len(edu_c) else np.nan
        if np.isnan(avg_edu):
            avg_edu = 0.0
        avg_health = (
            float(hl_c["general_health_score"].mean()) if len(hl_c) else np.nan
        )
        if np.isnan(avg_health):
            avg_health = 3.0

        pct_reint = (
            (g["reintegration_status"].astype(str) == "Completed").mean() * 100.0
        )
        pct_low = (g["current_risk_level"].astype(str) == "Low").mean() * 100.0

        health_term = (avg_health - 1.0) / 4.0 * 100.0
        outcome_index = (
            0.35 * pct_reint
            + 0.25 * min(100.0, avg_edu)
            + 0.20 * health_term
            + 0.20 * pct_low
        )
        outcome_index = float(np.clip(outcome_index, 0, 100))

        meta = sh[sh["safehouse_id"] == sid]
        name = meta["name"].iloc[0] if len(meta) else f"Safehouse {sid}"

        rows.append(
            {
                "safehouse_id": int(sid),
                "name": name,
                "n_residents": n,
                "process_per_resident": process_per_res,
                "visits_per_resident": visits_per_res,
                "intervention_achieve_rate": intervention_achieve_rate,
                "caseload_complexity": float(complexity_mean),
                "pct_high_critical_risk": float(pct_hi),
                "avg_education_progress": float(avg_edu),
                "avg_health_score": float(avg_health),
                "outcome_index": outcome_index,
            }
        )

    return pd.DataFrame(rows)


FEATURE_COLS = [
    "process_per_resident",
    "visits_per_resident",
    "intervention_achieve_rate",
    "caseload_complexity",
    "pct_high_critical_risk",
    "n_residents",
    "avg_education_progress",
    "avg_health_score",
]


def train_and_export(df: pd.DataFrame) -> dict:
    X = df[FEATURE_COLS].astype(float)
    y = df["outcome_index"].astype(float)

    pipe = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("ridge", Ridge(alpha=2.0, random_state=42)),
        ]
    )
    pipe.fit(X, y)
    y_hat = pipe.predict(X)
    mae = mean_absolute_error(y, y_hat)
    r2 = r2_score(y, y_hat)
    cv = cross_val_score(
        Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                ("ridge", Ridge(alpha=2.0, random_state=42)),
            ]
        ),
        X,
        y,
        cv=min(5, len(df)),
        scoring="neg_mean_absolute_error",
    )

    ridge: Ridge = pipe.named_steps["ridge"]
    imputer: SimpleImputer = pipe.named_steps["imputer"]
    scaler: StandardScaler = pipe.named_steps["scaler"]
    coefs = ridge.coef_

    meta = {
        "model_version": "safehouse-ridge-benchmark-v3",
        "feature_names": FEATURE_COLS,
        "imputer_medians": imputer.statistics_.tolist(),
        "scaler_means": scaler.mean_.tolist(),
        "scaler_stds": scaler.scale_.tolist(),
        "ridge_intercept": float(ridge.intercept_),
        "ridge_coef": [float(c) for c in coefs],
        "train_mae": float(mae),
        "train_r2": float(r2),
        "cv_mae_mean": float(-cv.mean()),
        "cv_mae_std": float(cv.std()),
        "tier_strong_cut": float(np.percentile(df["outcome_index"], 66)),
        "tier_attention_cut": float(np.percentile(df["outcome_index"], 33)),
        "network_means": {k: float(df[k].mean()) for k in FEATURE_COLS},
    }

    n_features = len(FEATURE_COLS)
    initial_type = [("float_input", FloatTensorType([None, n_features]))]
    onnx_model = convert_sklearn(pipe, initial_types=initial_type, target_opset=12)
    OUT_ONNX.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_ONNX, "wb") as f:
        f.write(onnx_model.SerializeToString())

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {
        "mae": mae,
        "r2": r2,
        "coef_map": dict(zip(FEATURE_COLS, coefs)),
        "meta": meta,
    }


def main():
    if not DATA_DIR.is_dir():
        raise FileNotFoundError(f"Missing {DATA_DIR}")
    sh, res, pr, hv, ip, edu, hlth = load_tables()
    df = build_safehouse_frames(sh, res, pr, hv, ip, edu, hlth)
    print(f"Safehouses in training frame: {len(df)}")
    print(df[FEATURE_COLS + ["outcome_index"]].round(2).to_string())
    stats = train_and_export(df)
    print(f"\nTrain MAE: {stats['mae']:.3f}  R2: {stats['r2']:.3f}")
    print("Coefficients (scaled Ridge):", stats["coef_map"])
    print(f"\nWrote {OUT_ONNX.resolve()} and {OUT_JSON.resolve()}")


if __name__ == "__main__":
    main()
