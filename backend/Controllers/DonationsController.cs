using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationsController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public DonationsController(LighthouseDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<DonationDto>>> GetAll(CancellationToken ct)
    {
        var list = await _db.Donations.AsNoTracking()
            .Include(d => d.Supporter)
            .OrderByDescending(d => d.DonationDate)
            .ToListAsync(ct);
        return list.Select(Map).ToList();
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
            CampaignName = d.CampaignName
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
