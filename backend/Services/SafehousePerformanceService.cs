using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace HouseOfHope.API.Services;

public sealed class SafehousePerformanceInsight
{
    public bool ModelAvailable { get; set; }
    public string ModelVersion { get; set; } = "";
    public string ScoredAtUtc { get; set; } = "";
    public int SafehouseId { get; set; }
    public string Name { get; set; } = "";
    public int ResidentCount { get; set; }
    /// <summary>Composite 0–100: reintegration, education, health, low-risk share, risk improvement.</summary>
    public double OutcomeIndex { get; set; }
    /// <summary>Ridge benchmark: expected outcome given operational + monthly metric profile.</summary>
    public double ExpectedOutcomeIndex { get; set; }
    /// <summary>Positive = outperforming peers with similar profile; negative = underperforming.</summary>
    public double PerformanceGap { get; set; }
    public string Tier { get; set; } = "unknown";
    public List<string> TopDrivers { get; set; } = [];
    public List<string> RecommendedActions { get; set; } = [];
}

/// <summary>
/// Benchmarks each safehouse (see ml-pipelines/Safehouse_Performance_Analysis.ipynb).
/// v2: initial risk, monthly_metrics aggregates, 9-feature Ridge ONNX.
/// </summary>
public sealed class SafehousePerformanceService : IDisposable
{
    private readonly LighthouseDbContext _db;
    private readonly ILogger<SafehousePerformanceService> _logger;
    private readonly InferenceSession? _session;
    private readonly SafehousePerformanceMetadata? _meta;
    private readonly bool _modelAvailable;
    private bool _disposed;

    private const string ModelFileName = "safehouse_performance_model.onnx";
    private const string MetadataFileName = "safehouse_performance_preprocessing.json";

    public SafehousePerformanceService(
        LighthouseDbContext db,
        IWebHostEnvironment env,
        ILogger<SafehousePerformanceService> logger)
    {
        _db = db;
        _logger = logger;

        try
        {
            var basePath = env.ContentRootPath;
            var modelPath = Path.Combine(basePath, "Models", ModelFileName);
            var metaPath = Path.Combine(basePath, "Models", MetadataFileName);

            if (!File.Exists(modelPath) || !File.Exists(metaPath))
            {
                _logger.LogWarning(
                    "Safehouse performance ONNX or metadata missing. model={ModelPath} meta={MetaPath}",
                    modelPath, metaPath);
                return;
            }

            _session = new InferenceSession(modelPath);
            var json = File.ReadAllText(metaPath);
            _meta = JsonSerializer.Deserialize<SafehousePerformanceMetadata>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (_meta?.FeatureNames == null || _meta.FeatureNames.Count == 0)
            {
                _logger.LogWarning("Safehouse performance metadata invalid.");
                return;
            }

            _modelAvailable = true;
            _logger.LogInformation("SafehousePerformanceService initialized ({Version})", _meta.ModelVersion);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize SafehousePerformanceService.");
        }
    }

    public async Task<List<SafehousePerformanceInsight>> ScoreAllSafehousesAsync(CancellationToken ct)
    {
        var houses = await _db.Safehouses.AsNoTracking()
            .OrderBy(s => s.SafehouseId)
            .ToListAsync(ct);

        if (houses.Count == 0)
            return [];

        var results = new List<SafehousePerformanceInsight>();

        foreach (var h in houses)
        {
            var insight = await ScoreOneAsync(h.SafehouseId, h.Name ?? $"Safehouse {h.SafehouseId}", ct);
            results.Add(insight);
        }

        return results.OrderByDescending(r => r.OutcomeIndex).ToList();
    }

