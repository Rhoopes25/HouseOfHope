"""Train and save sklearn pipelines for case management targets (run from ml-pipelines/)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib

from case_management.data import load_tables, resolve_data_dir
from case_management.features import build_feature_frame
from case_management.labels import build_label
from case_management.modeling import FEATURE_COLUMNS, fit_risk_pipeline


TARGETS = ("risk_escalation_30d", "reintegration_success_90d")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train case management classifiers from CSV exports.")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Directory with lighthouse CSVs (default: auto-detect lighthouse_csv_v7)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "artifacts",
        help="Output directory for .joblib and meta JSON",
    )
    args = parser.parse_args()

    data_dir = resolve_data_dir(args.data_dir)
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    tables = load_tables(data_dir)
    frame = build_feature_frame(tables)

    for target in TARGETS:
        y = build_label(frame, tables.residents, tables.incident_reports, target=target)
        model_df = frame[["resident_id", "as_of_date"] + FEATURE_COLUMNS].copy()
        model_df["y"] = y
        model_df = model_df.dropna(subset=["y"])
        if model_df["y"].nunique() < 2:
            print(f"[SKIP] {target}: only one class in labeled data.")
            continue
        X = model_df.drop(columns=["y", "resident_id", "as_of_date"])
        pipe = fit_risk_pipeline(X, model_df["y"])
        joblib.dump(pipe, out_dir / f"{target}_pipeline.joblib")
        meta = {
            "target": target,
            "feature_columns": FEATURE_COLUMNS,
            "n_samples": int(len(model_df)),
            "positive_rate": float(model_df["y"].mean()),
        }
        (out_dir / f"{target}_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        print(f"[OK] Wrote {out_dir / (target + '_pipeline.joblib')}")


if __name__ == "__main__":
    main()
