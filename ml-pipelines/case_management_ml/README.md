# Case management ML (reference)

- **Notebook:** [`../CaseManagement_Caseload_Ultimate.ipynb`](../CaseManagement_Caseload_Ultimate.ipynb) — exploratory training and evaluation.
- **Shared module:** [`../helpers/pipeline_utils.py`](../helpers/pipeline_utils.py) — feature engineering aligned with the .NET `CaseManagementPredictionService` and ONNX contract.
- **Export:** [`../scripts/export_case_onnx.py`](../scripts/export_case_onnx.py) writes `case_risk_escalation.onnx`, `case_reintegration_success.onnx`, `case_nlp_distress.onnx`, and `case_management_thresholds.json` into `../../backend/Models/`.

Run export from the `ml-pipelines` directory:

```bash
python scripts/export_case_onnx.py
```
