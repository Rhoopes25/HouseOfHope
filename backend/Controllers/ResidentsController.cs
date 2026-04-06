using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
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
}
