namespace HouseOfHope.API.Contracts;

public class ResidentDto
{
    public string Id { get; set; } = "";
    public string CaseControlNumber { get; set; } = "";
    public string InternalCode { get; set; } = "";
    public string Safehouse { get; set; } = "";
    public string CaseStatus { get; set; } = "";
    public string CaseCategory { get; set; } = "";
    public List<string> CaseSubcategories { get; set; } = [];
    public string RiskLevel { get; set; } = "";
    public string AssignedSocialWorker { get; set; } = "";
    public string ReintegrationStatus { get; set; } = "";
    public string ReintegrationType { get; set; } = "";
    public string AdmissionDate { get; set; } = "";
    public string DateOfBirth { get; set; } = "";
    public string Religion { get; set; } = "";
    public string BirthStatus { get; set; } = "";
    public string PlaceOfBirth { get; set; } = "";
    public string ReferralSource { get; set; } = "";
    public string ReferringAgency { get; set; } = "";
    public string InitialAssessment { get; set; } = "";
    public bool Is4PsBeneficiary { get; set; }
    public bool IsSoloParent { get; set; }
    public string IndigenousGroup { get; set; } = "";
    public bool IsInformalSettler { get; set; }
    public bool ParentWithDisability { get; set; }
    public int? ReintegrationReadinessScore { get; set; }
    public CaseManagementPredictionDto? CasePrediction { get; set; }
}

public class CaseManagementPredictionDto
{
    public bool ModelAvailable { get; set; }
    public string ModelVersion { get; set; } = "";
    public string ScoredAtUtc { get; set; } = "";
    public double RiskEscalationProbability { get; set; }
    public string RiskEscalationTier { get; set; } = "";
    public bool RiskEscalationFlag { get; set; }
    public double ReintegrationSuccessProbability { get; set; }
    public bool ReintegrationLikelyWithin90d { get; set; }
    public List<string> RecommendedActions { get; set; } = [];
}

public class CounselingSessionDto
{
    public string Id { get; set; } = "";
    public string ResidentId { get; set; } = "";
    /// <summary>Populated on aggregate list endpoints (e.g. all process recordings).</summary>
    public string ResidentInternalCode { get; set; } = "";
    public string SessionDate { get; set; } = "";
    public string SocialWorker { get; set; } = "";
    public string SessionType { get; set; } = "";
    public int DurationMinutes { get; set; }
    public string EmotionalStateStart { get; set; } = "";
    public string EmotionalStateEnd { get; set; } = "";
    public string Narrative { get; set; } = "";
    public string Interventions { get; set; } = "";
    public string FollowUpActions { get; set; } = "";
    public bool ProgressNoted { get; set; }
    public bool ConcernsFlagged { get; set; }
}

public class VisitationDto
{
    public string Id { get; set; } = "";
    public string ResidentId { get; set; } = "";
    public string VisitDate { get; set; } = "";
    public string SocialWorker { get; set; } = "";
    public string VisitType { get; set; } = "";
    public string Location { get; set; } = "";
    public string FamilyMembersPresent { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string Observations { get; set; } = "";
    public string FamilyCooperationLevel { get; set; } = "";
    public bool SafetyConcernsNoted { get; set; }
    public bool FollowUpNeeded { get; set; }
    public string VisitOutcome { get; set; } = "";
}

public class InterventionPlanDto
{
    public string Id { get; set; } = "";
    public string ResidentId { get; set; } = "";
    /// <summary>Populated on aggregate list endpoints.</summary>
    public string ResidentInternalCode { get; set; } = "";
    public string PlanCategory { get; set; } = "";
    public string Description { get; set; } = "";
    public string ServicesProvided { get; set; } = "";
    public string TargetDate { get; set; } = "";
    public string Status { get; set; } = "";
    public string CaseConferenceDate { get; set; } = "";
}

public class SupporterDto
{
    public string Id { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public bool HasLinkedLogin { get; set; }
    public bool HasAdminRole { get; set; }
    public string SupporterType { get; set; } = "";
    public string Status { get; set; } = "";
    public string Country { get; set; } = "";
    public string AcquisitionChannel { get; set; } = "";
    public string FirstDonationDate { get; set; } = "";
    public string ChurnRisk { get; set; } = "";
}

public class UnlinkedLoginDto
{
    public string UserId { get; set; } = "";
    public string Email { get; set; } = "";
}

public class DonationDto
{
    public string Id { get; set; } = "";
    public string SupporterId { get; set; } = "";
    public string DonorName { get; set; } = "";
    public string Date { get; set; } = "";
    public string Type { get; set; } = "";
    public double? Amount { get; set; }
    public string? Currency { get; set; }
    public string? ItemDetails { get; set; }
    public double? Hours { get; set; }
    public string? SkillDescription { get; set; }
    public string? CampaignName { get; set; }
    public string? Notes { get; set; }
}

public class SocialMediaPostDto
{
    public string Id { get; set; } = "";
    public string Platform { get; set; } = "";
    public string PostType { get; set; } = "";
    public string MediaType { get; set; } = "";
    public string Date { get; set; } = "";
    public int Impressions { get; set; }
    public int Reach { get; set; }
    public double EngagementRate { get; set; }
    public int DonationReferrals { get; set; }
    public double EstimatedDonationValue { get; set; }
    public string ContentTopic { get; set; } = "";
    public string SentimentTone { get; set; } = "";
}

public class MonthlyTrendDto
{
    public string Month { get; set; } = "";
    public int Residents { get; set; }
    public double Donations { get; set; }
    public double Education { get; set; }
    public double Health { get; set; }
}

public class ImpactStatsDto
{
    public int TotalResidentsServed { get; set; }
    public double TotalDonationsReceived { get; set; }
    public int ReintegrationSuccessRate { get; set; }
    public int EducationEnrollmentRate { get; set; }
    public int HealthImprovementRate { get; set; }
    public int DonorRetentionRate { get; set; }
    public List<MonthlyTrendDto> MonthlyTrends { get; set; } = [];
}

public class DonationTypeSliceDto
{
    public string Name { get; set; } = "";
    public int Value { get; set; }
}

public class SafehousePerformanceDto
{
    public string Name { get; set; } = "";
    public int Residents { get; set; }
    public double Reintegration { get; set; }
    public double Education { get; set; }
}

public class ReintegrationByTypeDto
{
    public string Name { get; set; } = "";
    public double Rate { get; set; }
}

public class IncidentStackDto
{
    public string Type { get; set; } = "";
    public int Low { get; set; }
    public int Medium { get; set; }
    public int High { get; set; }
}

public class ReportsAnalyticsDto
{
    public ImpactStatsDto Summary { get; set; } = new();
    public List<DonationTypeSliceDto> DonationsByType { get; set; } = [];
    public List<SafehousePerformanceDto> SafehouseComparison { get; set; } = [];
    public List<ReintegrationByTypeDto> ReintegrationByType { get; set; } = [];
    public List<IncidentStackDto> IncidentsByType { get; set; } = [];
}

public class DashboardSummaryDto
{
    public List<ResidentDto> HighRiskResidents { get; set; } = [];
    public List<DonationDto> RecentDonations { get; set; } = [];
    public double MonthlyDonationsTotal { get; set; }
    public List<MonthlyTrendDto> EducationHealthTrend { get; set; } = [];
    public List<UpcomingConferenceDto> UpcomingConferences { get; set; } = [];
}

public class UpcomingConferenceDto
{
    public string Id { get; set; } = "";
    public string ResidentCode { get; set; } = "";
    public string Date { get; set; } = "";
    public string Type { get; set; } = "";
}
