using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MLController : ControllerBase
{
    private readonly SocialMediaPredictionService _predictionService;
    private readonly CaseManagementPredictionService _casePredictionService;
    private readonly DonorChurnPredictionService _churnService;

    public MLController(
        SocialMediaPredictionService predictionService,
        CaseManagementPredictionService casePredictionService,
        DonorChurnPredictionService churnService)
    {
        _predictionService = predictionService;
        _casePredictionService = casePredictionService;
        _churnService = churnService;
    }

    // ── Social Media ──────────────────────────────────────────────────────

    [HttpPost("social-media/predict")]
    [Authorize(Policy = "ManageData")]
    public ActionResult<SocialMediaPredictionResult> Predict([FromBody] SocialMediaPredictionInput input)
    {
        try
        {
            var result = _predictionService.Predict(input);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Case Management ───────────────────────────────────────────────────

    [HttpGet("case-management/predict/{residentId:int}")]
    [Authorize(Policy = "ManageData")]
    public async Task<ActionResult<CaseManagementPredictionResult>> PredictCaseManagement(
        int residentId,
        CancellationToken ct)
    {
        try
        {
            var result = await _casePredictionService.PredictForResidentAsync(residentId, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Donor Churn ───────────────────────────────────────────────────────

    /// <summary>
    /// Get churn risk score for a single donor.
    /// Returns risk score (0-1), risk tier (low/medium/high), top drivers, and recommended actions.
    /// </summary>
    [HttpGet("donor-churn/{supporterId:int}")]
    [Authorize(Policy = "ManageData")]
    public async Task<ActionResult<DonorChurnPredictionResult>> PredictDonorChurn(
        int supporterId,
        CancellationToken ct)
    {
        try
        {
            var result = await _churnService.PredictForSupporterAsync(supporterId, ct);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>
    /// Get churn risk scores for all active donors.
    /// Used to populate the risk badges on the Donors & Contributions page.
    /// </summary>
    [HttpGet("donor-churn/all")]
    [Authorize(Policy = "ManageData")]
    public async Task<ActionResult<Dictionary<int, DonorChurnPredictionResult>>> PredictAllDonorChurn(
        CancellationToken ct)
    {
        try
        {
            var results = await _churnService.PredictForAllSupportersAsync(ct);
            return Ok(results);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
