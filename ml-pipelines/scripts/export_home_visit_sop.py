#!/usr/bin/env python3
"""
CLI export for home_visit_sop_insights.json — mirrors the notebook pipeline.
Run from repo root or anywhere; uses ml-pipelines as anchor for data + backend paths.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeClassifier, export_text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from helpers.pipeline_utils import resolve_data_root  # noqa: E402

SEED = 42


def _boolish_series(s: pd.Series) -> pd.Series:
    if s.dtype == bool:
        return s.astype(np.int32)
    sl = s.astype(str).str.strip().str.lower()
    return (
        sl.map({"true": 1, "1": 1, "yes": 1, "false": 0, "0": 0, "no": 0, "": 0})
        .fillna(0)
        .astype(np.int32)
    )


def build_visit_outcome_label(visit_outcome: pd.Series) -> pd.Series:
    v = visit_outcome.astype(str).str.strip().str.lower()
    return (v == "favorable").astype(np.int32)


def engineer_family_flags(family_members_present: pd.Series) -> Tuple[pd.Series, pd.Series]:
    t = family_members_present.fillna("").astype(str).str.lower()
    has_parent = t.str.contains("parent", regex=False).astype(np.int32)
    has_sibling = t.str.contains("sibling", regex=False).astype(np.int32)
    return has_parent, has_sibling


def load_home_visitations_frame(data_root: Path | None = None) -> pd.DataFrame:
    root = data_root or resolve_data_root(ROOT)
    path = root / "home_visitations.csv"
    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]
    return df


def prepare_xy(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    has_parent, has_sibling = engineer_family_flags(df["family_members_present"])
    safety = _boolish_series(df["safety_concerns_noted"])
    loc = df["location_visited"].fillna("Unknown").astype(str)
    y = build_visit_outcome_label(df["visit_outcome"])
    X = pd.DataFrame(
        {
            "location_visited": loc,
            "safety_concerns_noted": safety,
            "has_parent": has_parent,
            "has_sibling": has_sibling,
        }
    )
    return X, y


def build_pipeline(max_depth: int = 3) -> Pipeline:
    categorical = ["location_visited"]
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical,
            ),
        ],
        remainder="passthrough",
    )
    clf = DecisionTreeClassifier(max_depth=max_depth, criterion="gini", random_state=SEED)
    return Pipeline([("prep", preprocessor), ("clf", clf)])


def _sop_item_from_feature(feat: str, importance: float, rank: int) -> Dict[str, Any]:
    f_low = feat.lower()
    if "safety" in f_low or "concern" in f_low:
        title, detail = "Safety screening", (
            "Before scheduling, confirm whether prior or contextual safety concerns are documented. "
            "The tree splits on safety flags early when they appear in historical patterns."
        )
    elif "parent" in f_low:
        title, detail = "Parental / guardian presence", (
            "Confirm a parent or legal guardian is expected or present when the visit plan indicates "
            "a parent role — structured guardian engagement aligns with more favorable visit patterns in this data."
        )
    elif "sibling" in f_low:
        title, detail = "Sibling presence", (
            "Note who else is in the home visit context; sibling presence is used as a structured "
            "signal for planning conversation dynamics, not as a fitness judgment."
        )
    elif "location" in f_low or "cat__" in f_low or "visited" in f_low:
        tail = feat.split("__")[-1] if "__" in feat else feat
        title, detail = "Location strategy", (
            f"Location category `{tail}` appears in the tree — align site choice with assessment type "
            "(neutral vs family home vs barangay office) per agency policy."
        )
    else:
        title = f"Factor {rank}: {feat[:60]}"
        detail = f"Model importance {importance:.3f}. This transformed input contributes to the explanatory splits."
    return {"step": rank, "title": title, "detail": detail, "feature": feat, "importance": float(importance)}


def build_sop_checklist(feature_names: np.ndarray, importances: np.ndarray) -> List[Dict[str, Any]]:
    pairs = sorted(zip(feature_names.tolist(), importances.tolist()), key=lambda x: -x[1])
    items: List[Dict[str, Any]] = []
    rank = 1
    for feat, imp in pairs:
        if imp <= 0:
            continue
        items.append(_sop_item_from_feature(feat, imp, rank))
        rank += 1
        if rank > 8:
            break
    anchors = [
        {
            "step": 0,
            "title": "Safety first",
            "detail": (
                "If safety concerns are documented for this address or household, require two staff "
                "or relocate to a neutral site per agency SOP before proceeding."
            ),
            "feature": "",
            "importance": 0.0,
        },
        {
            "step": 0,
            "title": "Confirm guardian attendance",
            "detail": (
                "When no parent/guardian is indicated in the visit plan, delay or reschedule until "
                "guardian attendance is confirmed unless emergency protocols apply."
            ),
            "feature": "",
            "importance": 0.0,
        },
    ]
    return anchors + items


def train_and_evaluate(
    X: pd.DataFrame, y: pd.Series, test_size: float = 0.2
) -> Tuple[Pipeline, Dict[str, Any], np.ndarray, np.ndarray]:
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=SEED
    )
    pipe = build_pipeline(max_depth=3)
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    metrics = {
        "accuracy": acc,
        "f1PositiveClass": f1,
        "confusionMatrix": cm.tolist(),
        "confusionLabels": {
            "rows": ["actual_unfavorable", "actual_favorable"],
            "cols": ["pred_unfavorable", "pred_favorable"],
        },
        "testSupport": {"n": int(len(y_test)), "favorableRate": float(y_test.mean())},
    }
    return pipe, metrics, y_test.values, y_pred


def export_insights_payload(pipe: Pipeline, metrics: Dict[str, Any]) -> Dict[str, Any]:
    prep = pipe.named_steps["prep"]
    clf = pipe.named_steps["clf"]
    feat_names = prep.get_feature_names_out()
    imps = clf.feature_importances_
    tree_text = export_text(clf, feature_names=list(feat_names))
    importance_rows = [
        {"feature": str(a), "importance": float(b)}
        for a, b in sorted(zip(feat_names, imps), key=lambda x: -x[1])
        if b > 0
    ]
    business_rules: List[str] = []
    for line in tree_text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("---"):
            business_rules.append(stripped)
    business_rules = business_rules[:25]
    sop = build_sop_checklist(feat_names, imps)
    return {
        "version": "1",
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "problemSummary": (
            "Explanatory decision tree (max_depth=3, gini) on home visit outcomes to surface "
            "drivers of favorable vs non-favorable visits for social-worker SOP planning — "
            "interpretability over raw predictive accuracy."
        ),
        "modelParams": {"maxDepth": 3, "criterion": "gini", "randomState": SEED},
        "metrics": metrics,
        "featureImportances": importance_rows,
        "businessRules": business_rules,
        "treeText": tree_text,
        "sopChecklist": sop,
        "notes": (
            "Explanatory model for rubric discussion only. Keep in sync with "
            "Home_Visitation_Explanatory_Decision_Tree.ipynb when changing logic."
        ),
    }


def export_json_to_backend(
    backend_models_dir: Path | None = None,
    data_root: Path | None = None,
) -> Path:
    if backend_models_dir is None:
        backend_models_dir = (ROOT.parent / "backend" / "Models").resolve()
    df = load_home_visitations_frame(data_root)
    X, y = prepare_xy(df)
    pipe, metrics, _, _ = train_and_evaluate(X, y)
    payload = export_insights_payload(pipe, metrics)
    backend_models_dir.mkdir(parents=True, exist_ok=True)
    out = backend_models_dir / "home_visit_sop_insights.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return out


if __name__ == "__main__":
    print(export_json_to_backend())
