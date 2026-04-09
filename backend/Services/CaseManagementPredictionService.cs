using System.Globalization;
using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace HouseOfHope.API.Services;

public sealed class CaseManagementPredictionResult
{
    public bool ModelAvailable { get; set; }
    public string ModelVersion { get; set; } = "case-mgmt-v1";
    public string ScoredAtUtc { get; set; } = "";
    public double RiskEscalationProbability { get; set; }
    public string RiskEscalationTier { get; set; } = "unknown";
    public bool RiskEscalationFlag { get; set; }
    public double ReintegrationSuccessProbability { get; set; }
    public bool ReintegrationLikelyWithin90d { get; set; }
    public List<string> RecommendedActions { get; set; } = [];
}

public sealed class CaseManagementPredictionService
{
    private readonly LighthouseDbContext _db;
    private readonly ILogger<CaseManagementPredictionService> _logger;
    private readonly InferenceSession? _riskSession;
    private readonly InferenceSession? _reintegrationSession;
    private readonly bool _modelsAvailable;

    private const string RiskModelName = "case_risk_escalation.onnx";
    private const string ReintegrationModelName = "case_reintegration_success.onnx";
    private const double RiskDecisionThreshold = 0.50;
    private const double ReintegrationDecisionThreshold = 0.40;

    private static readonly string[] FeatureNames =
    [
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
        "health_trend_slope"
    ];

    public CaseManagementPredictionService(
        LighthouseDbContext db,
        IWebHostEnvironment env,
        ILogger<CaseManagementPredictionService> logger)
    {
        _db = db;
        _logger = logger;

        try
        {
            var basePath = env.ContentRootPath;
            var riskPath = Path.Combine(basePath, "Models", RiskModelName);
            var reintegrationPath = Path.Combine(basePath, "Models", ReintegrationModelName);

            if (!File.Exists(riskPath) || !File.Exists(reintegrationPath))
            {
                _logger.LogWarning(
                    "Case ONNX models not found. risk={RiskPath} reintegration={ReintegrationPath}",
                    riskPath,
                    reintegrationPath);
                _modelsAvailable = false;
                return;
            }

            _riskSession = new InferenceSession(riskPath);
            _reintegrationSession = new InferenceSession(reintegrationPath);
            ValidateInputs(_riskSession, "risk_escalation_30d");
            ValidateInputs(_reintegrationSession, "reintegration_success_90d");
            _modelsAvailable = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize CaseManagementPredictionService.");
            _modelsAvailable = false;
        }
    }

    public async Task<Dictionary<int, CaseManagementPredictionResult>> PredictForResidentsAsync(
        IEnumerable<Resident> residents,
        CancellationToken ct)
    {
        var list = residents.ToList();
        if (list.Count == 0)
            return new Dictionary<int, CaseManagementPredictionResult>();

        if (!_modelsAvailable || _riskSession == null || _reintegrationSession == null)
        {
            return list.ToDictionary(
                r => r.ResidentId,
                _ => BuildUnavailableResult());
        }

        var ids = list.Select(r => r.ResidentId).Distinct().ToList();
        var processRows = await _db.ProcessRecordings.AsNoTracking().Where(x => ids.Contains(x.ResidentId)).ToListAsync(ct);
        var visitRows = await _db.HomeVisitations.AsNoTracking().Where(x => ids.Contains(x.ResidentId)).ToListAsync(ct);
        var planRows = await _db.InterventionPlans.AsNoTracking().Where(x => ids.Contains(x.ResidentId)).ToListAsync(ct);
        var eduRows = await _db.EducationRecords.AsNoTracking().Where(x => ids.Contains(x.ResidentId)).ToListAsync(ct);
        var healthRows = await _db.HealthWellbeingRecords.AsNoTracking().Where(x => ids.Contains(x.ResidentId)).ToListAsync(ct);

        var outMap = new Dictionary<int, CaseManagementPredictionResult>(ids.Count);
        foreach (var resident in list)
        {
            var features = BuildFeatureVector(resident, processRows, visitRows, planRows, eduRows, healthRows);
            var score = Score(features);
            outMap[resident.ResidentId] = score;
        }

        return outMap;
    }

