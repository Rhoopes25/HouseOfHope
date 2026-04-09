using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;

namespace HouseOfHope.API.Services;

public class SocialMediaPredictionInput
{
    public int PostHour { get; set; } = 12;
    public int NumHashtags { get; set; } = 0;
    public int MentionsCount { get; set; } = 0;
    public int CaptionLength { get; set; } = 0;
    public float BoostBudgetPhp { get; set; } = 0;
    public int IsBoostedNum { get; set; } = 0;
    public int HasCallToActionNum { get; set; } = 0;
    public int FeaturesResidentStoryNum { get; set; } = 0;
    public int LexDonateHits { get; set; } = 0;
    public int LexUrgentHits { get; set; } = 0;
    public int LexGratitudeHits { get; set; } = 0;
    public int LexEmotionHits { get; set; } = 0;
    public float LexSentimentNet { get; set; } = 0;
    public int PriorPostsSamePlatform { get; set; } = 0;
    public float HoursSinceLastSamePlatform { get; set; } = -1;
    public string Platform { get; set; } = "Facebook";
    public string PostType { get; set; } = "ImpactStory";
    public string MediaType { get; set; } = "Photo";
    public string DayOfWeek { get; set; } = "Monday";
    public string CallToActionType { get; set; } = "unknown";
    public string ContentTopic { get; set; } = "DonorImpact";
    public string SentimentTone { get; set; } = "Hopeful";
}

public class SocialMediaPredictionResult
{
    public float EstimatedDonationValuePhp { get; set; }
    public float EngagementRate { get; set; }
    public List<string> Recommendations { get; set; } = new();
}

public class SocialMediaPredictionService
{
    private readonly ILogger<SocialMediaPredictionService> _logger;
    private readonly InferenceSession? _donationSession;
    private readonly InferenceSession? _engagementSession;
    private readonly bool _modelsAvailable;

    private static readonly string[] NumericFeatures = new[]
    {
        "post_hour", "num_hashtags", "mentions_count", "caption_length",
        "boost_budget_php", "is_boosted_num", "has_call_to_action_num",
        "features_resident_story_num", "lex_donate_hits", "lex_urgent_hits",
        "lex_gratitude_hits", "lex_emotion_hits", "lex_sentiment_net",
        "prior_posts_same_platform", "hours_since_last_same_platform"
    };

    private static readonly string[] CategoricalFeatures = new[]
    {
        "platform", "post_type", "media_type", "day_of_week",
        "call_to_action_type", "content_topic", "sentiment_tone"
    };

    public SocialMediaPredictionService(IWebHostEnvironment env, ILogger<SocialMediaPredictionService> logger)
    {
        _logger = logger;
        try
        {
            var basePath = env.ContentRootPath;
            var donationPath = Path.Combine(basePath, "Models", "social_media_donation.onnx");
            var engagementPath = Path.Combine(basePath, "Models", "social_media_engagement.onnx");
            if (!File.Exists(donationPath) || !File.Exists(engagementPath))
            {
                _logger.LogWarning(
                    "Social ONNX model file(s) missing. donation={DonationPath} engagement={EngagementPath}",
                    donationPath,
                    engagementPath);
                _modelsAvailable = false;
                return;
            }

            _donationSession = new InferenceSession(donationPath);
            _engagementSession = new InferenceSession(engagementPath);
            ValidateInputs(_donationSession, "social_media_donation");
            ValidateInputs(_engagementSession, "social_media_engagement");
            _modelsAvailable = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize social media ONNX inference sessions.");
            _modelsAvailable = false;
        }
    }

