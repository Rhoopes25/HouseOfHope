"""Sklearn pipelines, CV evaluation, and training for case risk models."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from case_management.data import CaseTables
from case_management.heuristic import heuristic_risk_score
from case_management.labels import build_label

FEATURE_COLUMNS = [
    "time_in_program_days",
    "initial_risk_num",
    "is_case_closed_by_T",
    "pr_n_sessions_to_date",
    "pr_concern_rate_to_date",
    "hv_n_visits_to_date",
    "hv_unfavorable_rate_to_date",
    "ip_n_interventions_to_date",
    "ip_completion_rate_to_date",
    "inc_n_incidents_to_date",
    "inc_n_high_critical_to_date",
    "inc_unresolved_rate_to_date",
    "inc_incidents_last_30d",
    "edu_trend_slope",
    "health_trend_slope",
]

SEED = 42


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    cat_cols = [c for c in X.columns if X[c].dtype == "object"]
    num_cols = [c for c in X.columns if c not in cat_cols]
    return ColumnTransformer(
        [
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                num_cols,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                cat_cols,
            ),
        ]
    )


def evaluate_models(
    frame: pd.DataFrame,
    tables: CaseTables,
    target: str,
    seed: int = SEED,
):
    y = build_label(frame, tables.residents, tables.incident_reports, target=target)

    model_df = frame[["resident_id", "as_of_date"] + FEATURE_COLUMNS].copy()
    model_df["y"] = y
    model_df = model_df.dropna(subset=["y"])

    if model_df["y"].nunique() < 2:
        print(f"[WARN] {target}: only one class available; model training skipped.")
        return None

    X = model_df.drop(columns=["y", "resident_id", "as_of_date"])
    yv = model_df["y"].astype(int)

    min_class = yv.value_counts().min()
    n_splits = int(max(2, min(5, min_class)))
    if n_splits < 3:
        print(f"[WARN] {target}: rare class; using {n_splits}-fold CV.")

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    pre = build_preprocessor(X)

    models = {
        "logistic_balanced": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=seed
        ),
        "random_forest_balanced": RandomForestClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=seed,
        ),
    }

    rows = []
    prob_store: dict[str, np.ndarray] = {}

    heuristic_prob = heuristic_risk_score(model_df)
    heuristic_pred = (heuristic_prob >= 0.50).astype(int)
    rows.append(
        {
            "target": target,
            "model": "heuristic_baseline",
            "recall": recall_score(yv, heuristic_pred, zero_division=0),
            "f1": f1_score(yv, heuristic_pred, zero_division=0),
            "precision": precision_score(yv, heuristic_pred, zero_division=0),
            "roc_auc": roc_auc_score(yv, heuristic_prob) if yv.nunique() > 1 else np.nan,
            "pr_auc": average_precision_score(yv, heuristic_prob) if yv.nunique() > 1 else np.nan,
        }
    )
    prob_store["heuristic_baseline"] = heuristic_prob.values

    for name, estimator in models.items():
        pipe = Pipeline([("pre", pre), ("clf", estimator)])

        cv = cross_validate(
            pipe,
            X,
            yv,
            cv=skf,
            scoring={
                "recall": "recall",
                "f1": "f1",
                "precision": "precision",
                "roc_auc": "roc_auc",
                "pr_auc": "average_precision",
            },
            n_jobs=-1,
        )

        rows.append(
            {
                "target": target,
                "model": name,
                "recall": float(np.mean(cv["test_recall"])),
                "f1": float(np.mean(cv["test_f1"])),
                "precision": float(np.mean(cv["test_precision"])),
                "roc_auc": float(np.mean(cv["test_roc_auc"])),
                "pr_auc": float(np.mean(cv["test_pr_auc"])),
            }
        )

        p = cross_val_predict(pipe, X, yv, cv=skf, method="predict_proba", n_jobs=-1)[:, 1]
        prob_store[name] = p

    metrics_df = pd.DataFrame(rows).sort_values(
        ["target", "recall", "f1"], ascending=[True, False, False]
    )
    return model_df, metrics_df, prob_store


def fit_risk_pipeline(X: pd.DataFrame, y: pd.Series, seed: int = SEED) -> Pipeline:
    """Fit a single RandomForest pipeline on all rows (for serialization / scoring)."""
    pre = build_preprocessor(X)
    clf = RandomForestClassifier(
        n_estimators=400,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=seed,
    )
    pipe = Pipeline([("pre", pre), ("clf", clf)])
    pipe.fit(X, y.astype(int))
    return pipe
