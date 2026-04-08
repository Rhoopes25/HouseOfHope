using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Authorization;
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
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<List<SupporterDto>>> GetAll(CancellationToken ct)
    {
        var list = await _db.Supporters.AsNoTracking()
            .OrderBy(s => s.DisplayName)
            .ToListAsync(ct);
        return list.Select(ToDto).ToList();
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<SupporterDto>> Create([FromBody] CreateSupporterRequest request, CancellationToken ct)
    {
        var entity = new Supporter
        {
            DisplayName = request.DisplayName,
            SupporterType = request.SupporterType,
            Status = request.Status,
            Country = request.Country,
            Region = request.Region,
            Email = request.Email,
            AcquisitionChannel = request.AcquisitionChannel,
            FirstDonationDate = request.FirstDonationDate
        };
        _db.Supporters.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Created($"/api/supporters/{entity.SupporterId}", ToDto(entity));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSupporterRequest request, CancellationToken ct)
    {
        var entity = await _db.Supporters.FirstOrDefaultAsync(s => s.SupporterId == id, ct);
        if (entity == null) return NotFound();

        entity.DisplayName = request.DisplayName;
        entity.SupporterType = request.SupporterType;
        entity.Status = request.Status;
        entity.Country = request.Country;
        entity.Region = request.Region;
        entity.Email = request.Email;
        entity.AcquisitionChannel = request.AcquisitionChannel;
        entity.FirstDonationDate = request.FirstDonationDate;

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

        var entity = await _db.Supporters.FirstOrDefaultAsync(s => s.SupporterId == id, ct);
        if (entity == null) return NotFound();
        _db.Supporters.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return NoContent();
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

public class CreateSupporterRequest
{
    public string DisplayName { get; set; } = "";
    public string? SupporterType { get; set; }
    public string? Status { get; set; }
    public string? Country { get; set; }
    public string? Region { get; set; }
    public string? Email { get; set; }
    public string? AcquisitionChannel { get; set; }
    public string? FirstDonationDate { get; set; }
}