    public async Task<CaseManagementPredictionResult> PredictForResidentAsync(int residentId, CancellationToken ct)
    {
        var resident = await _db.Residents.AsNoTracking().FirstOrDefaultAsync(r => r.ResidentId == residentId, ct);
        if (resident == null)
            return BuildUnavailableResult();

        var map = await PredictForResidentsAsync([resident], ct);
        return map.GetValueOrDefault(residentId, BuildUnavailableResult());
    }

    private void ValidateInputs(InferenceSession session, string targetName)
    {
        var missing = FeatureNames.Where(name => !session.InputMetadata.ContainsKey(name)).ToList();
        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"ONNX input schema mismatch for {targetName}. Missing: {string.Join(", ", missing)}");
        }
    }

    private static float[] BuildFeatureVector(
        Resident resident,
        List<ProcessRecording> processRows,
        List<HomeVisitation> visitRows,
        List<InterventionPlan> planRows,
        List<EducationRecord> eduRows,
        List<HealthWellbeingRecord> healthRows)
    {
        var residentProcess = processRows.Where(x => x.ResidentId == resident.ResidentId).ToList();
        var residentVisits = visitRows.Where(x => x.ResidentId == resident.ResidentId).ToList();
        var residentPlans = planRows.Where(x => x.ResidentId == resident.ResidentId).ToList();
        var residentEdu = eduRows.Where(x => x.ResidentId == resident.ResidentId).ToList();
        var residentHealth = healthRows.Where(x => x.ResidentId == resident.ResidentId).ToList();

        var timeInProgramDays = DaysSince(resident.DateOfAdmission);
        var initialRiskNum = RiskToNumber(resident.CurrentRiskLevel);
        var isClosed = string.Equals(resident.CaseStatus, "Closed", StringComparison.OrdinalIgnoreCase) ? 1f : 0f;

        var prCount = residentProcess.Count;
        var prConcernRate = prCount == 0 ? 0f : residentProcess.Count(x => x.ConcernsFlagged != 0) / (float)prCount;

        var hvCount = residentVisits.Count;
        var hvUnfavorableRate = hvCount == 0
            ? 0f
            : residentVisits.Count(x => IsUnfavorable(x.VisitOutcome)) / (float)hvCount;

        var ipCount = residentPlans.Count;
        var ipCompletionRate = ipCount == 0
            ? 0f
            : residentPlans.Count(x => IsCompletedStatus(x.Status)) / (float)ipCount;

        // Incident-level resident columns are not currently exposed in this schema.
        var incidentCount = 0f;
        var highCriticalCount = 0f;
        var unresolvedRate = 0f;
        var incidentsLast30d = 0f;

        var eduSlope = ComputeSlope(
            residentEdu
                .Where(x => x.ProgressPercent.HasValue)
                .Select(x => (x.RecordDate, x.ProgressPercent!.Value))
                .ToList());

        var healthSlope = ComputeSlope(
            residentHealth
                .Where(x => x.GeneralHealthScore.HasValue)
                .Select(x => (x.RecordDate, x.GeneralHealthScore!.Value))
                .ToList());

        return
        [
            timeInProgramDays,
            initialRiskNum,
            isClosed,
            prCount,
            prConcernRate,
            hvCount,
            hvUnfavorableRate,
            ipCount,
            ipCompletionRate,
            incidentCount,
            highCriticalCount,
            unresolvedRate,
            incidentsLast30d,
            eduSlope,
            healthSlope
        ];
    }

    private CaseManagementPredictionResult Score(float[] features)
    {
        if (!_modelsAvailable || _riskSession == null || _reintegrationSession == null)
            return BuildUnavailableResult();

        var riskInputs = CreateInputs(features);
        using var riskOutputs = _riskSession.Run(riskInputs.Values);
        var riskProb = ClampProbability(riskOutputs.First().AsEnumerable<float>().FirstOrDefault());

        var reintegrationInputs = CreateInputs(features);
        using var reintegrationOutputs = _reintegrationSession.Run(reintegrationInputs.Values);
        var reintegrationProb = ClampProbability(reintegrationOutputs.First().AsEnumerable<float>().FirstOrDefault());

        var now = DateTime.UtcNow;
        return new CaseManagementPredictionResult
        {
            ModelAvailable = true,
            ScoredAtUtc = now.ToString("O", CultureInfo.InvariantCulture),
            RiskEscalationProbability = riskProb,
            RiskEscalationTier = ToRiskTier(riskProb),
            RiskEscalationFlag = riskProb >= RiskDecisionThreshold,
            ReintegrationSuccessProbability = reintegrationProb,
            ReintegrationLikelyWithin90d = reintegrationProb >= ReintegrationDecisionThreshold,
            RecommendedActions = BuildRecommendations(riskProb, reintegrationProb)
        };
    }

    private static string ToRiskTier(double probability)
    {
        if (probability >= 0.65) return "high";
        if (probability >= 0.35) return "medium";
        return "low";
    }

    private static List<string> BuildRecommendations(double riskProb, double reintegrationProb)
    {
        var recommendations = new List<string>();
        if (riskProb >= 0.65)
            recommendations.Add("Prioritize weekly supervision and immediate case conference scheduling.");
        else if (riskProb >= 0.35)
            recommendations.Add("Increase check-ins and review intervention plan progress this week.");
        else
            recommendations.Add("Maintain current cadence and monitor for new concerns.");

        if (reintegrationProb < 0.40)
            recommendations.Add("Strengthen reintegration supports and milestone tracking.");
        else
            recommendations.Add("Reintegration trajectory is favorable; continue current supports.");

        return recommendations;
    }

    private static Dictionary<string, NamedOnnxValue> CreateInputs(IReadOnlyList<float> features)
    {
        var dict = new Dictionary<string, NamedOnnxValue>(FeatureNames.Length);
        for (var i = 0; i < FeatureNames.Length; i++)
        {
            var tensor = new DenseTensor<float>(new[] { features[i] }, new[] { 1, 1 });
            dict[FeatureNames[i]] = NamedOnnxValue.CreateFromTensor(FeatureNames[i], tensor);
        }

        return dict;
    }

    private static double ClampProbability(float raw)
    {
        if (float.IsNaN(raw) || float.IsInfinity(raw)) return 0;
        return Math.Clamp(raw, 0f, 1f);
    }

    private static bool IsUnfavorable(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return v is "unfavorable" or "negative" or "failed";
    }

    private static bool IsCompletedStatus(string? value)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        return v is "achieved" or "closed" or "completed" or "done";
    }

    private static float RiskToNumber(string? risk)
    {
        return (risk ?? "").Trim().ToLowerInvariant() switch
        {
            "low" => 1f,
            "medium" => 2f,
            "high" => 3f,
            "critical" => 4f,
            _ => 2f
        };
    }

    private static float DaysSince(string? date)
    {
        if (!DateTime.TryParse(date, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
            return 0f;
        var span = DateTime.UtcNow.Date - parsed.Date;
        return (float)Math.Max(span.TotalDays, 0);
    }

    private static float ComputeSlope(List<(string? DateText, double Value)> series)
    {
        var points = series
            .Select(x => (Date: TryParseDate(x.DateText), x.Value))
            .Where(x => x.Date.HasValue)
            .OrderBy(x => x.Date!.Value)
            .Select((x, idx) => (X: (double)idx, Y: x.Value))
            .ToList();

        if (points.Count < 2) return 0f;
        var avgX = points.Average(p => p.X);
        var avgY = points.Average(p => p.Y);
        var denom = points.Sum(p => Math.Pow(p.X - avgX, 2));
        if (denom <= 0) return 0f;
        var numer = points.Sum(p => (p.X - avgX) * (p.Y - avgY));
        return (float)(numer / denom);
    }

    private static DateTime? TryParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dt)
            ? dt
            : null;
    }

    private static CaseManagementPredictionResult BuildUnavailableResult()
    {
        return new CaseManagementPredictionResult
        {
            ModelAvailable = false,
            ScoredAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            RiskEscalationProbability = 0,
            RiskEscalationTier = "unknown",
            RiskEscalationFlag = false,
            ReintegrationSuccessProbability = 0,
            ReintegrationLikelyWithin90d = false,
            RecommendedActions = ["Case model is unavailable. Check ONNX model files and startup logs."]
        };
    }
}
