"""Load Lighthouse CSV exports used by case management models."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


def resolve_data_dir(explicit: Path | None = None) -> Path:
    if explicit is not None and explicit.is_dir():
        return explicit.resolve()
    env = os.environ.get("HOUSE_OF_HOPE_CSV_DIR", "").strip()
    if env:
        p = Path(env)
        if p.is_dir():
            return p.resolve()
    root = Path.cwd()
    candidates = [
        root / "ml-pipelines" / "lighthouse_csv_v7",
        root / "ml-pipelines" / "lighthouse_csv",
        root / "lighthouse_csv_v7",
        root / "lighthouse_csv",
    ]
    for p in candidates:
        if p.is_dir():
            return p.resolve()
    raise FileNotFoundError(
        "Could not find data folder. Set HOUSE_OF_HOPE_CSV_DIR or pass explicit path. "
        f"Tried: {[str(c) for c in candidates]}"
    )


def load_csv_safe(data_dir: Path, filename: str, date_candidates: list[str]) -> pd.DataFrame:
    path = data_dir / filename
    sample = pd.read_csv(path, nrows=0)
    existing_dates = [c for c in date_candidates if c in sample.columns]
    return pd.read_csv(path, parse_dates=existing_dates)


@dataclass
class CaseTables:
    residents: pd.DataFrame
    process_recordings: pd.DataFrame
    home_visitations: pd.DataFrame
    education_records: pd.DataFrame
    health_wellbeing_records: pd.DataFrame
    intervention_plans: pd.DataFrame
    incident_reports: pd.DataFrame


def load_tables(data_dir: Path | None = None) -> CaseTables:
    d = resolve_data_dir(data_dir)
    residents = load_csv_safe(d, "residents.csv", ["date_of_admission", "date_enrolled", "date_closed"])
    process_recordings = load_csv_safe(
        d, "process_recordings.csv", ["recorded_on", "session_date", "created_at"]
    )
    home_visitations = load_csv_safe(d, "home_visitations.csv", ["visit_date", "created_at"])
    education_records = load_csv_safe(
        d, "education_records.csv", ["date_recorded", "record_date", "created_at"]
    )
    health_wellbeing_records = load_csv_safe(
        d, "health_wellbeing_records.csv", ["assessment_date", "record_date", "created_at"]
    )
    intervention_plans = load_csv_safe(
        d, "intervention_plans.csv", ["target_date", "created_at", "updated_at"]
    )
    incident_reports = load_csv_safe(d, "incident_reports.csv", ["incident_date", "resolution_date"])
    for df in (
        residents,
        process_recordings,
        home_visitations,
        education_records,
        health_wellbeing_records,
        intervention_plans,
        incident_reports,
    ):
        df.columns = [c.strip() for c in df.columns]
    return CaseTables(
        residents=residents,
        process_recordings=process_recordings,
        home_visitations=home_visitations,
        education_records=education_records,
        health_wellbeing_records=health_wellbeing_records,
        intervention_plans=intervention_plans,
        incident_reports=incident_reports,
    )
