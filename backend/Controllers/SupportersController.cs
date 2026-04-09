using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SupportersController : ControllerBase
{
    private const string DeletedDonorName = "Deleted Donor";
    private readonly LighthouseDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public SupportersController(LighthouseDbContext db, UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    [HttpGet]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<List<SupporterDto>>> GetAll(CancellationToken ct)
    {
        var usersWithEmail = await _userManager.Users
            .Where(u => !string.IsNullOrEmpty(u.Email))
            .ToListAsync(ct);
        var existingSupporterEmails = await _db.Supporters.AsNoTracking()
            .Where(s => s.Email != null && s.Email != "")
            .Select(s => s.Email!.Trim().ToLower())
            .ToListAsync(ct);
        var existingSupporterEmailSet = existingSupporterEmails.ToHashSet();
        var donorUsers = await _userManager.GetUsersInRoleAsync(AuthRoles.Donor);
        var missingDonorUsers = donorUsers
            .Where(u => !string.IsNullOrWhiteSpace(u.Email))
            .Where(u => !existingSupporterEmailSet.Contains((u.Email ?? "").Trim().ToLower()))
            .ToList();
        if (missingDonorUsers.Count > 0)
        {
            foreach (var user in missingDonorUsers)
            {
                var email = (user.Email ?? "").Trim();
                var displayName = email.Contains('@')
                    ? email[..email.IndexOf('@')]
                    : email;
                _db.Supporters.Add(new Supporter
                {
                    DisplayName = displayName,
                    Email = email,
                    SupporterType = "MonetaryDonor",
                    Status = "Inactive",
                    AcquisitionChannel = "Website"
                });
            }
            await _db.SaveChangesAsync(ct);
        }

        var list = await _db.Supporters.AsNoTracking()
            .OrderBy(s => s.DisplayName)
            .ToListAsync(ct);
        var loginEmails = usersWithEmail
            .Select(u => (u.Email ?? "").Trim().ToLower())
            .ToHashSet();
        var adminEmails = new HashSet<string>();
        foreach (var user in usersWithEmail)
        {
            if (string.IsNullOrWhiteSpace(user.Email)) continue;
            if (await _userManager.IsInRoleAsync(user, AuthRoles.Admin))
            {
                adminEmails.Add(user.Email.Trim().ToLower());
            }
        }
        return list.Select(s =>
        {
            var emailKey = (s.Email ?? "").Trim().ToLower();
            return ToDto(
                s,
                hasLinkedLogin: loginEmails.Contains(emailKey),
                hasAdminRole: adminEmails.Contains(emailKey));
        }).ToList();
    }

    [HttpPost]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<ActionResult<SupporterDto>> Create([FromBody] CreateSupporterRequest request, CancellationToken ct)
    {
        var entity = new Supporter
        {
            DisplayName = request.DisplayName,
            SupporterType = NormalizeSupporterType(request.SupporterType),
            Status = NormalizeSupporterStatus(request.Status),
            Country = request.Country,
            Region = request.Region,
            Email = request.Email,
            AcquisitionChannel = request.AcquisitionChannel,
            FirstDonationDate = request.FirstDonationDate
        };
        _db.Supporters.Add(entity);
        await _db.SaveChangesAsync(ct);
        ApplicationUser? linkedUser = null;
        if (!string.IsNullOrWhiteSpace(entity.Email))
        {
            linkedUser = await _userManager.FindByEmailAsync(entity.Email);
        }
        var hasLinkedLogin = linkedUser != null;
        var hasAdminRole = linkedUser != null && await _userManager.IsInRoleAsync(linkedUser, AuthRoles.Admin);
        return Created($"/api/supporters/{entity.SupporterId}", ToDto(entity, hasLinkedLogin, hasAdminRole));
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.ManageData)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateSupporterRequest request, CancellationToken ct)
    {
        var entity = await _db.Supporters.FirstOrDefaultAsync(s => s.SupporterId == id, ct);
        if (entity == null) return NotFound();

        entity.DisplayName = request.DisplayName;
        entity.SupporterType = NormalizeSupporterType(request.SupporterType);
        entity.Status = NormalizeSupporterStatus(request.Status);
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
        Supporter? deletedDonor = await _db.Supporters
            .FirstOrDefaultAsync(s => s.DisplayName == DeletedDonorName, ct);
        if (deletedDonor == null)
        {
            deletedDonor = new Supporter
            {
                DisplayName = DeletedDonorName,
                SupporterType = "MonetaryDonor",
                Status = "Inactive",
                AcquisitionChannel = "System"
            };
            _db.Supporters.Add(deletedDonor);
            await _db.SaveChangesAsync(ct);
        }

        if (entity.SupporterId == deletedDonor.SupporterId)
        {
            return BadRequest(new { message = "The Deleted Donor fallback record cannot be removed." });
        }

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var donationsToReassign = await _db.Donations
            .Where(d => d.SupporterId == id)
            .ToListAsync(ct);
        foreach (var donation in donationsToReassign)
        {
            donation.SupporterId = deletedDonor.SupporterId;
        }
        _db.Supporters.Remove(entity);
        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return NoContent();
    }

    private static SupporterDto ToDto(Supporter s, bool hasLinkedLogin, bool hasAdminRole) => new()
    {
        Id = s.SupporterId.ToString(),
        DisplayName = s.DisplayName,
        Email = s.Email,
        HasLinkedLogin = hasLinkedLogin,
        HasAdminRole = hasAdminRole,
        SupporterType = HouseOfHopeMapper.MapSupporterType(s.SupporterType),
        Status = string.Equals(s.Status, "Inactive", StringComparison.OrdinalIgnoreCase) ? "inactive" : "active",
        Country = s.Country ?? s.Region ?? "",
        AcquisitionChannel = s.AcquisitionChannel ?? "",
        FirstDonationDate = s.FirstDonationDate ?? "",
        ChurnRisk = "medium"
    };

    private static string NormalizeSupporterStatus(string? raw) =>
        string.Equals(raw, "inactive", StringComparison.OrdinalIgnoreCase)
            ? "Inactive"
            : "Active";

    private static string NormalizeSupporterType(string? raw) => raw?.Trim().ToLowerInvariant() switch
    {
        "monetary" => "MonetaryDonor",
        "in-kind" => "InKindDonor",
        "volunteer" => "Volunteer",
        "skills" => "SkillsContributor",
        "social-media" => "SocialMediaAdvocate",
        "partner" => "PartnerOrganization",
        _ => raw ?? "MonetaryDonor"
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
