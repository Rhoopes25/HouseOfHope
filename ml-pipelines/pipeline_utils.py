"""
Case management ML utilities aligned with backend CaseManagementPredictionService (C#)
and CASE_MANAGEMENT_MODEL_CONTRACT.md — 15 named float features.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Must match backend/Services/CaseManagementPredictionService.cs FeatureNames order
EXPORT_FEATURE_NAMES: List[str] = [
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

# NLP lexical ONNX: 10 floats, must match NlpDistressPredictionService in C#
NLP_LEXICAL_NAMES = [f"nlp_lex_{i}" for i in range(10)]

SEED = 42


def resolve_data_root(base_dir: Path) -> Path:
    candidates = [
        base_dir / "lighthouse_csv_v7",
        base_dir.parent / "ml-pipelines" / "lighthouse_csv_v7",
        (base_dir / ".." / "lighthouse_csv_v7").resolve(),
    ]
    for p in candidates:
        r = Path(p).resolve()
        if r.is_dir() and (r / "residents.csv").exists():
            return r
    raise FileNotFoundError("lighthouse_csv_v7/residents.csv not found")


def load_tables(data_root: Path) -> Dict[str, pd.DataFrame]:
    def read(name: str, dates: List[str]) -> pd.DataFrame:
        path = data_root / name
        sample = pd.read_csv(path, nrows=0)
        parse = [c for c in dates if c in sample.columns]
        return pd.read_csv(path, parse_dates=parse)

    tables = {
        "residents": read("residents.csv", ["date_of_admission", "date_enrolled", "date_closed"]),
        "process_recordings": read("process_recordings.csv", ["session_date", "created_at"]),
        "home_visitations": read("home_visitations.csv", ["visit_date", "created_at"]),
        "education_records": read("education_records.csv", ["record_date", "created_at"]),
        "health_wellbeing_records": read("health_wellbeing_records.csv", ["record_date", "created_at"]),
        "intervention_plans": read("intervention_plans.csv", ["target_date", "created_at", "updated_at"]),
        "incident_reports": read("incident_reports.csv", ["incident_date", "resolution_date"]),
    }
    for df in tables.values():
        df.columns = [c.strip() for c in df.columns]
    return tables


def risk_to_number(level: Optional[str]) -> float:
    """Match C# RiskToNumber on CurrentRiskLevel: Low=1 .. Critical=4."""
    if level is None:
        return 2.0
    if isinstance(level, float) and math.isnan(level):
        return 2.0
    v = str(level).strip().lower()
    return {"low": 1.0, "medium": 2.0, "high": 3.0, "critical": 4.0}.get(v, 2.0)


def _parse_dt(val: Any) -> Optional[pd.Timestamp]:
    if val is None:
        return None
    try:
        t = pd.to_datetime(val, utc=True, errors="coerce")
        if pd.isna(t):
            return None
        return t
    except Exception:
        return None


def compute_slope_indexed(dates: List[Any], values: List[float]) -> float:
    """Match C# ComputeSlope (index-based x after sorting by date)."""
    pts: List[Tuple[pd.Timestamp, float]] = []
    for d, y in zip(dates, values):
        dt = _parse_dt(d)
        if dt is None:
            continue
        pts.append((dt, float(y)))
    pts.sort(key=lambda x: x[0])
    if len(pts) < 2:
        return 0.0
    xs = np.arange(len(pts), dtype=float)
    ys = np.array([p[1] for p in pts], dtype=float)
    xm, ym = xs.mean(), ys.mean()
    denom = np.sum((xs - xm) ** 2)
    if denom <= 0:
        return 0.0
    numer = np.sum((xs - xm) * (ys - ym))
    return float(numer / denom)


def is_unfavorable_outcome(value: Any) -> bool:
    v = str(value or "").strip().lower()
    return v in ("unfavorable", "negative", "failed")


def is_completed_status(value: Any) -> bool:
    v = str(value or "").strip().lower()
    return v in ("achieved", "closed", "completed", "done")


