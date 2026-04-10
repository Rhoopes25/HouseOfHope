"""Train case management models and export ONNX + thresholds to backend/Models."""
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from helpers import pipeline_utils as pu  # noqa: E402


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    data_root = pu.resolve_data_root(root)
    tables = pu.load_tables(data_root)

    x_risk, y_risk = pu.build_risk_dataset(tables)
    risk_split = pu.split_with_stratify(x_risk, y_risk)
    risk_model, risk_metrics = pu.train_risk_model(risk_split)
    print("Risk metrics:", risk_metrics.get("recall"))

    x_re, y_re = pu.build_reintegration_dataset(tables)
    re_split = pu.split_with_stratify(x_re, y_re)
    re_model, re_metrics, _, _ = pu.train_reintegration_model_with_vif(re_split)
    print("Reintegration metrics:", re_metrics.get("recall"))

    nlp_data = pu.build_nlp_dataset(tables)
    nlp_model, nlp_metrics = pu.train_nlp_model(nlp_data)
    print("NLP metrics:", nlp_metrics.get("recall"))

    backend_models = root.parent / "backend" / "Models"
    backend_models.mkdir(parents=True, exist_ok=True)
    exported = pu.export_case_onnx_models(risk_model, re_model, nlp_model, backend_models)
    print("Exported:", exported)
    pu.write_case_management_thresholds(backend_models / "case_management_thresholds.json")


if __name__ == "__main__":
    main()
