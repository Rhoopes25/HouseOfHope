using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HouseOfHope.API.Data;

public class Safehouse
{
    [Key, Column("safehouse_id")]
    public int SafehouseId { get; set; }
    [Column("name")]
    public string? Name { get; set; }
}

public class Resident
{
    [Key, Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("case_control_no")]
    public string? CaseControlNo { get; set; }
    [Column("internal_code")]
    public string? InternalCode { get; set; }
    [Column("safehouse_id")]
    public int SafehouseId { get; set; }
    public Safehouse Safehouse { get; set; } = null!;
    [Column("case_status")]
    public string? CaseStatus { get; set; }
    [Column("case_category")]
    public string? CaseCategory { get; set; }
    [Column("sub_cat_orphaned")]
    public int SubCatOrphaned { get; set; }
    [Column("sub_cat_trafficked")]
    public int SubCatTrafficked { get; set; }
    [Column("sub_cat_child_labor")]
    public int SubCatChildLabor { get; set; }
    [Column("sub_cat_physical_abuse")]
    public int SubCatPhysicalAbuse { get; set; }
    [Column("sub_cat_sexual_abuse")]
    public int SubCatSexualAbuse { get; set; }
    [Column("sub_cat_osaec")]
    public int SubCatOsaec { get; set; }
    [Column("sub_cat_cicl")]
    public int SubCatCicl { get; set; }
    [Column("sub_cat_at_risk")]
    public int SubCatAtRisk { get; set; }
    [Column("sub_cat_street_child")]
    public int SubCatStreetChild { get; set; }
    [Column("sub_cat_child_with_hiv")]
    public int SubCatChildWithHiv { get; set; }
    [Column("current_risk_level")]
    public string? CurrentRiskLevel { get; set; }
    [Column("assigned_social_worker")]
    public string? AssignedSocialWorker { get; set; }
    [Column("reintegration_status")]
    public string? ReintegrationStatus { get; set; }
    [Column("reintegration_type")]
    public string? ReintegrationType { get; set; }
    [Column("date_of_admission")]
    public string? DateOfAdmission { get; set; }
    [Column("date_of_birth")]
    public string? DateOfBirth { get; set; }
    [Column("religion")]
    public string? Religion { get; set; }
    [Column("birth_status")]
    public string? BirthStatus { get; set; }
    [Column("place_of_birth")]
    public string? PlaceOfBirth { get; set; }
    [Column("referral_source")]
    public string? ReferralSource { get; set; }
    [Column("referring_agency_person")]
    public string? ReferringAgencyPerson { get; set; }
    [Column("initial_case_assessment")]
    public string? InitialCaseAssessment { get; set; }
    [Column("family_is_4ps")]
    public int FamilyIs4ps { get; set; }
    [Column("family_solo_parent")]
    public int FamilySoloParent { get; set; }
    [Column("family_indigenous")]
    public int FamilyIndigenous { get; set; }
    [Column("family_informal_settler")]
    public int FamilyInformalSettler { get; set; }
    [Column("family_parent_pwd")]
    public int FamilyParentPwd { get; set; }
}

public class ProcessRecording
{
    [Key, Column("recording_id")]
    public int RecordingId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("session_date")]
    public string? SessionDate { get; set; }
    [Column("social_worker")]
    public string? SocialWorker { get; set; }
    [Column("session_type")]
    public string? SessionType { get; set; }
    [Column("session_duration_minutes")]
    public int? SessionDurationMinutes { get; set; }
    [Column("emotional_state_observed")]
    public string? EmotionalStateObserved { get; set; }
    [Column("emotional_state_end")]
    public string? EmotionalStateEnd { get; set; }
    [Column("session_narrative")]
    public string? SessionNarrative { get; set; }
    [Column("interventions_applied")]
    public string? InterventionsApplied { get; set; }
    [Column("follow_up_actions")]
    public string? FollowUpActions { get; set; }
    [Column("progress_noted")]
    public int ProgressNoted { get; set; }
    [Column("concerns_flagged")]
    public int ConcernsFlagged { get; set; }
}

public class HomeVisitation
{
    [Key, Column("visitation_id")]
    public int VisitationId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("visit_date")]
    public string? VisitDate { get; set; }
    [Column("social_worker")]
    public string? SocialWorker { get; set; }
    [Column("visit_type")]
    public string? VisitType { get; set; }
    [Column("location_visited")]
    public string? LocationVisited { get; set; }
    [Column("family_members_present")]
    public string? FamilyMembersPresent { get; set; }
    [Column("purpose")]
    public string? Purpose { get; set; }
    [Column("observations")]
    public string? Observations { get; set; }
    [Column("family_cooperation_level")]
    public string? FamilyCooperationLevel { get; set; }
    [Column("safety_concerns_noted")]
    public int SafetyConcernsNoted { get; set; }
    [Column("follow_up_needed")]
    public int FollowUpNeeded { get; set; }
    [Column("visit_outcome")]
    public string? VisitOutcome { get; set; }
}