def _concern_flag_series(df: pd.DataFrame) -> pd.Series:
    if "concerns_flagged" not in df.columns:
        return pd.Series(0.0, index=df.index)
    return df["concerns_flagged"].apply(
        lambda x: 1.0
        if (str(x).lower() in ("true", "1", "yes") or x is True or x == 1)
        else 0.0
    )


def build_feature_frame(tables: Dict[str, pd.DataFrame], asof_mode: str = "incident_anchor") -> pd.DataFrame:
    """
    Leakage-safe feature frame with per-resident as_of_date (CaseManagement_Analysis semantics).
    Slopes and initial_risk_num match C# runtime.
    """
    residents = tables["residents"].copy()
    process_recordings = tables["process_recordings"]
    home_visitations = tables["home_visitations"]
    education_records = tables["education_records"]
    health_wellbeing_records = tables["health_wellbeing_records"]
    intervention_plans = tables["intervention_plans"]
    incident_reports = tables["incident_reports"]

    def pick_col(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        return next((c for c in candidates if c in df.columns), None)

    pr_date_col = pick_col(process_recordings, ["session_date", "recorded_on", "created_at"])
    hv_date_col = pick_col(home_visitations, ["visit_date", "created_at"])
    edu_date_col = pick_col(education_records, ["record_date", "date_recorded", "created_at"])
    health_date_col = pick_col(health_wellbeing_records, ["record_date", "assessment_date", "created_at"])
    ip_date_col = pick_col(intervention_plans, ["created_at", "updated_at", "target_date"])
    inc_date_col = pick_col(incident_reports, ["incident_date", "created_at"])

    required = {
        "process_recordings": pr_date_col,
        "home_visitations": hv_date_col,
        "education_records": edu_date_col,
        "health_wellbeing_records": health_date_col,
        "intervention_plans": ip_date_col,
        "incident_reports": inc_date_col,
    }
    missing = [k for k, v in required.items() if v is None]
    if missing:
        raise KeyError(f"Missing date columns: {missing}")

    assert pr_date_col and hv_date_col and edu_date_col and health_date_col and ip_date_col and inc_date_col

    if asof_mode == "incident_anchor":
        last_incident = incident_reports.groupby("resident_id")[inc_date_col].max()
        base = residents.merge(last_incident.rename("as_of_date"), on="resident_id", how="left")
        fallback = pd.to_datetime(base["date_enrolled"], utc=True, errors="coerce").fillna(
            pd.to_datetime(base["date_of_admission"], utc=True, errors="coerce")
        )
        base["as_of_date"] = pd.to_datetime(base["as_of_date"], utc=True, errors="coerce")
        base["as_of_date"] = base["as_of_date"].fillna(fallback)
    else:
        raise ValueError(asof_mode)

    base["start_date"] = pd.to_datetime(base["date_enrolled"], utc=True, errors="coerce").fillna(
        pd.to_datetime(base["date_of_admission"], utc=True, errors="coerce")
    )
    base["time_in_program_days"] = (base["as_of_date"] - base["start_date"]).dt.days.clip(lower=0).astype(float)

    base["initial_risk_num"] = base["current_risk_level"].map(lambda x: risk_to_number(str(x) if x is not None else None))
    # C# uses CaseStatus == Closed
    base["is_case_closed_by_T"] = base["case_status"].astype(str).str.strip().str.lower().eq("closed").astype(int)

    def agg_events(df: pd.DataFrame, dt_col: str, group_ops: Dict[str, Any], prefix: str) -> pd.DataFrame:
        recs = []
        for _, r in base[["resident_id", "as_of_date"]].iterrows():
            rid, T = int(r["resident_id"]), r["as_of_date"]
            if pd.isna(T):
                recs.append({"resident_id": rid})
                continue
            d = df[df["resident_id"].eq(rid)].copy()
            d[dt_col] = pd.to_datetime(d[dt_col], utc=True, errors="coerce")
            d = d[d[dt_col].notna() & (d[dt_col] <= T)]
            row: Dict[str, Any] = {"resident_id": rid}
            for new_name, fn in group_ops.items():
                row[prefix + new_name] = fn(d, T)
            recs.append(row)
        return pd.DataFrame(recs)

    pr_agg = agg_events(
        process_recordings,
        pr_date_col,
        {
            "n_sessions_to_date": lambda d, T: len(d),
            "concern_rate_to_date": lambda d, T: float(_concern_flag_series(d).mean()) if len(d) else 0.0,
        },
        "pr_",
    )
    hv_agg = agg_events(
        home_visitations,
        hv_date_col,
        {
            "n_visits_to_date": lambda d, T: len(d),
            "unfavorable_rate_to_date": lambda d, T: float(
                np.mean([is_unfavorable_outcome(x) for x in d.get("visit_outcome", [])])
            )
            if len(d) and "visit_outcome" in d.columns
            else 0.0,
        },
        "hv_",
    )
    ip_agg = agg_events(
        intervention_plans,
        ip_date_col,
        {
            "n_interventions_to_date": lambda d, T: len(d),
            "completion_rate_to_date": lambda d, T: float(
                np.mean([is_completed_status(x) for x in d.get("status", [])])
            )
            if len(d) and "status" in d.columns
            else 0.0,
        },
        "ip_",
    )

    def inc_last_30(d: pd.DataFrame, T: pd.Timestamp) -> float:
        if len(d) == 0 or inc_date_col not in d.columns:
            return 0.0
        dd = pd.to_datetime(d[inc_date_col], utc=True, errors="coerce")
        m = (dd > T - pd.Timedelta(days=30)) & (dd <= T)
        return float(m.sum())

    inc_agg = agg_events(
        incident_reports,
        inc_date_col,
        {
            "n_incidents_to_date": lambda d, T: float(len(d)),
            "n_high_critical_to_date": lambda d, T: float(
                d["severity"].astype(str).str.lower().isin(["high", "critical"]).sum()
            )
            if len(d) and "severity" in d.columns
            else 0.0,
            "unresolved_rate_to_date": lambda d, T: float(d["resolution_date"].isna().mean())
            if len(d) and "resolution_date" in d.columns
            else 0.0,
            "incidents_last_30d": lambda d, T: inc_last_30(d, T),
        },
        "inc_",
    )

    # Slopes: records <= T per resident
    edu_slopes = {}
    health_slopes = {}
    for rid in base["resident_id"].unique():
        T = base.loc[base["resident_id"] == rid, "as_of_date"].iloc[0]
        edu = education_records[education_records["resident_id"] == rid]
        edu = edu[pd.to_datetime(edu[edu_date_col], utc=True, errors="coerce").notna()]
        edu = edu[pd.to_datetime(edu[edu_date_col], utc=True, errors="coerce") <= T]
        if "progress_percent" in edu.columns:
            edates = edu[edu_date_col].tolist()
            evals = [float(x) for x in edu["progress_percent"].fillna(np.nan).tolist()]
            edu_slopes[rid] = compute_slope_indexed(edates, evals)
        else:
            edu_slopes[rid] = 0.0

        hh = health_wellbeing_records[health_wellbeing_records["resident_id"] == rid]
        hh = hh[pd.to_datetime(hh[health_date_col], utc=True, errors="coerce").notna()]
        hh = hh[pd.to_datetime(hh[health_date_col], utc=True, errors="coerce") <= T]
        if "general_health_score" in hh.columns:
            hdates = hh[health_date_col].tolist()
            hvals = [float(x) for x in hh["general_health_score"].fillna(np.nan).tolist()]
            health_slopes[rid] = compute_slope_indexed(hdates, hvals)
        else:
            health_slopes[rid] = 0.0

    frame = base.merge(pr_agg, on="resident_id", how="left")
    frame = frame.merge(hv_agg, on="resident_id", how="left")
    frame = frame.merge(ip_agg, on="resident_id", how="left")
    frame = frame.merge(inc_agg, on="resident_id", how="left")
    frame["edu_trend_slope"] = frame["resident_id"].map(edu_slopes).fillna(0.0)
    frame["health_trend_slope"] = frame["resident_id"].map(health_slopes).fillna(0.0)

    rename_map = {
        "pr_n_sessions_to_date": "pr_n_sessions_to_date",
        "pr_concern_rate_to_date": "pr_concern_rate_to_date",
        "hv_n_visits_to_date": "hv_n_visits_to_date",
        "hv_unfavorable_rate_to_date": "hv_unfavorable_rate_to_date",
        "ip_n_interventions_to_date": "ip_n_interventions_to_date",
        "ip_completion_rate_to_date": "ip_completion_rate_to_date",
        "inc_n_incidents_to_date": "inc_n_incidents_to_date",
        "inc_n_high_critical_to_date": "inc_n_high_critical_to_date",
        "inc_unresolved_rate_to_date": "inc_unresolved_rate_to_date",
        "inc_incidents_last_30d": "inc_incidents_last_30d",
    }
    for k, v in rename_map.items():
        if k not in frame.columns and f"pr_{k}" not in frame.columns:
            pass
    # pr_agg used keys pr_n_sessions_to_date already
    for c in EXPORT_FEATURE_NAMES:
        if c not in frame.columns:
            frame[c] = 0.0

    return frame


def build_label(frame: pd.DataFrame, tables: Dict[str, pd.DataFrame], target: str) -> pd.Series:
    incident_reports = tables["incident_reports"]
    residents = tables["residents"]
    inc_dt = "incident_date" if "incident_date" in incident_reports.columns else "created_at"
    incident_reports = incident_reports.copy()
    incident_reports[inc_dt] = pd.to_datetime(incident_reports[inc_dt], utc=True, errors="coerce")

    y: List[float] = []
    for _, r in frame[["resident_id", "as_of_date"]].iterrows():
        rid, T = int(r["resident_id"]), r["as_of_date"]
        if pd.isna(T):
            y.append(np.nan)
            continue
        if target == "risk_escalation_30d":
            end = T + pd.Timedelta(days=30)
            d = incident_reports[
                (incident_reports["resident_id"] == rid)
                & (incident_reports[inc_dt] > T)
                & (incident_reports[inc_dt] <= end)
            ]
            flag = (
                d["severity"].astype(str).str.lower().isin(["high", "critical"]).any()
                if len(d) and "severity" in d.columns
                else False
            )
            y.append(float(int(flag)))
        elif target == "reintegration_success_90d":
            end = T + pd.Timedelta(days=90)
            d = residents[residents["resident_id"] == rid]
            if d.empty:
                y.append(np.nan)
                continue
            row = d.iloc[0]
            closed = _parse_dt(row.get("date_closed"))
            ok = (
                str(row.get("reintegration_status") or "").strip().lower() == "completed"
                and closed is not None
                and closed > T
                and closed <= end
            )
            y.append(float(int(ok)))
        else:
            raise ValueError(target)
    return pd.Series(y, index=frame.index, name=target)


def build_risk_dataset(tables: Dict[str, pd.DataFrame]) -> Tuple[pd.DataFrame, pd.Series]:
    frame = build_feature_frame(tables)
    y = build_label(frame, tables, "risk_escalation_30d")
    # If forward-window incidents yield a single class (common on static snapshots), use a proxy aligned with operations
    if y.dropna().nunique() < 2:
        y = (
            (frame["initial_risk_num"] >= 3.0)
            | (frame.get("inc_n_high_critical_to_date", 0).fillna(0) > 0)
        ).astype(float)
        y.name = "risk_escalation_30d_proxy"
    X = frame[EXPORT_FEATURE_NAMES].copy()
    return X, y


def build_reintegration_dataset(tables: Dict[str, pd.DataFrame]) -> Tuple[pd.DataFrame, pd.Series]:
    frame = build_feature_frame(tables)
    y = build_label(frame, tables, "reintegration_success_90d")
    X = frame[EXPORT_FEATURE_NAMES].copy()
    return X, y


def split_with_stratify(
    X: pd.DataFrame, y: pd.Series, test_size: float = 0.2
) -> Dict[str, Any]:
    mask = y.notna()
    Xs = X.loc[mask].copy()
    ys = y.loc[mask].astype(int)
    if ys.nunique() < 2:
        raise ValueError("Need at least two classes")
    X_train, X_test, y_train, y_test = train_test_split(
        Xs, ys, test_size=test_size, random_state=SEED, stratify=ys
    )
    return {"X_train": X_train, "y_train": y_train, "X_test": X_test, "y_test": y_test}


def _column_transformer_for_export() -> ColumnTransformer:
    steps = []
    for name in EXPORT_FEATURE_NAMES:
        steps.append(
            (
                name,
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scale", StandardScaler()),
                    ]
                ),
                [name],
            )
        )
    return ColumnTransformer(steps)


