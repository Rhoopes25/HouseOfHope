using System.Globalization;
using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalyticsController : ControllerBase
{
    private readonly LighthouseDbContext _db;

    public AnalyticsController(LighthouseDbContext db) => _db = db;

    [HttpGet("impact")]
    public async Task<ActionResult<ImpactStatsDto>> Impact(CancellationToken ct)
    {
        return await BuildImpactAsync(ct);
    }

    [HttpGet("reports")]
    public async Task<ActionResult<ReportsAnalyticsDto>> Reports(CancellationToken ct)
    {
        var summary = await BuildImpactAsync(ct);
        var donationsByTypeRaw = await _db.Donations.AsNoTracking()
            .GroupBy(d => d.DonationType ?? "Unknown")
            .Select(g => new { Key = g.Key, C = g.Count() })
            .ToListAsync(ct);
        var donationsByType = donationsByTypeRaw
            .Select(x => new DonationTypeSliceDto
            {
                Name = HouseOfHopeMapper.MapDonationType(x.Key) switch
                {
                    "monetary" => "Monetary",
                    "in-kind" => "In-Kind",
                    "time" => "Time",
                    "skills" => "Skills",
                    "social-media" => "Social Media",
                    _ => x.Key
                },
                Value = x.C
            })
            .ToList();

        var safehouseRows = await (
            from r in _db.Residents.AsNoTracking()
            join s in _db.Safehouses.AsNoTracking() on r.SafehouseId equals s.SafehouseId
            group r by new { s.SafehouseId, s.Name } into g
            select new
            {
                g.Key.Name,
                Residents = g.Count(),
                Completed = g.Count(x => x.ReintegrationStatus == "Completed"),
                Total = g.Count()
            }).ToListAsync(ct);

        var eduAvg = await _db.EducationRecords.AsNoTracking()
            .Where(e => e.ProgressPercent != null)
            .AverageAsync(e => e.ProgressPercent!.Value, ct);
        var eduRounded = Math.Round(Math.Min(100, eduAvg));

        var safehouseComparison = safehouseRows
            .OrderByDescending(s => s.Residents)
            .Take(8)
            .Select(s => new SafehousePerformanceDto
            {
                Name = s.Name ?? "Safehouse",
                Residents = s.Residents,
                Reintegration = s.Total > 0 ? Math.Round(100.0 * s.Completed / s.Total) : 0,
                Education = eduRounded
            })
            .ToList();

        var reintGroups = await _db.Residents.AsNoTracking()
            .Where(r => r.ReintegrationType != null && r.ReintegrationType != "")
            .GroupBy(r => r.ReintegrationType!)
            .Select(g => new { Type = g.Key, Total = g.Count(), Done = g.Count(x => x.ReintegrationStatus == "Completed") })
            .ToListAsync(ct);

        var reintegrationByType = reintGroups
            .Select(x => new ReintegrationByTypeDto
            {
                Name = x.Type,
                Rate = x.Total > 0 ? Math.Round(100.0 * x.Done / x.Total) : 0
            })
            .OrderByDescending(x => x.Rate)
            .ToList();

        var incidents = await _db.IncidentReports.AsNoTracking().ToListAsync(ct);
        var incidentGroups = incidents
            .GroupBy(i => i.IncidentType ?? "Unknown")
            .Select(g => new IncidentStackDto
            {
                Type = g.Key,
                Low = g.Count(x => x.Severity == "Low"),
                Medium = g.Count(x => x.Severity == "Medium"),
                High = g.Count(x => x.Severity == "High")
            })
            .OrderByDescending(i => i.Low + i.Medium + i.High)
            .Take(8)
            .ToList();

        return new ReportsAnalyticsDto
        {
            Summary = summary,
            DonationsByType = donationsByType,
            SafehouseComparison = safehouseComparison,
            ReintegrationByType = reintegrationByType,
            IncidentsByType = incidentGroups
        };
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardSummaryDto>> Dashboard(CancellationToken ct)
    {
        var impact = await BuildImpactAsync(ct);
        var residents = await _db.Residents.AsNoTracking()
            .Include(r => r.Safehouse)
            .Where(r => r.CurrentRiskLevel == "High" || r.CurrentRiskLevel == "Critical")
            .OrderBy(r => r.InternalCode)
            .Take(12)
            .ToListAsync(ct);
        var ids = residents.Select(r => r.ResidentId).ToList();
        var readiness = await HouseOfHopeMapper.GetReadinessScoresAsync(_db, ids);
        var highRisk = residents.Select(r => HouseOfHopeMapper.ToResidentDto(r, readiness[r.ResidentId])).ToList();

        var now = DateTime.UtcNow;
        var monthPrefix = now.ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var recentDonations = await _db.Donations.AsNoTracking()
            .Include(d => d.Supporter)
            .OrderByDescending(d => d.DonationDate)
            .Take(5)
            .ToListAsync(ct);
        var donationDtos = recentDonations.Select(d => MapDonation(d)).ToList();

        var monthlyTotal = await _db.Donations.AsNoTracking()
            .Where(d => d.DonationDate != null && d.DonationDate.StartsWith(monthPrefix))
            .SumAsync(d => d.Amount ?? d.EstimatedValue ?? 0, ct);

        var snapshots = await _db.PublicImpactSnapshots.AsNoTracking()
            .OrderByDescending(s => s.SnapshotDate)
            .Take(12)
            .ToListAsync(ct);
        var trend = BuildMonthlyTrends(snapshots);

        var upcomingRaw = await (
            from p in _db.InterventionPlans.AsNoTracking()
            join r in _db.Residents.AsNoTracking() on p.ResidentId equals r.ResidentId
            where p.CaseConferenceDate != null && p.CaseConferenceDate != ""
            orderby p.CaseConferenceDate
            select new
            {
                p.PlanId,
                ResidentCode = r.InternalCode ?? "",
                Date = p.CaseConferenceDate ?? "",
                Type = p.PlanCategory ?? "Case conference"
            }).Take(10).ToListAsync(ct);
        var upcoming = upcomingRaw.Select(x => new UpcomingConferenceDto
        {
            Id = x.PlanId.ToString(),
            ResidentCode = x.ResidentCode,
            Date = x.Date,
            Type = x.Type
        }).ToList();

        return new DashboardSummaryDto
        {
            HighRiskResidents = highRisk,
            RecentDonations = donationDtos,
            MonthlyDonationsTotal = monthlyTotal,
            EducationHealthTrend = trend,
            UpcomingConferences = upcoming
        };
    }

    private async Task<ImpactStatsDto> BuildImpactAsync(CancellationToken ct)
    {
        var totalResidents = await _db.Residents.CountAsync(ct);
        var totalValue = await _db.Donations.SumAsync(d => d.Amount ?? d.EstimatedValue ?? 0, ct);

        var closed = await _db.Residents.CountAsync(r => r.CaseStatus == "Closed", ct);
        var completed = await _db.Residents.CountAsync(r => r.ReintegrationStatus == "Completed", ct);
        var reintRate = closed > 0 ? (int)Math.Round(100.0 * completed / Math.Max(closed, 1)) : 0;

        var eduAvg = await _db.EducationRecords.Where(e => e.ProgressPercent != null)
            .AverageAsync(e => e.ProgressPercent!.Value, ct);
        var healthAvg = await _db.HealthWellbeingRecords.Where(h => h.GeneralHealthScore != null)
            .AverageAsync(h => h.GeneralHealthScore!.Value, ct);

        var eduRate = (int)Math.Clamp(Math.Round(eduAvg), 0, 100);
        var healthRate = (int)Math.Clamp(Math.Round(HouseOfHopeMapper.HealthToPercent(healthAvg)), 0, 100);

        var snapshots = await _db.PublicImpactSnapshots.AsNoTracking()
            .OrderBy(s => s.SnapshotDate)
            .ToListAsync(ct);

        var trends = BuildMonthlyTrends(snapshots);

        return new ImpactStatsDto
        {
            TotalResidentsServed = totalResidents,
            TotalDonationsReceived = totalValue,
            ReintegrationSuccessRate = reintRate,
            EducationEnrollmentRate = eduRate,
            HealthImprovementRate = healthRate,
            MonthlyTrends = trends
        };
    }

    private static List<MonthlyTrendDto> BuildMonthlyTrends(List<PublicImpactSnapshot> snapshots)
    {
        var list = new List<MonthlyTrendDto>();
        foreach (var s in snapshots.OrderBy(x => x.SnapshotDate).TakeLast(12))
        {
            var m = HouseOfHopeMapper.ParseMetricPayload(s.MetricPayloadJson);
            var monthLabel = "—";
            if (DateTime.TryParse(s.SnapshotDate, out var dt))
                monthLabel = dt.ToString("MMM yy", CultureInfo.InvariantCulture);
            double residents = 0, donations = 0, edu = 0, healthRaw = 3;
            if (m != null)
            {
                if (m.TryGetValue("total_residents", out var tr) && tr.TryGetInt32(out var tri))
                    residents = tri;
                if (m.TryGetValue("donations_total_for_month", out var dm) && dm.TryGetDouble(out var dmv))
                    donations = dmv;
                if (m.TryGetValue("avg_education_progress", out var ae) && ae.TryGetDouble(out var aev))
                    edu = aev;
                if (m.TryGetValue("avg_health_score", out var ah) && ah.TryGetDouble(out var ahv))
                    healthRaw = ahv;
            }
            list.Add(new MonthlyTrendDto
            {
                Month = monthLabel,
                Residents = (int)residents,
                Donations = donations,
                Education = edu,
                Health = HouseOfHopeMapper.HealthToPercent(healthRaw)
            });
        }
        return list;
    }

    private static DonationDto MapDonation(Donation d)
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
                dto.ItemDetails = d.Notes ?? "In-kind";
                dto.Amount = d.EstimatedValue;
                break;
            case "Time":
                dto.Hours = d.EstimatedValue;
                break;
            case "Skills":
                dto.SkillDescription = d.Notes ?? "Skills";
                break;
            default:
                dto.Amount = d.Amount ?? d.EstimatedValue;
                break;
        }
        return dto;
    }
}
