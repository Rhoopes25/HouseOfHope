using System.Text.Json;
using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Services;

public static class HouseOfHopeMapper
{
    public static string ToCaseStatus(string? s) => (s ?? "Active").ToLowerInvariant() switch
    {
        "active" => "active",
        "closed" => "closed",
        "transferred" => "transferred",
        _ => "active"
    };

    public static string ToRisk(string? s) => (s ?? "Medium").ToLowerInvariant() switch
    {
        "low" => "low",
        "medium" => "medium",
        "high" => "high",
        "critical" => "critical",
        _ => "medium"
    };

    public static List<string> BuildSubcategories(Resident r)
    {
        var list = new List<string>();
        void Add(int flag, string slug) { if (flag != 0) list.Add(slug); }
        Add(r.SubCatOrphaned, "orphaned");
        Add(r.SubCatTrafficked, "trafficked");
        Add(r.SubCatChildLabor, "child-labor");
        Add(r.SubCatPhysicalAbuse, "physical-abuse");
        Add(r.SubCatSexualAbuse, "sexual-abuse");
        Add(r.SubCatOsaec, "OSAEC");
        Add(r.SubCatCicl, "cicl");
        Add(r.SubCatAtRisk, "at-risk");
        Add(r.SubCatStreetChild, "street-child");
        Add(r.SubCatChildWithHiv, "child-with-hiv");
        return list;
    }

    public static string MapSupporterType(string? raw) => raw switch
    {
        "MonetaryDonor" => "monetary",
        "InKindDonor" => "in-kind",
        "Volunteer" => "volunteer",
        "SkillsContributor" => "skills",
        "SocialMediaAdvocate" => "social-media",
        "PartnerOrganization" => "partner",
        _ => "monetary"
    };

    public static string MapDonationType(string? raw) => raw switch
    {
        "Monetary" => "monetary",
        "InKind" => "in-kind",
        "Time" => "time",
        "Skills" => "skills",
        "SocialMedia" => "social-media",
        _ => "monetary"
    };

    public static string MapPlanStatus(string? raw) => raw switch
    {
        "Open" => "pending",
        "In Progress" => "in-progress",
        "Achieved" or "Closed" => "completed",
        "On Hold" => "on-hold",
        _ => "pending"
    };

    public static string MapSessionType(string? raw) =>
        string.Equals(raw, "Group", StringComparison.OrdinalIgnoreCase) ? "group" : "individual";

    public static async Task<Dictionary<int, int>> GetReadinessScoresAsync(LighthouseDbContext db, List<int> ids)
    {
        if (ids.Count == 0) return new Dictionary<int, int>();
        var eduRows = await db.EducationRecords.AsNoTracking()
            .Where(e => ids.Contains(e.ResidentId))
            .ToListAsync();
        var healthRows = await db.HealthWellbeingRecords.AsNoTracking()
            .Where(h => ids.Contains(h.ResidentId))
            .ToListAsync();

        var dict = new Dictionary<int, int>();
        foreach (var id in ids)
        {
            var eProg = eduRows.Where(x => x.ResidentId == id)
                .OrderByDescending(x => x.RecordDate ?? "")
                .FirstOrDefault()?.ProgressPercent;
            var h = healthRows.Where(x => x.ResidentId == id)
                .OrderByDescending(x => x.RecordDate ?? "")
                .FirstOrDefault()?.GeneralHealthScore;
            var eduScore = eProg ?? 50.0;
            var healthScore = h.HasValue ? h.Value / 5.0 * 100.0 : 50.0;
            dict[id] = (int)Math.Clamp(Math.Round((eduScore + healthScore) / 2.0), 0, 100);
        }
        return dict;
    }

    public static ResidentDto ToResidentDto(
        Resident r,
        int readiness,
        CaseManagementPredictionResult? prediction = null)
    {
        return new ResidentDto
        {
            Id = r.ResidentId.ToString(),
            CaseControlNumber = r.CaseControlNo ?? "",
            InternalCode = r.InternalCode ?? "",
            Safehouse = r.Safehouse.Name ?? "",
            CaseStatus = ToCaseStatus(r.CaseStatus),
            CaseCategory = r.CaseCategory ?? "",
            CaseSubcategories = BuildSubcategories(r),
            RiskLevel = ToRisk(r.CurrentRiskLevel),
            AssignedSocialWorker = r.AssignedSocialWorker ?? "",
            ReintegrationStatus = r.ReintegrationStatus ?? "",
            ReintegrationType = r.ReintegrationType ?? "",
            AdmissionDate = r.DateOfAdmission ?? "",
            DateOfBirth = r.DateOfBirth ?? "",
            Religion = r.Religion ?? "",
            BirthStatus = r.BirthStatus ?? "",
            PlaceOfBirth = r.PlaceOfBirth ?? "",
            ReferralSource = r.ReferralSource ?? "",
            ReferringAgency = r.ReferringAgencyPerson ?? "",
            InitialAssessment = r.InitialCaseAssessment ?? "",
            Is4PsBeneficiary = r.FamilyIs4ps != 0,
            IsSoloParent = r.FamilySoloParent != 0,
            IndigenousGroup = r.FamilyIndigenous != 0 ? "Indigenous" : "",
            IsInformalSettler = r.FamilyInformalSettler != 0,
            ParentWithDisability = r.FamilyParentPwd != 0,
            ReintegrationReadinessScore = readiness,
            CasePrediction = prediction == null
                ? null
                : new CaseManagementPredictionDto
                {
                    ModelAvailable = prediction.ModelAvailable,
                    ModelVersion = prediction.ModelVersion,
                    ScoredAtUtc = prediction.ScoredAtUtc,
                    RiskEscalationProbability = prediction.RiskEscalationProbability,
                    RiskEscalationTier = prediction.RiskEscalationTier,
                    RiskEscalationFlag = prediction.RiskEscalationFlag,
                    ReintegrationSuccessProbability = prediction.ReintegrationSuccessProbability,
                    ReintegrationLikelyWithin90d = prediction.ReintegrationLikelyWithin90d,
                    RecommendedActions = prediction.RecommendedActions
                }
        };
    }

    /// <summary>metric_payload_json is stored as Python dict literals; convert quotes for JSON parsing.</summary>
    public static Dictionary<string, JsonElement>? ParseMetricPayload(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        try
        {
            var json = raw.Trim().Replace("'", "\"");
            return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
        }
        catch
        {
            return null;
        }
    }

    public static double HealthToPercent(double avgHealth)
    {
        // Observed scores ~3–4.5 on ~0–5 scale
        return Math.Clamp(avgHealth / 5.0 * 100.0, 0, 100);
    }
}