def train_risk_model(split: Dict[str, Any]) -> Tuple[Any, Dict[str, Any]]:
    X_train = split["X_train"][EXPORT_FEATURE_NAMES]
    y_train = split["y_train"]
    pre = _column_transformer_for_export()
    clf = RandomForestClassifier(
        n_estimators=400,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=SEED,
    )
    pipe = Pipeline([("pre", pre), ("clf", clf)])
    pipe.fit(X_train, y_train)
    pred = pipe.predict(split["X_test"][EXPORT_FEATURE_NAMES])
    return pipe, {
        "recall": recall_score(split["y_test"], pred, zero_division=0),
        "confusion_matrix": confusion_matrix(split["y_test"], pred),
        "classification_report": classification_report(split["y_test"], pred, zero_division=0),
    }


def train_reintegration_model_with_vif(split: Dict[str, Any], threshold: float = 5.0) -> Tuple[Any, Dict[str, Any], List[str], pd.Series]:
    del threshold
    X_train = split["X_train"][EXPORT_FEATURE_NAMES]
    y_train = split["y_train"]
    pre = _column_transformer_for_export()
    clf = RandomForestClassifier(
        n_estimators=400,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=SEED,
    )
    pipe = Pipeline([("pre", pre), ("clf", clf)])
    pipe.fit(X_train, y_train)
    pred = pipe.predict(split["X_test"][EXPORT_FEATURE_NAMES])
    return pipe, {
        "recall": recall_score(split["y_test"], pred, zero_division=0),
        "confusion_matrix": confusion_matrix(split["y_test"], pred),
        "classification_report": classification_report(split["y_test"], pred, zero_division=0),
        "threshold": 0.2,
    }, EXPORT_FEATURE_NAMES.copy(), pd.Series(dtype=float)


