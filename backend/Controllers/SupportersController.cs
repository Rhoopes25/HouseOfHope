using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SupportersController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public SupportersController(LighthouseDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<SupporterDto>>> GetAll(CancellationToken ct)
    {
        var list = await _db.Supporters.AsNoTracking()
            .OrderBy(s => s.DisplayName)
            .ToListAsync(ct);
        return list.Select(ToDto).ToList();
    }

    private static SupporterDto ToDto(Supporter s) => new()
    {
        Id = s.SupporterId.ToString(),
        DisplayName = s.DisplayName,
        SupporterType = HouseOfHopeMapper.MapSupporterType(s.SupporterType),
        Status = string.Equals(s.Status, "Inactive", StringComparison.OrdinalIgnoreCase) ? "inactive" : "active",
        Country = s.Country ?? s.Region ?? "",
        AcquisitionChannel = s.AcquisitionChannel ?? "",
        FirstDonationDate = s.FirstDonationDate ?? "",
        ChurnRisk = "medium"
    };
}
