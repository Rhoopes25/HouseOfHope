"""Leakage-safe supporter features and panel construction (matches Donor_Churn_Analysis.ipynb)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def enrich_donations(donations_df: pd.DataFrame) -> pd.DataFrame:
    """Add value_php and has_positive_value (Monetary + InKind only)."""
    d = donations_df.copy()
    amt = pd.to_numeric(d.get("amount"), errors="coerce")
    est = pd.to_numeric(d.get("estimated_value"), errors="coerce")
    t = d["donation_type"].astype(str)
    d["value_php"] = np.where(
        t == "Monetary",
        amt.fillna(0.0).astype(float),
        np.where(t == "InKind", est.fillna(0.0).astype(float), 0.0),
    )
    d["has_positive_value"] = d["value_php"] > 0
    return d


def _count_positive_gifts_between(
    d: pd.DataFrame, supporter_ids: pd.Series, start: pd.Timestamp, end: pd.Timestamp
) -> pd.Series:
    mask = (d["donation_date"] > start) & (d["donation_date"] <= end) & d["has_positive_value"]
    sub = d.loc[mask]
    counts = sub.groupby("supporter_id").size()
    return supporter_ids.map(lambda x: int(counts.get(x, 0))).astype(int)


def build_supporter_features_at_cutoff(
    donations_df: pd.DataFrame,
    supporters_df: pd.DataFrame,
    cutoff: pd.Timestamp,
) -> pd.DataFrame:
    """Snapshot as of cutoff (inclusive): RFM-style + trend features."""
    d = donations_df.loc[donations_df["donation_date"] <= cutoff].copy()
    s = supporters_df.copy()

    agg = (
        d.groupby("supporter_id")
        .agg(
            lifetime_value_php=("value_php", "sum"),
            gift_count=("donation_id", "count"),
            gift_count_positive=("has_positive_value", "sum"),
            avg_gift_php=("value_php", "mean"),
            max_gift_php=("value_php", "max"),
            has_recurring=("is_recurring", "max"),
            first_gift=("donation_date", "min"),
            last_gift=("donation_date", "max"),
            campaign_diversity=("campaign_name", "nunique"),
        )
        .reset_index()
    )

    d_campaign = d.copy()
    d_campaign["campaign_name"] = (
        d_campaign["campaign_name"].fillna("(No campaign name)").replace("", "(No campaign name)")
    )
    dominant_campaign = (
        d_campaign.groupby(["supporter_id", "campaign_name"])["donation_id"]
        .count()
        .rename("campaign_count")
        .reset_index()
        .sort_values(["supporter_id", "campaign_count", "campaign_name"], ascending=[True, False, True])
        .drop_duplicates(subset=["supporter_id"])[["supporter_id", "campaign_name"]]
        .rename(columns={"campaign_name": "primary_campaign"})
    )

    snapshot = s.merge(agg, on="supporter_id", how="left").merge(dominant_campaign, on="supporter_id", how="left")

    snapshot["lifetime_value_php"] = snapshot["lifetime_value_php"].fillna(0.0)
    snapshot["gift_count"] = snapshot["gift_count"].fillna(0).astype(int)
    snapshot["gift_count_positive"] = snapshot["gift_count_positive"].fillna(0).astype(int)
    snapshot["avg_gift_php"] = snapshot["avg_gift_php"].fillna(0.0)
    snapshot["max_gift_php"] = snapshot["max_gift_php"].fillna(0.0)
    snapshot["campaign_diversity"] = snapshot["campaign_diversity"].fillna(0).astype(int)
    snapshot["has_recurring"] = snapshot["has_recurring"].fillna(False).astype(int)

    snapshot["days_since_last_gift"] = np.where(
        snapshot["last_gift"].notna(),
        (cutoff - snapshot["last_gift"]).dt.days,
        np.nan,
    )
    snapshot["days_since_first_gift"] = np.where(
        snapshot["first_gift"].notna(),
        (cutoff - snapshot["first_gift"]).dt.days,
        np.nan,
    )
    snapshot["days_between_first_last_gift"] = np.where(
        snapshot["first_gift"].notna() & snapshot["last_gift"].notna(),
        (snapshot["last_gift"] - snapshot["first_gift"]).dt.days,
        0,
    )

    w90_start = cutoff - pd.Timedelta(days=90)
    w180_start = cutoff - pd.Timedelta(days=180)
    sid = snapshot["supporter_id"]
    snapshot["freq_90d"] = _count_positive_gifts_between(donations_df, sid, w90_start, cutoff)
    snapshot["freq_180d"] = _count_positive_gifts_between(donations_df, sid, w180_start, cutoff)
    snapshot["freq_prior_90d"] = _count_positive_gifts_between(donations_df, sid, w180_start, w90_start)
    snapshot["freq_trend_ratio"] = snapshot["freq_90d"] / np.maximum(snapshot["freq_prior_90d"], 1.0)

    pos = d.loc[d["has_positive_value"]]
    avg_recent = pos.loc[pos["donation_date"] > w90_start].groupby("supporter_id")["value_php"].mean()
    snapshot["avg_gift_90d_php"] = sid.map(lambda x: float(avg_recent.get(x, np.nan)))

    snapshot["acquisition_channel"] = snapshot["acquisition_channel"].fillna("Unknown").replace("", "Unknown")
    snapshot["primary_campaign"] = (
        snapshot["primary_campaign"].fillna("(No campaign name)").replace("", "(No campaign name)")
    )
    return snapshot


def attach_churn_label(
    snapshot_at_cutoff: pd.DataFrame,
    donations_df: pd.DataFrame,
    cutoff: pd.Timestamp,
    as_of: pd.Timestamp,
) -> pd.DataFrame:
    """Label from (cutoff, as_of] — no feature leakage."""
    d = donations_df
    mask = (d["donation_date"] > cutoff) & (d["donation_date"] <= as_of) & d["has_positive_value"]
    future_positive = d.loc[mask].groupby("supporter_id")["value_php"].sum().rename("future_value_php")
    labeled = snapshot_at_cutoff.merge(future_positive, on="supporter_id", how="left")
    labeled["future_value_php"] = labeled["future_value_php"].fillna(0.0)
    labeled["churn"] = (labeled["future_value_php"] <= 0).astype(int)
    return labeled


def build_panel_dataset(
    donations_df: pd.DataFrame,
    supporters_df: pd.DataFrame,
    *,
    horizon_days: int,
    step_days: int,
    min_lead_days: int,
) -> pd.DataFrame:
    """
    Stack multiple observation dates for temporal validation.
    Each row: (supporter_id, observation_as_of) with features at cutoff = as_of - horizon.
    """
    min_d = donations_df["donation_date"].min().normalize()
    max_d = donations_df["donation_date"].max().normalize()
    start = min_d + pd.Timedelta(days=min_lead_days)
    obs_dates = pd.date_range(start=start, end=max_d, freq=f"{step_days}D")
    rows: list[pd.DataFrame] = []
    for as_of in obs_dates:
        cutoff = as_of - pd.Timedelta(days=horizon_days)
        snap = build_supporter_features_at_cutoff(donations_df, supporters_df, cutoff)
        labeled = attach_churn_label(snap, donations_df, cutoff, as_of)
        labeled = labeled[labeled["gift_count"] > 0].copy()
        labeled["observation_as_of"] = as_of
        labeled["feature_cutoff"] = cutoff
        rows.append(labeled)
    return pd.concat(rows, ignore_index=True)