    public SocialMediaPredictionResult Predict(SocialMediaPredictionInput input)
    {
        if (!_modelsAvailable || _donationSession == null || _engagementSession == null)
            throw new InvalidOperationException("Social media prediction model is unavailable.");

        var inputs = BuildInputs(input);

        using var donationOutputs = _donationSession.Run(inputs);
        using var engagementOutputs = _engagementSession.Run(inputs);

        var donationValue = donationOutputs.First().AsEnumerable<float>().First();
        var engagementValue = engagementOutputs.First().AsEnumerable<float>().First();

        return new SocialMediaPredictionResult
        {
            EstimatedDonationValuePhp = donationValue,
            EngagementRate = engagementValue,
            Recommendations = GetRecommendations(input)
        };
    }

    private static void ValidateInputs(InferenceSession session, string modelName)
    {
        var missingNumeric = NumericFeatures.Where(name => !session.InputMetadata.ContainsKey(name)).ToList();
        var missingCategorical = CategoricalFeatures.Where(name => !session.InputMetadata.ContainsKey(name)).ToList();
        if (missingNumeric.Count > 0 || missingCategorical.Count > 0)
        {
            var missing = string.Join(", ", missingNumeric.Concat(missingCategorical));
            throw new InvalidOperationException($"ONNX input schema mismatch for {modelName}. Missing: {missing}");
        }
    }

    private List<NamedOnnxValue> BuildInputs(SocialMediaPredictionInput input)
    {
        var numericValues = new float[]
        {
            input.PostHour, input.NumHashtags, input.MentionsCount, input.CaptionLength,
            input.BoostBudgetPhp, input.IsBoostedNum, input.HasCallToActionNum,
            input.FeaturesResidentStoryNum, input.LexDonateHits, input.LexUrgentHits,
            input.LexGratitudeHits, input.LexEmotionHits, input.LexSentimentNet,
            input.PriorPostsSamePlatform, input.HoursSinceLastSamePlatform
        };

        var categoricalValues = new string[]
        {
            input.Platform, input.PostType, input.MediaType, input.DayOfWeek,
            input.CallToActionType, input.ContentTopic, input.SentimentTone
        };

        var onnxInputs = new List<NamedOnnxValue>();

        for (int i = 0; i < NumericFeatures.Length; i++)
        {
            var tensor = new DenseTensor<float>(new[] { numericValues[i] }, new[] { 1, 1 });
            onnxInputs.Add(NamedOnnxValue.CreateFromTensor(NumericFeatures[i], tensor));
        }

        for (int i = 0; i < CategoricalFeatures.Length; i++)
        {
            var tensor = new DenseTensor<string>(new[] { categoricalValues[i] }, new[] { 1, 1 });
            onnxInputs.Add(NamedOnnxValue.CreateFromTensor(CategoricalFeatures[i], tensor));
        }

        return onnxInputs;
    }

    private static List<string> GetRecommendations(SocialMediaPredictionInput input)
    {
        var tips = new List<string>();

        if (input.Platform is "YouTube" or "WhatsApp" or "TikTok")
            tips.Add("You picked a strong platform — donors are more active here");
        else if (input.Platform is "Twitter" or "LinkedIn")
            tips.Add("Try posting on YouTube, WhatsApp, or TikTok to reach more donors");
        else
            tips.Add("YouTube, WhatsApp, and TikTok tend to bring in more donations than Facebook");

        if (input.PostType is "ImpactStory" or "FundraisingAppeal")
            tips.Add("Great choice — posts that tell a story or ask for support raise the most money");
        else
            tips.Add("Posts that tell a girl's story or directly ask for support raise 2-3x more money");

        if (input.MediaType == "Video")
            tips.Add("Video is the best format for donations — keep it up");
        else
            tips.Add("Try using a video instead — it tends to bring in significantly more donations");

        if (input.PostHour is 19 or 20 or 11 or 18)
            tips.Add("Good timing — people are most likely to donate at this hour");
        else
            tips.Add("The best times to post are 11am and between 6-8pm");

        if (input.DayOfWeek is "Tuesday" or "Friday")
            tips.Add("Tuesday and Friday are your best days to post for donations");

        return tips;
    }
}