    private async Task<SafehousePerformanceInsight> ScoreOneAsync(int safehouseId, string name, CancellationToken ct)
    {
        var residents = await _db.Residents.AsNoTracking()
            .Where(r => r.SafehouseId == safehouseId)
            .ToListAsync(ct);

        var ids = residents.Select(r => r.ResidentId).ToList();
        if (ids.Count == 0)
        {
            return Unavailable(safehouseId, name, "No residents assigned.");
        }

        var processCount = await _db.ProcessRecordings.AsNoTracking()
            .Where(p => ids.Contains(p.ResidentId))
            .CountAsync(ct);
        var visitCount = await _db.HomeVisitations.AsNoTracking()
            .Where(v => ids.Contains(v.ResidentId))
            .CountAsync(ct);

        var plans = await _db.InterventionPlans.AsNoTracking()
            .Where(p => ids.Contains(p.ResidentId))
            .ToListAsync(ct);
        var planTotal = plans.Count;
        var achieved = plans.Count(p =>
            string.Equals(p.Status, "Achieved", StringComparison.OrdinalIgnoreCase));
        var interventionAchieveRate = planTotal > 0 ? (float)achieved / planTotal : 0f;

        var n = residents.Count;
        var processPerRes = (float)processCount / n;
        var visitsPerRes = (float)visitCount / n;

        var complexityMean = (float)residents.Average(SubcatSum);

        var pctHighCrit = 100f * residents.Count(r =>
            IsHighOrCritical(r.CurrentRiskLevel)) / n;

        var eduRows = await _db.EducationRecords.AsNoTracking()
            .Where(e => ids.Contains(e.ResidentId) && e.ProgressPercent != null)
            .Select(e => e.ProgressPercent!.Value)
            .ToListAsync(ct);
        var avgEdu = eduRows.Count > 0 ? eduRows.Average() : 0.0;

        var hlRows = await _db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => ids.Contains(h.ResidentId) && h.GeneralHealthScore != null)
            .Select(h => h.GeneralHealthScore!.Value)
            .ToListAsync(ct);
        var avgHealth = hlRows.Count > 0 ? hlRows.Average() : 3.0;

        var pctReint = 100.0 * residents.Count(r =>
            string.Equals(r.ReintegrationStatus, "Completed", StringComparison.OrdinalIgnoreCase)) / n;
        var pctLow = 100.0 * residents.Count(r =>
            string.Equals(r.CurrentRiskLevel, "Low", StringComparison.OrdinalIgnoreCase)) / n;

        var riskImprovePct = MeanRiskImprovementPercent(residents);

        var outcomeIndex = ComputeOutcomeIndex(pctReint, avgEdu, avgHealth, pctLow, riskImprovePct);

        var (mEdu, mHealth, mInc) = await AggregateMonthlyMetricsAsync(safehouseId, ct);

        var rawFeatures = BuildFeatureVector(
            processPerRes,
            visitsPerRes,
            interventionAchieveRate,
            complexityMean,
            pctHighCrit,
            n,
            mEdu,
            mHealth,
            mInc);

        double expected = outcomeIndex;
        if (_modelAvailable && _session != null && _meta != null)
        {
            expected = RunOnnx(rawFeatures);
        }

        var gap = outcomeIndex - expected;

        var tier = ClassifyTier(outcomeIndex, gap, _meta);

        var drivers = BuildDrivers(rawFeatures, _meta, gap);
        var actions = BuildRecommendations(tier, gap, rawFeatures, _meta, drivers);