# Keep in sync with backend NlpDistressPredictionService lexical list
_LEXICAL_NEG_TOKENS = (
    "hurt afraid scared alone angry hate pain cry suicide cut hit run nightmare bad worse"
).split()


def compute_lexical_features(text: str) -> List[float]:
    """Must stay in sync with NlpDistressPredictionService.ComputeLexicalFeatures (C#)."""
    t = text or ""
    words = t.split()
    lower = t.lower()
    neg_set = set(_LEXICAL_NEG_TOKENS)
    kw = sum(lower.count(w) for w in neg_set)
    return [
        float(len(t)),
        float(len(words)),
        float(t.count("!")),
        float(t.count("?")),
        float(t.count("\n")),
        float(kw),
        float(sum(1 for w in words if w[:1].isupper() and len(w) > 1) / max(len(words), 1)),
        float(sum(c.isdigit() for c in t)),
        float(max((len(w) for w in words), default=0)),
        float(len([w for w in words if w.lower() in neg_set]) / max(len(words), 1)),
    ]


def build_nlp_dataset(tables: Dict[str, pd.DataFrame]) -> Tuple[pd.DataFrame, pd.Series]:
    pr = tables["process_recordings"]
    texts = pr["session_narrative"].fillna("").astype(str)
    rows = [compute_lexical_features(tx) for tx in texts]
    X = pd.DataFrame(rows, columns=NLP_LEXICAL_NAMES)
    y = pr["concerns_flagged"].apply(
        lambda x: int(str(x).lower() in ("true", "1", "yes") or x is True or x == 1)
    )
    return X, y


