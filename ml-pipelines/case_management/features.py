"""Leakage-safe resident feature matrix at prediction time T."""

from __future__ import annotations

import numpy as np
import pandas as pd

from case_management.data import CaseTables

RISK_MAP = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


def _safe_num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")


def _trend_slope(
    frame: pd.DataFrame, time_col: str, value_col: str, id_col: str = "resident_id"
) -> pd.Series:
    out: dict = {}
    tmp = frame[[id_col, time_col, value_col]].dropna().copy()
    tmp[time_col] = pd.to_datetime(tmp[time_col], errors="coerce")
    tmp[value_col] = _safe_num(tmp[value_col])
    tmp = tmp.dropna()
    for rid, grp in tmp.groupby(id_col):
        grp = grp.sort_values(time_col)
        if len(grp) < 2:
            out[rid] = 0.0
            continue
        x = (grp[time_col] - grp[time_col].min()).dt.days.values.astype(float)
        y = grp[value_col].values.astype(float)
        if np.allclose(x, x[0]):
            out[rid] = 0.0
        else:
            out[rid] = float(np.polyfit(x, y, 1)[0])
    return pd.Series(out, name=f"{value_col}_slope")


def _pick_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    return next((c for c in candidates if c in df.columns), None)


def build_feature_frame(tables: CaseTables, asof_mode: str = "incident_anchor") -> pd.DataFrame:
    residents = tables.residents
    process_recordings = tables.process_recordings
    home_visitations = tables.home_visitations
    education_records = tables.education_records
    health_wellbeing_records = tables.health_wellbeing_records
    intervention_plans = tables.intervention_plans
    incident_reports = tables.incident_reports

    base = residents.copy()

    pr_date_col = _pick_col(process_recordings, ["recorded_on", "session_date", "created_at"])
    hv_date_col = _pick_col(home_visitations, ["visit_date", "created_at"])
    edu_date_col = _pick_col(education_records, ["date_recorded", "record_date", "created_at"])
    health_date_col = _pick_col(health_wellbeing_records, ["assessment_date", "record_date", "created_at"])
    ip_date_col = _pick_col(intervention_plans, ["created_at", "updated_at", "target_date"])
    inc_date_col = _pick_col(incident_reports, ["incident_date", "created_at"])

    required = {
        "process_recordings": pr_date_col,
        "home_visitations": hv_date_col,
        "education_records": edu_date_col,
        "health_wellbeing_records": health_date_col,
        "intervention_plans": ip_date_col,
        "incident_reports": inc_date_col,
    }
    missing = [name for name, col in required.items() if col is None]
    if missing:
        raise KeyError(f"Missing expected date columns for tables: {missing}")

    assert pr_date_col and hv_date_col and edu_date_col and health_date_col and ip_date_col and inc_date_col

    if asof_mode == "incident_anchor":
        last_incident = incident_reports.groupby("resident_id")[inc_date_col].max()
        base["as_of_date"] = base["resident_id"].map(last_incident)
        fallback = base["date_enrolled"].fillna(base["date_of_admission"])
        base["as_of_date"] = base["as_of_date"].fillna(fallback)
    else:
        global_recent = pd.concat(
            [
                process_recordings.get(pr_date_col, pd.Series(dtype="datetime64[ns]")),
                home_visitations.get(hv_date_col, pd.Series(dtype="datetime64[ns]")),
                education_records.get(edu_date_col, pd.Series(dtype="datetime64[ns]")),
                health_wellbeing_records.get(health_date_col, pd.Series(dtype="datetime64[ns]")),
                intervention_plans.get(ip_date_col, pd.Series(dtype="datetime64[ns]")),
                incident_reports.get(inc_date_col, pd.Series(dtype="datetime64[ns]")),
            ]
        ).dropna().max()
        base["as_of_date"] = global_recent

    base["start_date"] = base["date_enrolled"].fillna(base["date_of_admission"])
    base["time_in_program_days"] = (base["as_of_date"] - base["start_date"]).dt.days
    base["time_in_program_days"] = base["time_in_program_days"].clip(lower=0)
    base["initial_risk_num"] = base["initial_risk_level"].map(RISK_MAP)
    base["is_case_closed_by_T"] = (
        base["date_closed"].notna() & (base["date_closed"] <= base["as_of_date"])
    ).astype(int)

    def agg_events(
        df: pd.DataFrame, dt_col: str, group_ops: dict, prefix: str = ""
    ) -> pd.DataFrame:
        recs = []
        for _, r in base[["resident_id", "as_of_date"]].iterrows():
            rid, T = r["resident_id"], r["as_of_date"]
            d = df[df["resident_id"].eq(rid)].copy()
            d = d[d[dt_col].notna()]
            d = d[d[dt_col] <= T]
            row = {"resident_id": rid}
            for new_name, fn in group_ops.items():
                row[prefix + new_name] = fn(d)
            recs.append(row)
        return pd.DataFrame(recs)

    pr_agg = agg_events(
        process_recordings,
        pr_date_col,
        {
            "n_sessions_to_date": lambda d: len(d),
            "concern_rate_to_date": lambda d: (
                d.get("progress_noted", pd.Series(dtype=str))
                .astype(str)
                .str.contains("concern|regress|worse", case=False, na=False)
            ).mean()
            if len(d)
            else 0.0,
        },
        prefix="pr_",
    )

    hv_agg = agg_events(
        home_visitations,
        hv_date_col,
        {
            "n_visits_to_date": lambda d: len(d),
            "unfavorable_rate_to_date": lambda d: (
                d.get("visit_outcome", pd.Series(dtype=str)).astype(str).str.lower().isin(
                    ["unfavorable", "negative", "failed"]
                )
            ).mean()
            if len(d)
            else 0.0,
        },
        prefix="hv_",
    )

    ip_agg = agg_events(
        intervention_plans,
        ip_date_col,
        {
            "n_interventions_to_date": lambda d: len(d),
            "completion_rate_to_date": lambda d: (
                d.get("status", pd.Series(dtype=str)).astype(str).str.lower().isin(
                    ["completed", "done", "closed"]
                )
            ).mean()
            if len(d)
            else 0.0,
        },
        prefix="ip_",
    )

    inc_agg = agg_events(
        incident_reports,
        inc_date_col,
        {
            "n_incidents_to_date": lambda d: len(d),
            "n_high_critical_to_date": lambda d: d.get("severity", pd.Series(dtype=str))
            .astype(str)
            .str.lower()
            .isin(["high", "critical"])
            .sum(),
            "unresolved_rate_to_date": lambda d: d.get(
                "resolution_date", pd.Series(dtype="datetime64[ns]")
            )
            .isna()
            .mean()
            if len(d)
            else 0.0,
            "incidents_last_30d": lambda d, _icol=inc_date_col: (
                (d[_icol] > (d[_icol].max() - pd.Timedelta(days=30))).sum() if len(d) else 0
            ),
        },
        prefix="inc_",
    )

    edu = education_records[["resident_id", edu_date_col]].copy()
    if "performance_score" in education_records.columns:
        edu["value"] = _safe_num(education_records["performance_score"])
    elif "progress_percent" in education_records.columns:
        edu["value"] = _safe_num(education_records["progress_percent"])
    elif "attendance_rate" in education_records.columns:
        edu["value"] = _safe_num(education_records["attendance_rate"])
    else:
        edu["value"] = np.nan
    edu = edu.rename(columns={edu_date_col: "dt"})

    health = health_wellbeing_records[["resident_id", health_date_col]].copy()
    if "wellbeing_score" in health_wellbeing_records.columns:
        health["value"] = _safe_num(health_wellbeing_records["wellbeing_score"])
    elif "general_health_score" in health_wellbeing_records.columns:
        health["value"] = _safe_num(health_wellbeing_records["general_health_score"])
    elif "mental_health_score" in health_wellbeing_records.columns:
        health["value"] = _safe_num(health_wellbeing_records["mental_health_score"])
    else:
        health["value"] = np.nan
    health = health.rename(columns={health_date_col: "dt"})

    edu_slope = _trend_slope(edu, "dt", "value")
    health_slope = _trend_slope(health, "dt", "value")

    frame = (
        base.merge(pr_agg, on="resident_id", how="left")
        .merge(hv_agg, on="resident_id", how="left")
        .merge(ip_agg, on="resident_id", how="left")
        .merge(inc_agg, on="resident_id", how="left")
    )

    frame["edu_trend_slope"] = frame["resident_id"].map(edu_slope).fillna(0.0)
    frame["health_trend_slope"] = frame["resident_id"].map(health_slope).fillna(0.0)

    num_cols = [
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

    for c in num_cols:
        if c not in frame.columns:
            frame[c] = np.nan

    return frame
