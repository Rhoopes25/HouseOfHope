"""Train and save calibrated churn classifier from CSV exports (run from ml-pipelines/)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from case_management.data import resolve_data_dir
from donor_churn.data import load_tables
from donor_churn.features import build_panel_dataset, enrich_donations
from donor_churn.modeling import CONTACT_RATE_DEFAULT, FEATURE_COLS, RANDOM_STATE, fit_calibrated_churn_model
from donor_churn.scoring import threshold_from_topk_policy

PREDICTION_WINDOW_DAYS = 90
OBSERVATION_STEP_DAYS = 90
MIN_HISTORY_BEFORE_FIRST_OBS_DAYS = 180


def main() -> None:
    parser = argparse.ArgumentParser(description="Train donor churn model from Lighthouse CSV exports.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Directory with supporters.csv and donations.csv",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "artifacts",
        help="Output directory for joblib + meta JSON",
    )
    parser.add_argument(
        "--contact-rate",
        type=float,
        default=CONTACT_RATE_DEFAULT,
        help="Top fraction used for outreach capacity policy (stored in meta)",
    )
    args = parser.parse_args()

    data_dir = resolve_data_dir(args.data_dir)
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    tables = load_tables(data_dir)
    donations = enrich_donations(tables.donations)

    panel = build_panel_dataset(
        donations,
        tables.supporters,
        horizon_days=PREDICTION_WINDOW_DAYS,
        step_days=OBSERVATION_STEP_DAYS,
        min_lead_days=MIN_HISTORY_BEFORE_FIRST_OBS_DAYS,
    )
    if len(panel) < 20:
        raise SystemExit(f"Panel too small ({len(panel)} rows). Check data or lower min_lead_days / step_days.")

    unique_obs = np.sort(panel["observation_as_of"].unique())
    if len(unique_obs) < 2:
        raise SystemExit(
            "Need at least two observation dates in the panel. "
            "Try lowering MIN_HISTORY_BEFORE_FIRST_OBS_DAYS or OBSERVATION_STEP_DAYS in train.py."
        )

    test_as_of = unique_obs.max()
    train_mask = panel["observation_as_of"] < test_as_of
    X_train = panel.loc[train_mask, FEATURE_COLS].copy()
    y_train = panel.loc[train_mask, "churn"].astype(int)

    if y_train.nunique() < 2:
        raise SystemExit("Training split has only one class; cannot train classifier.")

    model = fit_calibrated_churn_model(X_train, y_train)
    joblib.dump(model, out_dir / "churn_calibrated.joblib")

    p_train = model.predict_proba(X_train)[:, 1]
    t_ref = threshold_from_topk_policy(p_train, args.contact_rate)

    meta = {
        "model": "random_forest_calibrated_sigmoid",
        "feature_columns": FEATURE_COLS,
        "random_state": RANDOM_STATE,
        "prediction_window_days": PREDICTION_WINDOW_DAYS,
        "observation_step_days": OBSERVATION_STEP_DAYS,
        "min_history_before_first_obs_days": MIN_HISTORY_BEFORE_FIRST_OBS_DAYS,
        "contact_rate": float(args.contact_rate),
        "reference_threshold_topk": t_ref,
        "n_train_rows": int(len(X_train)),
        "train_churn_rate": float(y_train.mean()),
        "train_observation_cutoff": str(pd.Timestamp(test_as_of).date()),
    }
    (out_dir / "churn_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[OK] Wrote {out_dir / 'churn_calibrated.joblib'} and churn_meta.json ({len(X_train)} train rows)")


if __name__ == "__main__":
    main()