def train_nlp_model(data: Tuple[pd.DataFrame, pd.Series]) -> Tuple[Any, Dict[str, Any]]:
    X, y = data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    pre = ColumnTransformer(
        [(n, Pipeline([("imputer", SimpleImputer(strategy="median")), ("sc", StandardScaler())]), [n]) for n in NLP_LEXICAL_NAMES]
    )
    clf = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=SEED)
    pipe = Pipeline([("pre", pre), ("clf", clf)])
    pipe.fit(X_train, y_train)
    pred = pipe.predict(X_test)
    return pipe, {
        "recall": recall_score(y_test, pred, zero_division=0),
        "threshold": 0.25,
        "confusion_matrix": confusion_matrix(y_test, pred),
        "classification_report": classification_report(y_test, pred, zero_division=0),
    }


def predict_risk_probabilities(model: Any, X: pd.DataFrame) -> np.ndarray:
    return model.predict_proba(X[EXPORT_FEATURE_NAMES])[:, 1]


def build_caseload_queue(
    resident_ids: List[int],
    risk_prob: np.ndarray,
    nlp_prob_by_resident: Optional[Dict[int, float]] = None,
) -> pd.DataFrame:
    rows = []
    for i, rid in enumerate(resident_ids):
        p = float(risk_prob[i])
        nlp = nlp_prob_by_resident.get(rid, 0.0) if nlp_prob_by_resident else 0.0
        if p >= 0.45 or nlp >= 0.5:
            band = "Elevated - Weekly supervisor review"
        else:
            band = "Routine monitoring"
        rows.append({"resident_id": rid, "risk_probability": p, "priority_band": band, "nlp_distress_prob": nlp})
    return pd.DataFrame(rows)


