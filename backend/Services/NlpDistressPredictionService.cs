using System.Text.RegularExpressions;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace HouseOfHope.API.Services;

/// <summary>
/// Session-narrative distress scoring using lexical ONNX (aligned with ml-pipelines/pipeline_utils.compute_lexical_features).
/// </summary>
public sealed class NlpDistressPredictionService : IDisposable
{
    private readonly ILogger<NlpDistressPredictionService> _logger;
    private readonly InferenceSession? _session;
    private readonly bool _available;
    private bool _disposed;

    private const string ModelFileName = "case_nlp_distress.onnx";

    private static readonly string[] LexicalInputNames =
    [
        "nlp_lex_0", "nlp_lex_1", "nlp_lex_2", "nlp_lex_3", "nlp_lex_4",
        "nlp_lex_5", "nlp_lex_6", "nlp_lex_7", "nlp_lex_8", "nlp_lex_9"
    ];

    public NlpDistressPredictionService(IWebHostEnvironment env, ILogger<NlpDistressPredictionService> logger)
    {
        _logger = logger;
        try
        {
            var path = Path.Combine(env.ContentRootPath, "Models", ModelFileName);
            if (!File.Exists(path))
            {
                _logger.LogWarning("NLP distress ONNX not found at {Path}", path);
                return;
            }

            _session = new InferenceSession(path);
            foreach (var n in LexicalInputNames)
            {
                if (!_session.InputMetadata.ContainsKey(n))
                    throw new InvalidOperationException($"NLP ONNX missing input {n}");
            }

            _available = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load NLP distress model.");
        }
    }

    public bool IsAvailable => _available && _session != null;

    /// <summary>Concatenate narratives (newest first optional) — same text as training rows aggregated per resident.</summary>
    public (double probability, bool flag) PredictFromText(string? combinedNarrative, double nlpThreshold)
    {
        if (!_available || _session == null)
            return (0, false);

        var feats = ComputeLexicalFeatures(combinedNarrative);
        var inputs = new List<NamedOnnxValue>(LexicalInputNames.Length);
        for (var i = 0; i < LexicalInputNames.Length; i++)
        {
            var t = new DenseTensor<float>(new[] { feats[i] }, new[] { 1, 1 });
            inputs.Add(NamedOnnxValue.CreateFromTensor(LexicalInputNames[i], t));
        }

        using var results = _session.Run(inputs);
        var raw = SklearnOnnxOutputs.ExtractBinaryPositiveClassProbability(results);
        var p = ClampProb(raw);
        return (p, p >= nlpThreshold);
    }

    /// <summary>Must match Python pipeline_utils.compute_lexical_features exactly.</summary>
    public static float[] ComputeLexicalFeatures(string? text)
    {
        var t = text ?? "";
        var words = Regex.Split(t.Trim(), @"\s+", RegexOptions.None, TimeSpan.FromSeconds(1))
            .Where(s => s.Length > 0).ToArray();
        var lower = t.ToLowerInvariant();
        var neg = new[]
        {
            "hurt", "afraid", "scared", "alone", "angry", "hate", "pain", "cry", "suicide", "cut", "hit", "run",
            "nightmare", "bad", "worse"
        };
        var kw = neg.Sum(w => CountSubstring(lower, w));
        var upperTitleWords = words.Count(w => w.Length > 1 && char.IsUpper(w[0]));
        var wordCount = Math.Max(words.Length, 1);
        var negSet = new HashSet<string>(neg);
        return
        [
            t.Length,
            words.Length,
            t.Count(c => c == '!'),
            t.Count(c => c == '?'),
            t.Count(c => c == '\n'),
            kw,
            (float)upperTitleWords / wordCount,
            t.Count(char.IsDigit),
            words.Length == 0 ? 0 : words.Max(w => w.Length),
            (float)words.Count(w => negSet.Contains(w.ToLowerInvariant())) / wordCount
        ];
    }

    private static int CountSubstring(string haystack, string needle)
    {
        if (string.IsNullOrEmpty(needle)) return 0;
        var n = 0;
        for (var i = 0; i <= haystack.Length - needle.Length; i++)
        {
            if (string.CompareOrdinal(haystack, i, needle, 0, needle.Length) == 0)
                n++;
        }
        return n;
    }

    private static double ClampProb(float raw)
    {
        if (float.IsNaN(raw) || float.IsInfinity(raw)) return 0;
        return Math.Clamp(raw, 0f, 1f);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _session?.Dispose();
        _disposed = true;
        GC.SuppressFinalize(this);
    }
}
