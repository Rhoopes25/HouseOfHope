using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ManageData)]
public class ResidentsController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public ResidentsController(LighthouseDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<ResidentDto>>> GetAll(CancellationToken ct)
    {
        var rows = await _db.Residents
            .AsNoTracking()
            .Include(r => r.Safehouse)
            .OrderBy(r => r.InternalCode)
            .ToListAsync(ct);
        var ids = rows.Select(r => r.ResidentId).ToList();
        var readiness = await HouseOfHopeMapper.GetReadinessScoresAsync(_db, ids);
        return rows.Select(r => HouseOfHopeMapper.ToResidentDto(r, readiness[r.ResidentId])).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ResidentDto>> GetOne(int id, CancellationToken ct)
    {
        var r = await _db.Residents
            .AsNoTracking()
            .Include(x => x.Safehouse)
            .FirstOrDefaultAsync(x => x.ResidentId == id, ct);
        if (r == null) return NotFound();
        var readiness = await HouseOfHopeMapper.GetReadinessScoresAsync(_db, [id]);
        return HouseOfHopeMapper.ToResidentDto(r, readiness[id]);
    }

    [HttpPost]
    public async Task<ActionResult<ResidentDto>> Create([FromBody] UpsertResidentRequest request, CancellationToken ct)
    {
        var safehouseId = await ResolveSafehouseIdAsync(request.SafehouseId, request.SafehouseName, ct);
        if (safehouseId == null) return BadRequest(new { message = "Valid safehouse is required." });

        var entity = new Resident
        {
            CaseControlNo = request.CaseControlNumber,
            InternalCode = request.InternalCode,
            SafehouseId = safehouseId.Value,
            CaseStatus = request.CaseStatus,
            CaseCategory = request.CaseCategory,
            CurrentRiskLevel = request.RiskLevel,
            AssignedSocialWorker = request.AssignedSocialWorker,
            ReintegrationStatus = request.ReintegrationStatus,
            ReintegrationType = request.ReintegrationType,
            DateOfAdmission = request.AdmissionDate,
            DateOfBirth = request.DateOfBirth,
            ReferralSource = request.ReferralSource,
            ReferringAgencyPerson = request.ReferringAgency,
            InitialCaseAssessment = request.InitialAssessment
        };

        _db.Residents.Add(entity);
        await _db.SaveChangesAsync(ct);

        var created = await _db.Residents
            .AsNoTracking()
            .Include(r => r.Safehouse)
            .FirstAsync(r => r.ResidentId == entity.ResidentId, ct);
        var readiness = await HouseOfHopeMapper.GetReadinessScoresAsync(_db, [entity.ResidentId]);
        return Created($"/api/residents/{entity.ResidentId}", HouseOfHopeMapper.ToResidentDto(created, readiness[entity.ResidentId]));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpsertResidentRequest request, CancellationToken ct)
    {
        var entity = await _db.Residents.FirstOrDefaultAsync(r => r.ResidentId == id, ct);
        if (entity == null) return NotFound();

        var safehouseId = await ResolveSafehouseIdAsync(request.SafehouseId, request.SafehouseName, ct);
        if (safehouseId == null) return BadRequest(new { message = "Valid safehouse is required." });

        entity.CaseControlNo = request.CaseControlNumber;
        entity.InternalCode = request.InternalCode;
        entity.SafehouseId = safehouseId.Value;
        entity.CaseStatus = request.CaseStatus;
        entity.CaseCategory = request.CaseCategory;
        entity.CurrentRiskLevel = request.RiskLevel;
        entity.AssignedSocialWorker = request.AssignedSocialWorker;
        entity.ReintegrationStatus = request.ReintegrationStatus;
        entity.ReintegrationType = request.ReintegrationType;
        entity.DateOfAdmission = request.AdmissionDate;
        entity.DateOfBirth = request.DateOfBirth;
        entity.ReferralSource = request.ReferralSource;
        entity.ReferringAgencyPerson = request.ReferringAgency;
        entity.InitialCaseAssessment = request.InitialAssessment;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id:int}/sessions")]
    public async Task<ActionResult<List<CounselingSessionDto>>> GetSessions(int id, CancellationToken ct)
    {
        var exists = await _db.Residents.AsNoTracking().AnyAsync(r => r.ResidentId == id, ct);
        if (!exists) return NotFound();
        var list = await _db.ProcessRecordings.AsNoTracking()
            .Where(p => p.ResidentId == id)
            .OrderByDescending(p => p.SessionDate)
            .ToListAsync(ct);
        return list.Select(p => new CounselingSessionDto
        {
            Id = p.RecordingId.ToString(),
            ResidentId = id.ToString(),
            SessionDate = p.SessionDate ?? "",
            SocialWorker = p.SocialWorker ?? "",
            SessionType = HouseOfHopeMapper.MapSessionType(p.SessionType),
            DurationMinutes = p.SessionDurationMinutes ?? 0,
            EmotionalStateStart = p.EmotionalStateObserved ?? "",
            EmotionalStateEnd = p.EmotionalStateEnd ?? "",
            Narrative = p.SessionNarrative ?? "",
            Interventions = p.InterventionsApplied ?? "",
            FollowUpActions = p.FollowUpActions ?? "",
            ProgressNoted = p.ProgressNoted != 0,
            ConcernsFlagged = p.ConcernsFlagged != 0
        }).ToList();
    }

    [HttpPost("{id:int}/sessions")]
    public async Task<ActionResult<CounselingSessionDto>> CreateSession(int id, [FromBody] CreateCounselingSessionRequest request, CancellationToken ct)
    {
        var exists = await _db.Residents.AsNoTracking().AnyAsync(r => r.ResidentId == id, ct);
        if (!exists) return NotFound();

        var entity = new ProcessRecording
        {
            ResidentId = id,
            SessionDate = request.SessionDate,
            SocialWorker = request.SocialWorker,
            SessionType = string.Equals(request.SessionType, "group", StringComparison.OrdinalIgnoreCase) ? "Group" : "Individual",
            SessionDurationMinutes = request.DurationMinutes,
            EmotionalStateObserved = request.EmotionalStateStart,
            EmotionalStateEnd = request.EmotionalStateEnd,
            SessionNarrative = request.Narrative,
            InterventionsApplied = request.Interventions,
            FollowUpActions = request.FollowUpActions,
            ProgressNoted = request.ProgressNoted ? 1 : 0,
            ConcernsFlagged = request.ConcernsFlagged ? 1 : 0
        };
        _db.ProcessRecordings.Add(entity);
        await _db.SaveChangesAsync(ct);

        return Created($"/api/residents/{id}/sessions/{entity.RecordingId}", new CounselingSessionDto
        {
            Id = entity.RecordingId.ToString(),
            ResidentId = id.ToString(),
            SessionDate = entity.SessionDate ?? "",
            SocialWorker = entity.SocialWorker ?? "",
            SessionType = HouseOfHopeMapper.MapSessionType(entity.SessionType),
            DurationMinutes = entity.SessionDurationMinutes ?? 0,
            EmotionalStateStart = entity.EmotionalStateObserved ?? "",
            EmotionalStateEnd = entity.EmotionalStateEnd ?? "",
            Narrative = entity.SessionNarrative ?? "",
            Interventions = entity.InterventionsApplied ?? "",
            FollowUpActions = entity.FollowUpActions ?? "",
            ProgressNoted = entity.ProgressNoted != 0,
            ConcernsFlagged = entity.ConcernsFlagged != 0
        });
    }

    [HttpGet("{id:int}/visitations")]
    public async Task<ActionResult<List<VisitationDto>>> GetVisitations(int id, CancellationToken ct)
    {
        var exists = await _db.Residents.AsNoTracking().AnyAsync(r => r.ResidentId == id, ct);
        if (!exists) return NotFound();
        var list = await _db.HomeVisitations.AsNoTracking()
            .Where(v => v.ResidentId == id)
            .OrderByDescending(v => v.VisitDate)
            .ToListAsync(ct);
        return list.Select(v => new VisitationDto
        {
            Id = v.VisitationId.ToString(),
            ResidentId = id.ToString(),
            VisitDate = v.VisitDate ?? "",
            SocialWorker = v.SocialWorker ?? "",
            VisitType = v.VisitType ?? "",
            Location = v.LocationVisited ?? "",
            FamilyMembersPresent = v.FamilyMembersPresent ?? "",
            Purpose = v.Purpose ?? "",
            Observations = v.Observations ?? "",
            FamilyCooperationLevel = v.FamilyCooperationLevel ?? "",
            SafetyConcernsNoted = v.SafetyConcernsNoted != 0,
            FollowUpNeeded = v.FollowUpNeeded != 0,
            VisitOutcome = v.VisitOutcome ?? ""
        }).ToList();
    }

    [HttpPost("{id:int}/visitations")]
    public async Task<ActionResult<VisitationDto>> CreateVisitation(int id, [FromBody] CreateVisitationRequest request, CancellationToken ct)
    {
        var exists = await _db.Residents.AsNoTracking().AnyAsync(r => r.ResidentId == id, ct);
        if (!exists) return NotFound();

        var entity = new HomeVisitation
        {
            ResidentId = id,
            VisitDate = request.VisitDate,
            SocialWorker = request.SocialWorker,
            VisitType = request.VisitType,
            LocationVisited = request.Location,
            FamilyMembersPresent = request.FamilyMembersPresent,
            Purpose = request.Purpose,
            Observations = request.Observations,
            FamilyCooperationLevel = request.FamilyCooperationLevel,
            SafetyConcernsNoted = request.SafetyConcernsNoted ? 1 : 0,
            FollowUpNeeded = request.FollowUpNeeded ? 1 : 0,
            VisitOutcome = request.VisitOutcome
        };
        _db.HomeVisitations.Add(entity);
        await _db.SaveChangesAsync(ct);

        return Created($"/api/residents/{id}/visitations/{entity.VisitationId}", new VisitationDto
        {
            Id = entity.VisitationId.ToString(),
            ResidentId = id.ToString(),
            VisitDate = entity.VisitDate ?? "",
            SocialWorker = entity.SocialWorker ?? "",
            VisitType = entity.VisitType ?? "",
            Location = entity.LocationVisited ?? "",
            FamilyMembersPresent = entity.FamilyMembersPresent ?? "",
            Purpose = entity.Purpose ?? "",
            Observations = entity.Observations ?? "",
            FamilyCooperationLevel = entity.FamilyCooperationLevel ?? "",
            SafetyConcernsNoted = entity.SafetyConcernsNoted != 0,
            FollowUpNeeded = entity.FollowUpNeeded != 0,
            VisitOutcome = entity.VisitOutcome ?? ""
        });
    }

    [HttpGet("{id:int}/intervention-plans")]
    public async Task<ActionResult<List<InterventionPlanDto>>> GetPlans(int id, CancellationToken ct)
    {
        var exists = await _db.Residents.AsNoTracking().AnyAsync(r => r.ResidentId == id, ct);
        if (!exists) return NotFound();
        var list = await _db.InterventionPlans.AsNoTracking()
            .Where(p => p.ResidentId == id)
            .OrderByDescending(p => p.TargetDate)
            .ToListAsync(ct);
        return list.Select(p => new InterventionPlanDto
        {
            Id = p.PlanId.ToString(),
            ResidentId = id.ToString(),
            PlanCategory = p.PlanCategory ?? "",
            Description = p.PlanDescription ?? "",
            ServicesProvided = p.ServicesProvided ?? "",
            TargetDate = p.TargetDate ?? "",
            Status = HouseOfHopeMapper.MapPlanStatus(p.Status),
            CaseConferenceDate = p.CaseConferenceDate ?? ""
        }).ToList();
    }

    private async Task<int?> ResolveSafehouseIdAsync(int? safehouseId, string? safehouseName, CancellationToken ct)
    {
        if (safehouseId.HasValue)
        {
            var exists = await _db.Safehouses.AsNoTracking().AnyAsync(s => s.SafehouseId == safehouseId.Value, ct);
            return exists ? safehouseId : null;
        }

        if (!string.IsNullOrWhiteSpace(safehouseName))
        {
            var found = await _db.Safehouses.AsNoTracking()
                .Where(s => s.Name != null && s.Name == safehouseName)
                .Select(s => (int?)s.SafehouseId)
                .FirstOrDefaultAsync(ct);
            return found;
        }

        return null;
    }
}

public class UpsertResidentRequest
{
    public string? CaseControlNumber { get; set; }
    public string? InternalCode { get; set; }
    public int? SafehouseId { get; set; }
    public string? SafehouseName { get; set; }
    public string? CaseStatus { get; set; }
    public string? CaseCategory { get; set; }
    public string? RiskLevel { get; set; }
    public string? AssignedSocialWorker { get; set; }
    public string? ReintegrationStatus { get; set; }
    public string? ReintegrationType { get; set; }
    public string? AdmissionDate { get; set; }
    public string? DateOfBirth { get; set; }
    public string? ReferralSource { get; set; }
    public string? ReferringAgency { get; set; }
    public string? InitialAssessment { get; set; }
}

public class CreateCounselingSessionRequest
{
    public string? SessionDate { get; set; }
    public string? SocialWorker { get; set; }
    public string? SessionType { get; set; }
    public int? DurationMinutes { get; set; }
    public string? EmotionalStateStart { get; set; }
    public string? EmotionalStateEnd { get; set; }
    public string? Narrative { get; set; }
    public string? Interventions { get; set; }
    public string? FollowUpActions { get; set; }
    public bool ProgressNoted { get; set; }
    public bool ConcernsFlagged { get; set; }
}

public class CreateVisitationRequest
{
    public string? VisitDate { get; set; }
    public string? SocialWorker { get; set; }
    public string? VisitType { get; set; }
    public string? Location { get; set; }
    public string? FamilyMembersPresent { get; set; }
    public string? Purpose { get; set; }
    public string? Observations { get; set; }
    public string? FamilyCooperationLevel { get; set; }
    public bool SafetyConcernsNoted { get; set; }
    public bool FollowUpNeeded { get; set; }
    public string? VisitOutcome { get; set; }
}
