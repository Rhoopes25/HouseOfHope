using System.Globalization;
using System.Text.Json;
using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace HouseOfHope.API.Services;

public sealed class DonorChurnPredictionResult
{
    public bool ModelAvailable { get; set; }
    public string ModelVersion { get; set; } = "churn-logreg-v1";
    public string ScoredAtUtc { get; set; } = "";
    public int SupporterId { get; set; }
    public double RiskScore { get; set; }
    public string RiskTier { get; set; } = "unknown";
    public List<string> TopDrivers { get; set; } = [];
    public List<string> RecommendedActions { get; set; } = [];
}

public sealed class DonorChurnPredictionService : IDisposable
{
    private readonly LighthouseDbContext _db;
    private readonly ILogger<DonorChurnPredictionService> _logger;
    private readonly InferenceSession? _session;
    private readonly ChurnPreprocessingMetadata? _meta;
    private readonly bool _modelAvailable;
    private bool _disposed;

    private const string ModelFileName = "churn_model.onnx";
    private const string MetadataFileName = "churn_preprocessing.json";

    public DonorChurnPredictionService(
        LighthouseDbContext db,
        IWebHostEnvironment env,
        ILogger<DonorChurnPredictionService> logger)
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
                    "Churn ONNX model or metadata not found. model={ModelPath} meta={MetaPath}",
                    modelPath, metaPath);
                _modelAvailable = false;
                return;
            }

            _session = new InferenceSession(modelPath);
            var metaJson = File.ReadAllText(metaPath);
            _meta = JsonSerializer.Deserialize<ChurnPreprocessingMetadata>(metaJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (_meta == null)
            {
                _logger.LogWarning("Failed to deserialize churn preprocessing metadata.");
                _modelAvailable = false;
                return;
            }

            _modelAvailable = true;
            _logger.LogInformation("DonorChurnPredictionService initialized. Features={Count}", _meta.NTransformedFeatures);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize DonorChurnPredictionService.");
            _modelAvailable = false;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────

    public async Task<DonorChurnPredictionResult> PredictForSupporterAsync(
        int supporterId, CancellationToken ct)
    {
        var supporter = await _db.Supporters
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.SupporterId == supporterId, ct);

        if (supporter == null)
            return BuildUnavailableResult(supporterId, "Supporter not found.");

        var donations = await _db.Donations
            .AsNoTracking()
            .Where(d => d.SupporterId == supporterId)
            .ToListAsync(ct);

        return Score(supporter, donations);
    }

    public async Task<Dictionary<int, DonorChurnPredictionResult>> PredictForAllSupportersAsync(
        CancellationToken ct)
    {
        var supporters = await _db.Supporters
            .AsNoTracking()
            .Where(s => s.Status == "Active")
            .ToListAsync(ct);

        if (supporters.Count == 0)
            return new Dictionary<int, DonorChurnPredictionResult>();

        var supporterIds = supporters.Select(s => s.SupporterId).ToList();
        var allDonations = await _db.Donations
            .AsNoTracking()
            .Where(d => supporterIds.Contains(d.SupporterId))
            .ToListAsync(ct);

        var donationsBySupporter = allDonations
            .GroupBy(d => d.SupporterId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return supporters.ToDictionary(
            s => s.SupporterId,
            s => Score(s, donationsBySupporter.GetValueOrDefault(s.SupporterId, [])));
    }

    // ── Feature engineering (mirrors Python notebook logic) ───────────────

    private DonorChurnPredictionResult Score(Supporter supporter, List<Donation> donations)
    {
        if (!_modelAvailable || _session == null || _meta == null)
            return BuildUnavailableResult(supporter.SupporterId, "Model unavailable.");

        try
        {
            var asOf = DateTime.UtcNow;
            var cutoff = asOf.AddDays(-90);

            // Only use donations up to cutoff (feature window)
            var histDonations = donations
                .Where(d => TryParseDate(d.DonationDate) <= cutoff)
                .ToList();

            var features = BuildRawFeatures(supporter, histDonations, cutoff);
            var transformed = ApplyPreprocessing(features);
            var riskScore = RunOnnx(transformed);

            return BuildResult(supporter.SupporterId, riskScore, features);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scoring supporter {SupporterId}", supporter.SupporterId);
            return BuildUnavailableResult(supporter.SupporterId, "Scoring error.");
        }
    }

    private static RawChurnFeatures BuildRawFeatures(
        Supporter supporter,
        List<Donation> histDonations,
        DateTime cutoff)
    {
        var positiveDonations = histDonations
            .Where(d => DonationValuePhp(d) > 0)
            .ToList();

        var lastGift = positiveDonations.Count > 0
            ? positiveDonations.Max(d => TryParseDate(d.DonationDate))
            : (DateTime?)null;

        var firstGift = positiveDonations.Count > 0
            ? positiveDonations.Min(d => TryParseDate(d.DonationDate))
            : (DateTime?)null;

        var daysSinceLast = lastGift.HasValue
            ? (float)(cutoff - lastGift.Value).TotalDays
            : float.NaN;

        var daysSinceFirst = firstGift.HasValue
            ? (float)(cutoff - firstGift.Value).TotalDays
            : float.NaN;

        var daysBetween = firstGift.HasValue && lastGift.HasValue
            ? (float)(lastGift.Value - firstGift.Value).TotalDays
            : 0f;

        var window90Start = cutoff.AddDays(-90);
        var window180Start = cutoff.AddDays(-180);

        var freq90d = positiveDonations.Count(d =>
        {
            var dt = TryParseDate(d.DonationDate);
            return dt > window90Start && dt <= cutoff;
        });

        var freq180d = positiveDonations.Count(d =>
        {
            var dt = TryParseDate(d.DonationDate);
            return dt > window180Start && dt <= cutoff;
        });

        var freqPrior90d = positiveDonations.Count(d =>
        {
            var dt = TryParseDate(d.DonationDate);
            return dt > window180Start && dt <= window90Start;
        });

        var freqTrendRatio = freqPrior90d > 0
            ? (float)freq90d / freqPrior90d
            : 0f;

        var recent90Gifts = positiveDonations
            .Where(d => TryParseDate(d.DonationDate) > window90Start)
            .Select(d => DonationValuePhp(d))
            .ToList();

        var avgGift90d = recent90Gifts.Count > 0
            ? (float)recent90Gifts.Average()
            : float.NaN;

        var allValues = positiveDonations.Select(d => DonationValuePhp(d)).ToList();
        var lifetimeValue = allValues.Count > 0 ? (float)allValues.Sum() : 0f;
        var avgGift = allValues.Count > 0 ? (float)allValues.Average() : 0f;
        var maxGift = allValues.Count > 0 ? (float)allValues.Max() : 0f;
        var hasRecurring = 0f; // IsRecurring not tracked in current schema

        var campaignNames = histDonations
            .Select(d => string.IsNullOrWhiteSpace(d.CampaignName) ? "(No campaign name)" : d.CampaignName)
            .Distinct()
            .Count();

        var primaryCampaign = histDonations
            .GroupBy(d => string.IsNullOrWhiteSpace(d.CampaignName) ? "(No campaign name)" : d.CampaignName)
            .OrderByDescending(g => g.Count())
            .FirstOrDefault()?.Key ?? "(No campaign name)";

        return new RawChurnFeatures
        {
            LifetimeValuePhp = lifetimeValue,
            GiftCount = histDonations.Count,
            GiftCountPositive = positiveDonations.Count,
            AvgGiftPhp = avgGift,
            MaxGiftPhp = maxGift,
            DaysSinceLastGift = daysSinceLast,
            DaysSinceFirstGift = daysSinceFirst,
            DaysBetweenFirstLastGift = daysBetween,
            Freq90d = freq90d,
            Freq180d = freq180d,
            FreqPrior90d = freqPrior90d,
            FreqTrendRatio = freqTrendRatio,
            AvgGift90dPhp = avgGift90d,
            CampaignDiversity = campaignNames,
            HasRecurring = hasRecurring,
            AcquisitionChannel = string.IsNullOrWhiteSpace(supporter.AcquisitionChannel)
                ? "Unknown" : supporter.AcquisitionChannel,
            PrimaryCampaign = primaryCampaign,
        };
    }

    // ── Preprocessing (mirrors Python: median impute → standard scale → OHE) ──

    private float[] ApplyPreprocessing(RawChurnFeatures f)
    {
        var numericRaw = new float[]
        {
            f.LifetimeValuePhp,
            f.GiftCount,
            f.GiftCountPositive,
            f.AvgGiftPhp,
            f.MaxGiftPhp,
            f.DaysSinceLastGift,
            f.DaysSinceFirstGift,
            f.DaysBetweenFirstLastGift,
            f.Freq90d,
            f.Freq180d,
            f.FreqPrior90d,
            f.FreqTrendRatio,
            f.AvgGift90dPhp,
            f.CampaignDiversity,
            f.HasRecurring,
        };

        // 1. Median imputation for NaN values
        var numericImputed = new float[numericRaw.Length];
        for (var i = 0; i < numericRaw.Length; i++)
        {
            numericImputed[i] = float.IsNaN(numericRaw[i])
                ? (float)_meta!.ImputerMedians[i]
                : numericRaw[i];
        }

        // 2. Standard scaling: (x - mean) / std
        var numericScaled = new float[numericRaw.Length];
        for (var i = 0; i < numericRaw.Length; i++)
        {
            var std = (float)_meta!.ScalerStds[i];
            numericScaled[i] = std > 0
                ? (numericImputed[i] - (float)_meta.ScalerMeans[i]) / std
                : 0f;
        }

        // 3. One-hot encode categorical features
        var catCats = _meta!.CategoricalCategories;
        var channelKey = catCats.Keys.FirstOrDefault(k => k.Equals("acquisition_channel", StringComparison.OrdinalIgnoreCase)) ?? "acquisition_channel";
        var campaignKey = catCats.Keys.FirstOrDefault(k => k.Equals("primary_campaign", StringComparison.OrdinalIgnoreCase)) ?? "primary_campaign";

        var channelOhe = OneHotEncode(f.AcquisitionChannel, catCats.GetValueOrDefault(channelKey, []));
        var campaignOhe = OneHotEncode(f.PrimaryCampaign, catCats.GetValueOrDefault(campaignKey, []));

        // Concatenate: [scaled numeric | channel OHE | campaign OHE]
        return [.. numericScaled, .. channelOhe, .. campaignOhe];
    }

    private static float[] OneHotEncode(string value, List<string> categories)
    {
        var vec = new float[categories.Count];
        var idx = categories.IndexOf(value);
        if (idx >= 0) vec[idx] = 1f;
        // unknown category → all zeros (handle_unknown='ignore' matches sklearn)
        return vec;
    }

    private double RunOnnx(float[] features)
    {
        var tensor = new DenseTensor<float>(features, [1, features.Length]);
        var inputName = _session!.InputMetadata.Keys.First();
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor(inputName, tensor)
        };

        using var outputs = _session.Run(inputs);
        
        // Get probabilities by name, not by index
        var probTensor = outputs.First(o => o.Name == "probabilities");
        var probs = probTensor.AsEnumerable<float>().ToArray();
        // probs = [prob_class_0, prob_class_1] — we want class 1 (churn)
        return Math.Clamp(probs.Length > 1 ? probs[1] : probs[0], 0.0, 1.0);
    }

    // ── Result building ────────────────────────────────────────────────────

    private DonorChurnPredictionResult BuildResult(
        int supporterId, double riskScore, RawChurnFeatures features)
    {
        var tier = ToRiskTier(riskScore);
        return new DonorChurnPredictionResult
        {
            ModelAvailable = true,
            ScoredAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            SupporterId = supporterId,
            RiskScore = Math.Round(riskScore, 4),
            RiskTier = tier,
            TopDrivers = BuildDrivers(features),
            RecommendedActions = BuildRecommendations(tier, features),
        };
    }

    private DonorChurnPredictionResult ToRiskTier_Test(double prob)
    {
        // Helper only used for building result — see ToRiskTier below
        throw new NotImplementedException();
    }

    private string ToRiskTier(double prob)
    {
        if (_meta == null) return "unknown";
        if (prob >= _meta.HighCut) return "high";
        if (prob >= _meta.MediumCut) return "medium";
        return "low";
    }

    private static List<string> BuildDrivers(RawChurnFeatures f)
    {
        var drivers = new List<string>();
        if (!float.IsNaN(f.DaysSinceLastGift) && f.DaysSinceLastGift > 90)
            drivers.Add($"No gift in {(int)f.DaysSinceLastGift} days");
        if (f.Freq90d == 0)
            drivers.Add("No gifts in last 90 days");
        if (f.FreqTrendRatio < 0.5f && f.FreqPrior90d > 0)
            drivers.Add("Giving frequency has declined recently");
        if (f.HasRecurring == 0)
            drivers.Add("No recurring donation set up");
        if (f.GiftCountPositive <= 1)
            drivers.Add("Only one prior gift on record");
        return drivers.Count > 0 ? drivers : ["No strong churn signals detected"];
    }

    private static List<string> BuildRecommendations(string tier, RawChurnFeatures f)
    {
        var actions = new List<string>();
        if (tier == "high")
            actions.Add("Priority outreach — personal call or handwritten note recommended.");
        else if (tier == "medium")
            actions.Add("Send a personalized impact update within the next two weeks.");
        else
            actions.Add("Maintain current stewardship cadence.");

        if (f.HasRecurring == 0)
            actions.Add("Invite to set up a recurring monthly gift.");
        if (f.Freq90d == 0 && f.Freq180d > 0)
            actions.Add("Re-engage with a campaign story matching their primary campaign interest.");
        return actions;
    }

    private static DonorChurnPredictionResult BuildUnavailableResult(int supporterId, string reason)
    {
        return new DonorChurnPredictionResult
        {
            ModelAvailable = false,
            ScoredAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            SupporterId = supporterId,
            RiskScore = 0,
            RiskTier = "unknown",
            RecommendedActions = [reason],
        };
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static double DonationValuePhp(Donation d)
    {
        if (d.DonationType == "Monetary" && d.Amount.HasValue)
            return (double)d.Amount.Value;
        if (d.DonationType == "InKind" && d.EstimatedValue.HasValue)
            return (double)d.EstimatedValue.Value;
        return 0.0;
    }

    private static DateTime TryParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return DateTime.MinValue;
        return DateTime.TryParse(raw, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var dt) ? dt : DateTime.MinValue;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _session?.Dispose();
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}

