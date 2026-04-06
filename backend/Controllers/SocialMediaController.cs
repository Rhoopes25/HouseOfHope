using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/social-media-posts")]
public class SocialMediaController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public SocialMediaController(LighthouseDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<List<SocialMediaPostDto>>> GetAll(CancellationToken ct)
    {
        var list = await _db.SocialMediaPosts.AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return list.Select(p => new SocialMediaPostDto
        {
            Id = p.PostId.ToString(),
            Platform = p.Platform ?? "",
            PostType = p.PostType ?? "",
            MediaType = p.MediaType ?? "",
            Date = (p.CreatedAt ?? "").Length >= 10 ? (p.CreatedAt ?? "")[..10] : (p.CreatedAt ?? ""),
            Impressions = p.Impressions ?? 0,
            Reach = p.Reach ?? 0,
            EngagementRate = p.EngagementRate ?? 0,
            DonationReferrals = p.DonationReferrals ?? 0,
            EstimatedDonationValue = p.EstimatedDonationValuePhp ?? 0,
            ContentTopic = p.ContentTopic ?? "",
            SentimentTone = p.SentimentTone ?? ""
        }).ToList();
    }
}
