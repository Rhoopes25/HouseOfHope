"""
Train safehouse performance benchmark model and export ONNX + JSON metadata.
Run from ml-pipelines/:  python safehouse_train_export.py

v2: adds safehouse_monthly_metrics features + full outcome index with risk improvement.
"""
from __future__ import annotations

import json
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

DATA_DIR = Path("lighthouse_csv_v7")
OUT_ONNX = Path("safehouse_performance_model.onnx")
OUT_JSON = Path("safehouse_performance_preprocessing.json")

RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


def risk_num(x: str | float) -> float:
    if pd.isna(x) or x == "":
        return np.nan
    return float(RISK_ORDER.get(str(x).strip(), 1))


def load_tables() -> tuple[pd.DataFrame, ...]:
    sh = pd.read_csv(DATA_DIR / "safehouses.csv")
    res = pd.read_csv(DATA_DIR / "residents.csv")
    pr = pd.read_csv(DATA_DIR / "process_recordings.csv")
    hv = pd.read_csv(DATA_DIR / "home_visitations.csv")
    ip = pd.read_csv(DATA_DIR / "intervention_plans.csv")
    edu = pd.read_csv(DATA_DIR / "education_records.csv")
    hlth = pd.read_csv(DATA_DIR / "health_wellbeing_records.csv")
    met = pd.read_csv(DATA_DIR / "safehouse_monthly_metrics.csv")
    return sh, res, pr, hv, ip, edu, hlth, met


def subcat_sum(row: pd.Series) -> int:
    cols = [c for c in row.index if c.startswith("sub_cat_")]
    return int(row[cols].fillna(0).astype(int).sum())


def build_monthly_aggregates(metrics: pd.DataFrame) -> pd.DataFrame:
    """One row per safehouse: rolling means from monthly_metrics table."""
    rows = []
    for sid, g in metrics.groupby("safehouse_id"):
        g = g.copy()
        ar = g["active_residents"].fillna(1).clip(lower=1)
        inc_rate = g["incident_count"].fillna(0).astype(float) / ar.astype(float)

        edu_s = g["avg_education_progress"]
        hl_s = g["avg_health_score"]
        monthly_avg_edu = float(edu_s.mean(skipna=True)) if edu_s.notna().any() else 0.0
        monthly_avg_health = float(hl_s.mean(skipna=True)) if hl_s.notna().any() else 3.0
        monthly_incident_rate = float(inc_rate.mean(skipna=True))

        rows.append(
            {
                "safehouse_id": int(sid),
                "monthly_avg_education_progress": monthly_avg_edu,
                "monthly_avg_health_score": monthly_avg_health,
                "monthly_incident_rate": monthly_incident_rate,
            }
        )
    return pd.DataFrame(rows)


def build_safehouse_frames(
    sh: pd.DataFrame,
    res: pd.DataFrame,
    pr: pd.DataFrame,
    hv: pd.DataFrame,
    ip: pd.DataFrame,
    edu: pd.DataFrame,
    hlth: pd.DataFrame,
    met: pd.DataFrame,
) -> pd.DataFrame:
    """One row per safehouse with operational features (X) and outcome index (y)."""
    monthly = build_monthly_aggregates(met)

    res = res.copy()
    res["complexity"] = res.apply(subcat_sum, axis=1)
    res["init_r"] = res["initial_risk_level"].map(risk_num)
    res["cur_r"] = res["current_risk_level"].map(risk_num)

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

        imp = g["init_r"].to_numpy()
        cur = g["cur_r"].to_numpy()
        mask = ~np.isnan(imp) & ~np.isnan(cur)
        if mask.sum():
            risk_improve_pct = float(
                np.mean(np.maximum(0, imp[mask] - cur[mask]) / 3.0 * 100.0)
            )
        else:
            risk_improve_pct = 0.0

        health_term = (avg_health - 1.0) / 4.0 * 100.0
        outcome_index = (
            0.30 * pct_reint
            + 0.22 * min(100.0, avg_edu)
            + 0.18 * health_term
            + 0.15 * pct_low
            + 0.15 * risk_improve_pct
        )
        outcome_index = float(np.clip(outcome_index, 0, 100))

        meta = sh[sh["safehouse_id"] == sid]
        name = meta["name"].iloc[0] if len(meta) else f"Safehouse {sid}"

        mm = monthly[monthly["safehouse_id"] == sid]
        if len(mm):
            m_edu = float(mm["monthly_avg_education_progress"].iloc[0])
            m_hl = float(mm["monthly_avg_health_score"].iloc[0])
            m_inc = float(mm["monthly_incident_rate"].iloc[0])
        else:
            m_edu, m_hl, m_inc = 0.0, 3.0, 0.0

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
                "monthly_avg_education_progress": m_edu,
                "monthly_avg_health_score": m_hl,
                "monthly_incident_rate": m_inc,
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
    "monthly_avg_education_progress",
    "monthly_avg_health_score",
    "monthly_incident_rate",
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
        "model_version": "safehouse-ridge-benchmark-v2",
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
    sh, res, pr, hv, ip, edu, hlth, met = load_tables()
    df = build_safehouse_frames(sh, res, pr, hv, ip, edu, hlth, met)
    print(f"Safehouses in training frame: {len(df)}")
    print(df[FEATURE_COLS + ["outcome_index"]].round(2).to_string())
    stats = train_and_export(df)
    print(f"\nTrain MAE: {stats['mae']:.3f}  R2: {stats['r2']:.3f}")
    print("Coefficients (scaled Ridge):", stats["coef_map"])
    print(f"\nWrote {OUT_ONNX.resolve()} and {OUT_JSON.resolve()}")


if __name__ == "__main__":
    main()
