"""Forward-window labels for supervised training (no feature leakage)."""

from __future__ import annotations

import pandas as pd


def build_label(
    frame: pd.DataFrame,
    residents: pd.DataFrame,
    incident_reports: pd.DataFrame,
    target: str = "risk_escalation_30d",
) -> pd.Series:
    inc_dt = next(
        (c for c in ["incident_date", "created_at"] if c in incident_reports.columns),
        None,
    )
    if inc_dt is None:
        raise KeyError("incident_reports must have incident_date or created_at for labels")

    y: list = []
    for _, r in frame[["resident_id", "as_of_date"]].iterrows():
        rid, T = r["resident_id"], r["as_of_date"]
        if pd.isna(T):
            y.append(float("nan"))
            continue
        if target == "risk_escalation_30d":
            end = T + pd.Timedelta(days=30)
            d = incident_reports[
                (incident_reports["resident_id"].eq(rid))
                & incident_reports[inc_dt].gt(T)
                & incident_reports[inc_dt].le(end)
            ]
            flag = (
                d.get("severity", pd.Series(dtype=str))
                .astype(str)
                .str.lower()
                .isin(["high", "critical"])
                .any()
            )
            y.append(int(flag))
        elif target == "reintegration_success_90d":
            end = T + pd.Timedelta(days=90)
            d = residents[residents["resident_id"].eq(rid)]
            completed = (
                d.get("reintegration_status", pd.Series(dtype=str))
                .astype(str)
                .str.lower()
                .eq("completed")
                & d.get("date_closed", pd.Series(dtype="datetime64[ns]")).gt(T)
                & d.get("date_closed", pd.Series(dtype="datetime64[ns]")).le(end)
            ).any()
            y.append(int(completed))
        else:
            raise ValueError("Unknown target")
    return pd.Series(y, index=frame.index, name=target)