// ── Supporting types ───────────────────────────────────────────────────────

internal sealed class RawChurnFeatures
{
    public float LifetimeValuePhp { get; set; }
    public int GiftCount { get; set; }
    public int GiftCountPositive { get; set; }
    public float AvgGiftPhp { get; set; }
    public float MaxGiftPhp { get; set; }
    public float DaysSinceLastGift { get; set; }
    public float DaysSinceFirstGift { get; set; }
    public float DaysBetweenFirstLastGift { get; set; }
    public int Freq90d { get; set; }
    public int Freq180d { get; set; }
    public int FreqPrior90d { get; set; }
    public float FreqTrendRatio { get; set; }
    public float AvgGift90dPhp { get; set; }
    public int CampaignDiversity { get; set; }
    public float HasRecurring { get; set; }
    public string AcquisitionChannel { get; set; } = "Unknown";
    public string PrimaryCampaign { get; set; } = "(No campaign name)";
}

internal sealed class ChurnPreprocessingMetadata
{
    [System.Text.Json.Serialization.JsonPropertyName("numeric_features")]
    public List<string> NumericFeatures { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("categorical_features")]
    public List<string> CategoricalFeatures { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("imputer_medians")]
    public List<double> ImputerMedians { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("scaler_means")]
    public List<double> ScalerMeans { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("scaler_stds")]
    public List<double> ScalerStds { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("categorical_categories")]
    public Dictionary<string, List<string>> CategoricalCategories { get; set; } = [];
    
    [System.Text.Json.Serialization.JsonPropertyName("medium_cut")]
    public double MediumCut { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("high_cut")]
    public double HighCut { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("n_transformed_features")]
    public int NTransformedFeatures { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("model_version")]
    public string ModelVersion { get; set; } = "";
}