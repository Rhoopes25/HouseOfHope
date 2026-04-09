## Case Management ONNX Contract

This contract is derived from `ml-pipelines/CaseManagement_Analysis.ipynb` and is the
runtime schema expected by backend inference.

### Model Artifacts

- `Models/case_risk_escalation.onnx` (target: `risk_escalation_30d`)
- `Models/case_reintegration_success.onnx` (target: `reintegration_success_90d`)

### Input Features (float, shape `[1,1]` each)

1. `time_in_program_days`
2. `initial_risk_num`
3. `is_case_closed_by_T`
4. `pr_n_sessions_to_date`
5. `pr_concern_rate_to_date`
6. `hv_n_visits_to_date`
7. `hv_unfavorable_rate_to_date`
8. `ip_n_interventions_to_date`
9. `ip_completion_rate_to_date`
10. `inc_n_incidents_to_date`
11. `inc_n_high_critical_to_date`
12. `inc_unresolved_rate_to_date`
13. `inc_incidents_last_30d`
14. `edu_trend_slope`
15. `health_trend_slope`

### Thresholds

- `risk_escalation_30d`: default decision threshold `0.50`
- `reintegration_success_90d`: default decision threshold `0.40`
- risk segment bands:
  - High: `probability >= 0.65`
  - Medium: `probability >= 0.35` and `< 0.65`
  - Low: `< 0.35`

### Notes

- If model files are missing or ONNX input metadata does not match this schema,
  backend marks model availability as false and returns graceful fallback data.
