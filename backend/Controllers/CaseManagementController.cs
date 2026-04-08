using System.Net.Http.Json;
using System.Text.Json;
using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;

namespace HouseOfHope.API.Controllers;

/// <summary>
/// Proxies case-management risk prioritization from the Python ML service when configured.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ManageData)]
public class CaseManagementController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ILogger<CaseManagementController> _logger;

    public CaseManagementController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IHostEnvironment hostEnvironment,
        ILogger<CaseManagementController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _hostEnvironment = hostEnvironment;
        _logger = logger;
    }

    /// <summary>
    /// Returns residents ranked by model-estimated risk of near-term escalation (staff-only).
    /// Requires <c>CaseManagementMl:BaseUrl</c> and a running Python service (see ml-pipelines/case_management/README.md).
    /// </summary>
    [HttpGet("risk-priorities")]
    [ProducesResponseType(typeof(CaseRiskPrioritiesResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetRiskPriorities(CancellationToken ct)
    {
        var baseUrl = _configuration["CaseManagementMl:BaseUrl"]?.Trim();
        if (string.IsNullOrEmpty(baseUrl) && _hostEnvironment.IsDevelopment())
            baseUrl = "http://127.0.0.1:5055";

        if (string.IsNullOrEmpty(baseUrl))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Case management ML is not configured. Set CaseManagementMl:BaseUrl and run the Python service."
            });
        }

        var client = _httpClientFactory.CreateClient("CaseManagementMl");
        client.Timeout = TimeSpan.FromMinutes(2);

        var uri = baseUrl.TrimEnd('/') + "/v1/priorities";
        try
        {
            using var response = await client.GetAsync(uri, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Case ML service returned {Status}: {Body}", response.StatusCode, body);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    error = "Case management ML service returned an error.",
                    status = (int)response.StatusCode,
                    detail = body
                });
            }

            var dto = await response.Content.ReadFromJsonAsync<CaseRiskPrioritiesResponseDto>(
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                ct);
            if (dto == null)
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "Empty response from ML service." });

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reach case management ML service at {Uri}", uri);
            var detail = ex.InnerException != null ? $"{ex.Message} ({ex.InnerException.Message})" : ex.Message;
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Could not reach case management ML service.",
                detail
            });
        }
    }
}
