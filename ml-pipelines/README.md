## FOR THE IS 455 TA'S GRADING OUR PROJECT

Each pipeline integrated into our site (4) is in this directory and we have explained them all below. Additionall supplemental pipelines are in the additional_notebooks directory

## Training data (CSV only — not SQLite / not Azure SQL)

- **Training and offline notebooks** should load Lighthouse data from **`backend/SeedData/*.csv`** (the same committed CSVs the API uses to seed local SQLite in development). Use `ml-pipelines/helpers/ml_data.py` → `resolve_seed_data_dir()` in Python scripts, or set **`ML_SEED_DATA_DIR`** to override the folder.
- **Do not** point training pipelines at `*.sqlite` files or at production Azure SQL. Azure hosts no SQLite files; coupling training to a local DB drifts from what ships and from what runs in the cloud.
- **Runtime inference** (the .NET API) correctly reads the **configured database** (SQLite in dev, SQL Server on Azure) so staff see scores against live data. That is separate from how you **train** exported ONNX/JSON artifacts.

When the **deployed API** is rolled back to an older build but **main** still contains newer schema or endpoints, production and the repo can be out of sync until you redeploy a matching build or migrate the database. Training from `SeedData` keeps a single file-based source of truth for regenerating models regardless of where the API runs.

---

## ML pipelines catalog (`ml-pipelines/*.ipynb` and `ml-pipelines/adidtional_notebooks/*.ipynb`)

Below, **predictive** means supervised models used for forecasting, ranking, or scores; **causal** means explicit causal identification (RCTs, IV, diff-in-diff, etc.). Unless stated otherwise, notebooks report **associational** patterns in observational data — useful for planning, not proof that changing one input *causes* an outcome.

### Integrated with the Lighthouse app (API / ONNX / committed artifacts)

`Donor_Churn_Analysis.ipynb` addresses the business problem of **prioritizing stewardship** when donors are at risk of lapsing (no meaningful gift in a forward window). It builds **time-respecting** features and labels, compares interpretable and high-performance models, and exports **`churn_model.onnx`** plus preprocessing metadata consumed by **`DonorChurnPredictionService`**. This is **predictive** scoring for operations (risk tiers, drivers), not causal attribution of why donors leave. The **frontend** surfaces churn tier on donor admin views and on **Reports & Analytics**.

`CaseManagement_Caseload_Ultimate.ipynb` supports **frontline case management**: early warning on **risk escalation**, **reintegration** signals, **NLP distress** on counseling notes, and a **caseload queue** narrative — aligned with `scripts/export_case_onnx.py` and **`CaseManagementPredictionService`** (multiple ONNX artifacts). It mixes **predictive** classifiers with **explanatory** interpretation (e.g. drivers of readiness) where the notebook calls that out; it does not establish causal effects of interventions. **Resident detail** and **Caseload Inventory** show model scores and recommended actions for authenticated staff.

`Safehouse_Performance_Analysis.ipynb` helps leadership **benchmark safehouses** on a composite outcome index versus operational intensity and caseload stress, exports **`safehouse_performance_model.onnx`** for **`SafehousePerformancePredictionService`**, and frames coefficients as **peer comparison**, not causal proof that increasing documentation *causes* better outcomes. The **Reports & Analytics** page consumes safehouse performance rows from the API for staff-facing comparison.

`SocialMedia_Growth_Analysis.ipynb` ties **social posts** to **engagement** and **referral-attributed giving**, uses **chronological** evaluation and leakage-aware feature sets, and feeds ONNX exports (**`social_media_engagement.onnx`**, **`social_media_donation.onnx`**) used by **`SocialMediaPredictionService`**. The analysis is **predictive** and associational (what correlates with referrals and engagement); causal claims require experiments. You can find this pipeline on the **Social Media** page in the Admin Dashboard, and the admin **Post Optimizer** calls **`/ML/social-media/predict`** for what-if scoring.

### Offline analysis, design, and supporting artifacts

`Home_Visitation_Explanatory_Decision_Tree.ipynb` targets **safe, productive home visits** by learning a **shallow decision tree** over visit features and turning splits into an **SOP-style checklist**. It is **explanatory** (readable rules for training and supervision), not a production risk score. It writes **`backend/Models/home_visit_sop_insights.json`** for intended API/caseload use; treat outputs as **associational** drivers, not causal. **Frontend wiring** for this JSON should be verified against the live API when exposed.

`CaseManagement_Analysis.ipynb` is an earlier **caseload decision-support** notebook: **risk escalation** and **reintegration** targets, heuristic vs ML comparisons, ethics and metrics — **predictive** in intent with interpretability sections that remain **non-causal**. It overlaps thematically with `CaseManagement_Caseload_Ultimate.ipynb`; the **Ultimate** notebook and export scripts are the path for **deployed** ONNX aligned with the .NET services.

`Donor_Analysis.ipynb` is a **fundraising and donor-ecosystem** study: segmentation, campaign and channel views, allocations to safehouses/programs, and social referral links. It is primarily **descriptive** and **exploratory**, with analyses that can inform **predictive** product choices but without shipping a single production classifier in this repo’s API surface.

`ML_Model_Design_Playbook.ipynb` is a **design brief**: it maps business questions to targets, features, leakage checks, and metrics across Lighthouse CSV domains so teams can **prioritize what to build**. It is not a deployed model pipeline; any “causal” language in course-style sections should be read as **planning guidance**, not identified causal estimates.

`Unified_Platform_System_Design.ipynb` is **systems narrative plus optional quantification**: how donors, residents, partners, and social outreach connect through shared entities (safehouses, allocations, monthly metrics). It supports **strategic communication** and data literacy; it is not predictive or causal modeling.
