"""Case management ML: leakage-safe features, risk scoring, train/score CLI, optional FastAPI."""

from .data import load_tables, resolve_data_dir
from .features import RISK_MAP, build_feature_frame
from .labels import build_label
from .heuristic import heuristic_risk_score, to_risk_segment
from .modeling import (
    FEATURE_COLUMNS,
    build_preprocessor,
    evaluate_models,
    fit_risk_pipeline,
)

__all__ = [
    "resolve_data_dir",
    "load_tables",
    "RISK_MAP",
    "build_feature_frame",
    "build_label",
    "heuristic_risk_score",
    "to_risk_segment",
    "FEATURE_COLUMNS",
    "build_preprocessor",
    "evaluate_models",
    "fit_risk_pipeline",
]