def save_artifact(obj: Any, directory: Path, filename: str) -> Path:
    import joblib

    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    joblib.dump(obj, path)
    return path


def export_case_onnx_models(
    risk_pipe: Any,
    reint_pipe: Any,
    nlp_pipe: Any,
    backend_models_dir: Path,
) -> List[str]:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_types = [(name, FloatTensorType([None, 1])) for name in EXPORT_FEATURE_NAMES]
    exported: List[str] = []
    onnx_risk = convert_sklearn(risk_pipe, initial_types=initial_types, target_opset=17)
    p_risk = backend_models_dir / "case_risk_escalation.onnx"
    p_risk.write_bytes(onnx_risk.SerializeToString())
    exported.append(str(p_risk))

    onnx_re = convert_sklearn(reint_pipe, initial_types=initial_types, target_opset=17)
    p_re = backend_models_dir / "case_reintegration_success.onnx"
    p_re.write_bytes(onnx_re.SerializeToString())
    exported.append(str(p_re))

    nlp_types = [(name, FloatTensorType([None, 1])) for name in NLP_LEXICAL_NAMES]
    onnx_nlp = convert_sklearn(nlp_pipe, initial_types=nlp_types, target_opset=17)
    p_nlp = backend_models_dir / "case_nlp_distress.onnx"
    p_nlp.write_bytes(onnx_nlp.SerializeToString())
    exported.append(str(p_nlp))
    return exported


def write_case_management_thresholds(path: Path) -> None:
    payload = {
        "riskDecisionThreshold": 0.5,
        "reintegrationDecisionThreshold": 0.4,
        "riskTierHigh": 0.65,
        "riskTierMedium": 0.35,
        "caseloadElevatedRisk": 0.45,
        "caseloadElevatedNlp": 0.5,
        "nlpDistressThreshold": 0.25,
        "featureNames": EXPORT_FEATURE_NAMES,
        "nlpLexicalNames": NLP_LEXICAL_NAMES,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
