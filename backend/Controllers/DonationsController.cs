using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationsController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public DonationsController(LighthouseDbContext db) => _db = db;

    [HttpGet]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<List<DonationDto>>> GetAll(CancellationToken ct)
    {
        var list = await _db.Donations.AsNoTracking()
            .Include(d => d.Supporter)
            .OrderByDescending(d => d.DonationDate)
            .ThenByDescending(d => d.DonationId)
            .ToListAsync(ct);
        return list.Select(Map).ToList();
    }

    [HttpGet("my")]
    [Authorize(Roles = $"{AuthRoles.Donor},{AuthRoles.Admin}")]
    public async Task<ActionResult<List<DonationDto>>> GetMine(CancellationToken ct)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var displayName = User.FindFirstValue("supporter_display_name");

        var list = await _db.Donations.AsNoTracking()
            .Include(d => d.Supporter)
            .Where(d =>
                (email != null && d.Supporter.Email == email) ||
                (displayName != null && d.Supporter.DisplayName == displayName))
            .OrderByDescending(d => d.DonationDate)
            .ThenByDescending(d => d.DonationId)
            .ToListAsync(ct);

        return list.Select(Map).ToList();
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<DonationDto>> Create([FromBody] CreateDonationRequest request, CancellationToken ct)
    {
        var entity = new Donation
        {
            SupporterId = request.SupporterId,
            DonationType = request.DonationType,
            DonationDate = request.DonationDate,
            Amount = request.Amount,
            EstimatedValue = request.EstimatedValue,
            CurrencyCode = request.CurrencyCode,
            CampaignName = request.CampaignName,
            Notes = request.Notes
        };
        _db.Donations.Add(entity);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(entity).Reference(d => d.Supporter).LoadAsync(ct);
        return Created($"/api/donations/{entity.DonationId}", Map(entity));
    }

    [HttpPost("my")]
    [Authorize(Roles = $"{AuthRoles.Donor},{AuthRoles.Admin}")]
    public async Task<ActionResult<DonationDto>> CreateMine([FromBody] CreateMyDonationRequest request, CancellationToken ct)
    {
        var email = User.FindFirstValue(ClaimTypes.Email);
        var displayName = User.FindFirstValue("supporter_display_name");
        var fallbackName = User.Identity?.Name;

        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(displayName))
        {
            return BadRequest(new { message = "Cannot map logged-in user to a donor profile." });
        }

        var supporter = await _db.Supporters.FirstOrDefaultAsync(s =>
                (email != null && s.Email == email) ||
                (displayName != null && s.DisplayName == displayName), ct);

        if (supporter == null)
        {
            supporter = new Supporter
            {
                DisplayName = string.IsNullOrWhiteSpace(displayName) ? (fallbackName ?? email ?? "Donor") : displayName,
                Email = email,
                SupporterType = "MonetaryDonor",
                Status = "Active",
                AcquisitionChannel = "Web Portal",
                FirstDonationDate = request.DonationDate
            };
            _db.Supporters.Add(supporter);
            await _db.SaveChangesAsync(ct);
        }

        var entity = new Donation
        {
            SupporterId = supporter.SupporterId,
            DonationType = request.DonationType,
            DonationDate = request.DonationDate,
            Amount = request.Amount,
            EstimatedValue = request.EstimatedValue,
            CurrencyCode = request.CurrencyCode,
            CampaignName = request.CampaignName,
            Notes = request.Notes
        };
        _db.Donations.Add(entity);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(entity).Reference(d => d.Supporter).LoadAsync(ct);
        return Created($"/api/donations/{entity.DonationId}", Map(entity));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateDonationRequest request, CancellationToken ct)
    {
        var entity = await _db.Donations.FirstOrDefaultAsync(d => d.DonationId == id, ct);
        if (entity == null) return NotFound();

        entity.SupporterId = request.SupporterId;
        entity.DonationType = request.DonationType;
        entity.DonationDate = request.DonationDate;
        entity.Amount = request.Amount;
        entity.EstimatedValue = request.EstimatedValue;
        entity.CurrencyCode = request.CurrencyCode;
        entity.CampaignName = request.CampaignName;
        entity.Notes = request.Notes;

        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<IActionResult> Delete(int id, [FromQuery] bool confirm = false, CancellationToken ct = default)
    {
        if (!confirm)
        {
            return BadRequest(new { message = "Deletion requires explicit confirmation. Pass confirm=true." });
        }

        var entity = await _db.Donations.FirstOrDefaultAsync(d => d.DonationId == id, ct);
        if (entity == null) return NotFound();
        _db.Donations.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static DonationDto Map(Donation d)
    {
        var type = HouseOfHopeMapper.MapDonationType(d.DonationType);
        var dto = new DonationDto
        {
            Id = d.DonationId.ToString(),
            SupporterId = d.SupporterId.ToString(),
            DonorName = d.Supporter.DisplayName,
            Date = d.DonationDate ?? "",
            Type = type,
            Currency = d.CurrencyCode ?? "PHP",
            CampaignName = d.CampaignName,
            Notes = d.Notes
        };
        switch (d.DonationType)
        {
            case "Monetary":
                dto.Amount = d.Amount ?? d.EstimatedValue;
                break;
            case "InKind":
                dto.ItemDetails = d.Notes ?? "In-kind contribution";
                dto.Amount = d.EstimatedValue;
                break;
            case "Time":
                dto.Hours = d.EstimatedValue;
                break;
            case "Skills":
                dto.SkillDescription = d.Notes ?? "Skills contribution";
                break;
            case "SocialMedia":
                dto.CampaignName = d.CampaignName ?? d.Notes;
                break;
            default:
                dto.Amount = d.Amount ?? d.EstimatedValue;
                break;
        }
        return dto;
    }
}

public class CreateDonationRequest
{
    public int SupporterId { get; set; }
    public string? DonationType { get; set; }
    public string? DonationDate { get; set; }
    public double? Amount { get; set; }
    public double? EstimatedValue { get; set; }
    public string? CurrencyCode { get; set; }
    public string? CampaignName { get; set; }
    public string? Notes { get; set; }
}

public class CreateMyDonationRequest
{
    public string DonationType { get; set; } = "Monetary";
    public string DonationDate { get; set; } = "";
    public double? Amount { get; set; }
    public double? EstimatedValue { get; set; }
    public string? CurrencyCode { get; set; } = "PHP";
    public string? CampaignName { get; set; }
    public string? Notes { get; set; }
}
