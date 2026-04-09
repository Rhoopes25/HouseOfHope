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

    public MLController(
        SocialMediaPredictionService predictionService,
        CaseManagementPredictionService casePredictionService)
    {
        _predictionService = predictionService;
        _casePredictionService = casePredictionService;
    }

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
}
