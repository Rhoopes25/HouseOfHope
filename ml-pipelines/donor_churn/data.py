"""Load Lighthouse CSV exports for donor churn models."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from case_management.data import load_csv_safe, resolve_data_dir


@dataclass
class DonorTables:
    supporters: pd.DataFrame
    donations: pd.DataFrame


def load_tables(data_dir: Path | None = None) -> DonorTables:
    d = resolve_data_dir(data_dir)
    supporters = load_csv_safe(d, "supporters.csv", ["created_at", "first_donation_date"])
    donations = load_csv_safe(d, "donations.csv", ["donation_date"])
    for df in (supporters, donations):
        df.columns = [c.strip() for c in df.columns]
    return DonorTables(supporters=supporters, donations=donations)