public class InterventionPlan
{
    [Key, Column("plan_id")]
    public int PlanId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("plan_category")]
    public string? PlanCategory { get; set; }
    [Column("plan_description")]
    public string? PlanDescription { get; set; }
    [Column("services_provided")]
    public string? ServicesProvided { get; set; }
    [Column("target_date")]
    public string? TargetDate { get; set; }
    [Column("status")]
    public string? Status { get; set; }
    [Column("case_conference_date")]
    public string? CaseConferenceDate { get; set; }
}

public class Supporter
{
    [Key, Column("supporter_id")]
    public int SupporterId { get; set; }
    [Column("supporter_type")]
    public string? SupporterType { get; set; }
    [Column("display_name")]
    public string DisplayName { get; set; } = "";
    [Column("email")]
    public string? Email { get; set; }
    [Column("country")]
    public string? Country { get; set; }
    [Column("region")]
    public string? Region { get; set; }
    [Column("status")]
    public string? Status { get; set; }
    [Column("first_donation_date")]
    public string? FirstDonationDate { get; set; }
    [Column("acquisition_channel")]
    public string? AcquisitionChannel { get; set; }
}

public class Donation
{
    [Key, Column("donation_id")]
    public int DonationId { get; set; }
    [Column("supporter_id")]
    public int SupporterId { get; set; }
    public Supporter Supporter { get; set; } = null!;
    [Column("donation_type")]
    public string? DonationType { get; set; }
    [Column("donation_date")]
    public string? DonationDate { get; set; }
    [Column("amount")]
    public double? Amount { get; set; }
    [Column("estimated_value")]
    public double? EstimatedValue { get; set; }
    [Column("currency_code")]
    public string? CurrencyCode { get; set; }
    [Column("campaign_name")]
    public string? CampaignName { get; set; }
    [Column("notes")]
    public string? Notes { get; set; }
}

public class SocialMediaPost
{
    [Key, Column("post_id")]
    public int PostId { get; set; }
    [Column("platform")]
    public string? Platform { get; set; }
    [Column("post_type")]
    public string? PostType { get; set; }
    [Column("media_type")]
    public string? MediaType { get; set; }
    [Column("created_at")]
    public string? CreatedAt { get; set; }
    [Column("impressions")]
    public int? Impressions { get; set; }
    [Column("reach")]
    public int? Reach { get; set; }
    [Column("engagement_rate")]
    public double? EngagementRate { get; set; }
    [Column("donation_referrals")]
    public int? DonationReferrals { get; set; }
    [Column("estimated_donation_value_php")]
    public double? EstimatedDonationValuePhp { get; set; }
    [Column("content_topic")]
    public string? ContentTopic { get; set; }
    [Column("sentiment_tone")]
    public string? SentimentTone { get; set; }
    [Column("campaign_name")]
    public string? CampaignName { get; set; }
}

public class EducationRecord
{
    [Key, Column("education_record_id")]
    public int EducationRecordId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("record_date")]
    public string? RecordDate { get; set; }
    [Column("progress_percent")]
    public double? ProgressPercent { get; set; }
}

public class HealthWellbeingRecord
{
    [Key, Column("health_record_id")]
    public int HealthRecordId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("record_date")]
    public string? RecordDate { get; set; }
    [Column("general_health_score")]
    public double? GeneralHealthScore { get; set; }
}

public class PublicImpactSnapshot
{
    [Key, Column("snapshot_id")]
    public int SnapshotId { get; set; }
    [Column("snapshot_date")]
    public string? SnapshotDate { get; set; }
    [Column("metric_payload_json")]
    public string? MetricPayloadJson { get; set; }
}

public class IncidentReport
{
    [Key, Column("incident_id")]
    public int IncidentId { get; set; }
    [Column("resident_id")]
    public int ResidentId { get; set; }
    [Column("safehouse_id")]
    public int? SafehouseId { get; set; }
    [Column("incident_date")]
    public string? IncidentDate { get; set; }
    [Column("incident_type")]
    public string? IncidentType { get; set; }
    [Column("severity")]
    public string? Severity { get; set; }
    [Column("resolution_date")]
    public string? ResolutionDate { get; set; }
    /// <summary>CSV boolean: 1 = resolved.</summary>
    [Column("resolved")]
    public int Resolved { get; set; }
}
