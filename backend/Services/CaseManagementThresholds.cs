using System.Text.Json;
using Microsoft.AspNetCore.Hosting;

namespace HouseOfHope.API.Services;

/// <summary>Optional thresholds from Models/case_management_thresholds.json (written by export script).</summary>
public sealed class CaseManagementThresholds
{
    public double RiskDecisionThreshold { get; set; } = 0.5;
    public double ReintegrationDecisionThreshold { get; set; } = 0.4;
    public double RiskTierHigh { get; set; } = 0.65;
    public double RiskTierMedium { get; set; } = 0.35;
    public double CaseloadElevatedRisk { get; set; } = 0.45;
    public double CaseloadElevatedNlp { get; set; } = 0.5;
    public double NlpDistressThreshold { get; set; } = 0.25;

    public static CaseManagementThresholds LoadOrDefaults(IWebHostEnvironment env, ILogger<CaseManagementThresholds> logger)
    {
        try
        {
            var path = Path.Combine(env.ContentRootPath, "Models", "case_management_thresholds.json");
            if (!File.Exists(path))
                return new CaseManagementThresholds();
            var json = File.ReadAllText(path);
            var t = JsonSerializer.Deserialize<CaseManagementThresholds>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return t ?? new CaseManagementThresholds();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Using default case management thresholds.");
            return new CaseManagementThresholds();
        }
    }
}
