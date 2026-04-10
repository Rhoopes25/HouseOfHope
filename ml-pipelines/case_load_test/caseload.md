This folder will contain a revised caseload notebooks. AI will keep all changes within the folder. data can be accessed in the loghthouse_csv_v7 folder.
To build the ultimate Case Management and Caseload notebook for Lighthouse Sanctuary, you need to align directly with the founders' primary operational worry: preventing girls from "falling through the cracks" and knowing when they are ready for reintegration or at risk of regression
.
Based on the INTEX case document and the rigorous textbook standards for machine learning pipelines, your notebook should be structured around the CRISP-DM framework and explicitly separate your predictive models from your explanatory models
.
Here is the blueprint for the best possible Case Management notebook, including the features, models, and ML best practices you must include:
Pipeline 1: The Risk Management Early-Warning System (Predictive)
Goal: Predict if a resident is at a high risk of regression or a severe safety incident within the next 30 days so social workers can intervene early
.
Target Variable: A binary label (1 = High/Critical Risk, 0 = Low/Medium Risk) derived either from the current_risk_level in the residents table or by flagging severe incidents (Runaway, Self-Harm) in the incident_reports table
.
Feature Engineering:
Health & Education: Calculate 30-day rolling averages for general_health_score, sleep_score, and attendance_rate from the health_wellbeing_records and education_records
.
Interventions & Sentiment: Count the number of active intervention_plans
. Extract shifts in emotional_state_observed (e.g., moving from 'Calm' to 'Distressed') from process_recordings
.
Preventing Target Leakage: You must strictly drop outcome-adjacent features. Remove date_closed, reintegration_status, and post-incident interventions from your training data, as these would not be known at the moment of prediction
.
Modeling & Evaluation: Use an ensemble model like a Random Forest or Gradient Boosting Classifier
. Because missing a high-risk girl is operationally disastrous, you must optimize and evaluate your model using Recall (to minimize false negatives) rather than simple Accuracy
.
Pipeline 2: Drivers of Reintegration Readiness (Explanatory)
Goal: Answer the specific INTEX prompt: "What factors most drive successful reintegration?"
. This will help the organization understand which programs actually heal residents.
Target Variable: reintegration_status ('Completed' vs others) or reintegration_type from the residents table
.
Feature Engineering:
Family Environment: Use the home_visitations table to create features for family_cooperation_level (e.g., Highly Cooperative vs Uncooperative) and safety_concerns_noted
.
Services Provided: Aggregate the intervention_plans table to count specific services_provided (e.g., Caring, Healing, Teaching, Legal)
.
Modeling & Evaluation: Use a highly interpretable model like Logistic Regression or Multiple Linear Regression (MLR)
.
Causal Rigor (VIF): Because this is an explanatory model meant to guide policy, you must check for multicollinearity using the Variance Inflation Factor (VIF). If features are highly correlated (e.g., 'Caring' services always increase alongside 'Healing' services), you must iteratively drop them until all VIFs are ≤ 5. Without this, your causal claims about what drives reintegration will be statistically invalid
.
Pipeline 3: NLP on Process Recordings (Predictive Text Analytics)
Goal: Uncover hidden signs of emotional distress in the social workers' free-text session narratives
.
Target Variable: concerns_flagged (True/False) or progress_noted in the process_recordings table
.
Feature Engineering: Extract the unstructured text from the session_narrative column
. Use textbook NLP techniques (tokenization, text hashing, or TF-IDF) to convert these written case notes into a matrix of structured numeric features
.
Actionable Outcome: Combine these text features with the session_type (Individual vs Group) to alert supervisors if a resident’s notes indicate quiet deterioration.
Mandatory Notebook Sections & ML Best Practices
To receive top marks based on the INTEX rubric, your notebook must include these structural elements:
The Scikit-Learn Pipeline: Do not clean your data loosely in the notebook. Build a strict sklearn Pipeline using ColumnTransformer, SimpleImputer (median for numeric, most_frequent for categorical), StandardScaler, and OneHotEncoder(handle_unknown='ignore'). Fit this pipeline only on your training data to completely eliminate data leakage
.
Stratified Train/Test Splits: Because critical risk cases and reintegration completions are likely minority classes, use train_test_split with stratify=y to ensure your training and holdout sets have proportional representation of these rare outcomes
.
Business Translation (Actionable Outputs): The INTEX case requires the ML outputs to integrate into the web app
. Conclude your notebook by writing a function that translates your model probabilities into a prioritized Caseload Inventory queue. For example: "Residents with a predicted risk score > 0.70 are flagged for mandatory Case Conferences within 48 hours."
.
Model Serialization: End your notebook by saving your completed pipeline using joblib.dump(). This proves you understand the deployment architecture, creating a .sav artifact that the .NET/React application can load to score new residents seamlessly
.