        return new SafehousePerformanceInsight
        {
            ModelAvailable = _modelAvailable,
            ModelVersion = _meta?.ModelVersion ?? "",
            ScoredAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            SafehouseId = safehouseId,
            Name = name,
            ResidentCount = n,
            OutcomeIndex = Math.Round(outcomeIndex, 2),
            ExpectedOutcomeIndex = Math.Round(expected, 2),
            PerformanceGap = Math.Round(gap, 2),
            Tier = tier,
            TopDrivers = drivers,
            RecommendedActions = actions
        };
    }

    private float[] BuildFeatureVector(
        float processPerRes,
        float visitsPerRes,
        float interventionAchieveRate,
        float complexityMean,
        float pctHighCrit,
        int nResidents,
        float monthlyEdu,
        float monthlyHealth,
        float monthlyInc)
    {
        var map = new Dictionary<string, float>(StringComparer.OrdinalIgnoreCase)
        {
            ["process_per_resident"] = processPerRes,
            ["visits_per_resident"] = visitsPerRes,
            ["intervention_achieve_rate"] = interventionAchieveRate,
            ["caseload_complexity"] = complexityMean,
            ["pct_high_critical_risk"] = pctHighCrit,
            ["n_residents"] = nResidents,
            ["monthly_avg_education_progress"] = monthlyEdu,
            ["monthly_avg_health_score"] = monthlyHealth,
            ["monthly_incident_rate"] = monthlyInc,
        };

        if (_meta?.FeatureNames == null || _meta.FeatureNames.Count == 0)
        {
            return map.Values.ToArray();
        }

        return _meta.FeatureNames.Select(k => map.GetValueOrDefault(k, 0f)).ToArray();
    }

    private async Task<(float Edu, float Health, float IncidentRate)> AggregateMonthlyMetricsAsync(
        int safehouseId,
        CancellationToken ct)
    {
        var rows = await _db.SafehouseMonthlyMetrics.AsNoTracking()
            .Where(m => m.SafehouseId == safehouseId)
            .ToListAsync(ct);

        if (rows.Count == 0)
            return (0f, 3f, 0f);

        var edus = new List<double>();
        var healths = new List<double>();
        double incSum = 0;
        var incN = 0;

        foreach (var r in rows)
        {
            var ar = Math.Max(r.ActiveResidents ?? 1, 1);
            var inc = (r.IncidentCount ?? 0) / (double)ar;
            incSum += inc;
            incN++;

            if (r.AvgEducationProgress.HasValue)
                edus.Add(r.AvgEducationProgress.Value);
            if (r.AvgHealthScore.HasValue)
                healths.Add(r.AvgHealthScore.Value);
        }

        var mEdu = edus.Count > 0 ? (float)edus.Average() : 0f;
        var mHl = healths.Count > 0 ? (float)healths.Average() : 3f;
        var mInc = incN > 0 ? (float)(incSum / incN) : 0f;
        return (mEdu, mHl, mInc);
    }

    /// <summary>Matches ml-pipelines/safehouse_train_export.py outcome_index.</summary>
    private static double ComputeOutcomeIndex(
        double pctReint,
        double avgEdu,
        double avgHealth,
        double pctLow,
        double riskImprovePct)
    {
        var eduTerm = Math.Min(100.0, avgEdu);
        var healthTerm = (avgHealth - 1.0) / 4.0 * 100.0;
        var v = 0.30 * pctReint
                + 0.22 * eduTerm
                + 0.18 * healthTerm
                + 0.15 * pctLow
                + 0.15 * riskImprovePct;
        return Math.Clamp(v, 0.0, 100.0);
    }

    private static double MeanRiskImprovementPercent(IReadOnlyList<Resident> residents)
    {
        double sum = 0;
        var n = 0;
        foreach (var r in residents)
        {
            var a = RiskOrd(r.InitialRiskLevel);
            var b = RiskOrd(r.CurrentRiskLevel);
            if (a < 0 || b < 0)
                continue;
            sum += Math.Max(0, a - b) / 3.0 * 100.0;
            n++;
        }

        return n > 0 ? sum / n : 0.0;
    }

    /// <summary>Low=0 … Critical=3; -1 if unknown.</summary>
    private static int RiskOrd(string? level)
    {
        if (string.IsNullOrWhiteSpace(level)) return -1;
        return level.Trim().ToLowerInvariant() switch
        {
            "low" => 0,
            "medium" => 1,
            "high" => 2,
            "critical" => 3,
            _ => -1
        };
    }

    private static int SubcatSum(Resident r) =>
        r.SubCatOrphaned + r.SubCatTrafficked + r.SubCatChildLabor + r.SubCatPhysicalAbuse +
        r.SubCatSexualAbuse + r.SubCatOsaec + r.SubCatCicl + r.SubCatAtRisk + r.SubCatStreetChild +
        r.SubCatChildWithHiv;

    private static bool IsHighOrCritical(string? risk) =>
        string.Equals(risk, "High", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(risk, "Critical", StringComparison.OrdinalIgnoreCase);

    private double RunOnnx(float[] raw)
    {
        var tensor = new DenseTensor<float>(raw, [1, raw.Length]);
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor("float_input", tensor)
        };

        using var outputs = _session!.Run(inputs);
        var first = outputs.First(o => o.Name == "variable");
        return first.AsEnumerable<float>().First();
    }

    private static string ClassifyTier(double outcome, double gap, SafehousePerformanceMetadata? meta)
    {
        if (meta == null) return "unknown";
        if (outcome >= meta.TierStrongCut && gap >= -5) return "strong";
        if (outcome < meta.TierAttentionCut || gap < -6) return "needs_attention";
        return "on_track";
    }

    private static float Feat(IReadOnlyList<string>? names, float[] raw, string key)
    {
        if (names == null) return 0f;
        for (var i = 0; i < names.Count; i++)
        {
            if (string.Equals(names[i], key, StringComparison.OrdinalIgnoreCase))
                return i < raw.Length ? raw[i] : 0f;
        }

        return 0f;
    }

    private static List<string> BuildDrivers(
        float[] raw,
        SafehousePerformanceMetadata? meta,
        double gap)
    {
        var list = new List<string>();
        if (meta?.NetworkMeans == null || meta.FeatureNames == null)
            return ["Insufficient metadata for driver text."];

        var names = meta.FeatureNames;
        var means = meta.NetworkMeans;

        var proc = Feat(names, raw, "process_per_resident");
        var vis = Feat(names, raw, "visits_per_resident");
        if (means.TryGetValue("process_per_resident", out var mp) && proc < mp - 5)
            list.Add(
                $"Counseling sessions per resident below network average ({proc:F1} vs typical {mp:F1})");
        if (means.TryGetValue("visits_per_resident", out var mv) && vis < mv - 5)
            list.Add(
                $"Home visits per resident below network average ({vis:F1} vs typical {mv:F1})");

        if (means.TryGetValue("intervention_achieve_rate", out var mi))
        {
            var ia = Feat(names, raw, "intervention_achieve_rate");
            if (ia < mi - 0.05)
                list.Add("Intervention plans are less often marked Achieved than peer sites");
        }

        var pctHi = Feat(names, raw, "pct_high_critical_risk");
        if (means.TryGetValue("pct_high_critical_risk", out var mh) && pctHi > mh + 8)
            list.Add("Higher share of High/Critical risk residents — harder caseload context");

        var mInc = Feat(names, raw, "monthly_incident_rate");
        if (means.TryGetValue("monthly_incident_rate", out var mic) && mInc > mic + 0.03)
            list.Add("Monthly incident intensity (per active resident) is elevated vs peer sites");

        if (gap < -4)
            list.Add($"Outcomes are below the model benchmark for this operational profile (gap {gap:F1} points)");

        if (gap > 4)
            list.Add($"Outcomes exceed the benchmark for similar practice intensity (gap +{gap:F1} points)");

        return list.Count > 0 ? list : ["No major deviations from network operational norms detected."];
    }

    private static List<string> BuildRecommendations(
        string tier,
        double gap,
        float[] raw,
        SafehousePerformanceMetadata? meta,
        List<string> drivers)
    {
        var actions = new List<string>();
        if (meta?.NetworkMeans == null || meta.FeatureNames == null) return actions;

        var names = meta.FeatureNames;
        var means = meta.NetworkMeans;
        var proc = Feat(names, raw, "process_per_resident");
        var vis = Feat(names, raw, "visits_per_resident");
        var ia = Feat(names, raw, "intervention_achieve_rate");

        if (tier == "needs_attention" || gap < -3)
        {
            actions.Add("Schedule a focused case review with regional leadership within two weeks.");
            if (means.TryGetValue("process_per_resident", out var mp) && proc < mp - 3)
                actions.Add(
                    "Increase structured counseling touchpoints (process recordings) toward peer levels — document sessions consistently.");
            if (means.TryGetValue("visits_per_resident", out var mv) && vis < mv - 3)
                actions.Add(
                    "Increase home / field visitations to strengthen family engagement and reintegration readiness.");
            if (means.TryGetValue("intervention_achieve_rate", out var mi) && ia < mi - 0.05)
                actions.Add(
                    "Review open intervention plans in case conference — close or update goals so Achieved status reflects real progress.");
            if (means.TryGetValue("monthly_incident_rate", out var mx))
            {
                var mir = Feat(names, raw, "monthly_incident_rate");
                if (mir > mx + 0.02)
                    actions.Add(
                        "Review incident patterns with staff — consider supplemental supervision or trauma-informed debriefs.");
            }
        }
        else if (tier == "strong")
        {
            actions.Add("Maintain current staffing and documentation practices — outcomes are strong.");
            actions.Add("Consider pairing this site’s lead social worker as a mentor for lower-performing locations.");
        }
        else
        {
            actions.Add("Continue quarterly monitoring; reinforce documentation quality for process recordings and visits.");
        }

        if (drivers.Any(d => d.Contains("High/Critical", StringComparison.OrdinalIgnoreCase)))
            actions.Add("Where caseload complexity is high, request supplemental psychosocial or education support.");

        return actions.Distinct().ToList();
    }

    private static SafehousePerformanceInsight Unavailable(int id, string name, string reason) => new()
    {
        ModelAvailable = false,
        SafehouseId = id,
        Name = name,
        TopDrivers = [reason],
        RecommendedActions = ["Add residents or verify safehouse configuration in the database."]
    };

    public void Dispose()
    {
        if (_disposed) return;
        _session?.Dispose();
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}

internal sealed class SafehousePerformanceMetadata
{
    [JsonPropertyName("model_version")]
    public string ModelVersion { get; set; } = "";

    [JsonPropertyName("feature_names")]
    public List<string> FeatureNames { get; set; } = [];

    [JsonPropertyName("network_means")]
    public Dictionary<string, double> NetworkMeans { get; set; } = [];

    [JsonPropertyName("tier_strong_cut")]
    public double TierStrongCut { get; set; }

    [JsonPropertyName("tier_attention_cut")]
    public double TierAttentionCut { get; set; }
}
