"""Sklearn preprocessing + random forest + calibration (notebook-aligned)."""

from __future__ import annotations

from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RANDOM_STATE = 42

FEATURE_COLS = [
    "lifetime_value_php",
    "gift_count",
    "gift_count_positive",
    "avg_gift_php",
    "max_gift_php",
    "days_since_last_gift",
    "days_since_first_gift",
    "days_between_first_last_gift",
    "campaign_diversity",
    "has_recurring",
    "freq_90d",
    "freq_180d",
    "freq_prior_90d",
    "freq_trend_ratio",
    "avg_gift_90d_php",
    "acquisition_channel",
    "primary_campaign",
]

NUMERIC_FEATURES = [c for c in FEATURE_COLS if c not in ("acquisition_channel", "primary_campaign")]
CATEGORICAL_FEATURES = ["acquisition_channel", "primary_campaign"]

CONTACT_RATE_DEFAULT = 0.2


def make_preprocess() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ]
    )


def make_rf_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocess", make_preprocess()),
            (
                "model",
                RandomForestClassifier(
                    n_estimators=400,
                    min_samples_leaf=2,
                    random_state=RANDOM_STATE,
                    class_weight="balanced",
                ),
            ),
        ]
    )


def fit_calibrated_churn_model(X_train, y_train) -> CalibratedClassifierCV:
    """Sigmoid calibration on top of the RF pipeline (matches notebook)."""
    est = CalibratedClassifierCV(
        estimator=make_rf_pipeline(),
        method="sigmoid",
        cv=3,
    )
    est.fit(X_train, y_train)
    return est
