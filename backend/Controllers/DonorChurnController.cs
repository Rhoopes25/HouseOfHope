using System.Net.Http.Json;
using System.Text.Json;
using HouseOfHope.API.Contracts;
using HouseOfHope.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;

namespace HouseOfHope.API.Controllers;

/// <summary>
/// Proxies donor churn prioritization from the Python ML service when configured.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthPolicies.ManageData)]
public class DonorChurnController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _hostEnvironment;
    private readonly ILogger<DonorChurnController> _logger;

    public DonorChurnController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IHostEnvironment hostEnvironment,
        ILogger<DonorChurnController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _hostEnvironment = hostEnvironment;
        _logger = logger;
    }

    /// <summary>
    /// Returns supporters ranked by estimated churn risk for the next 90 days (staff-only).
    /// Requires <c>DonorChurnMl:BaseUrl</c> and a running Python service (see ml-pipelines/donor_churn/README.md).
    /// </summary>
    [HttpGet("churn-priorities")]
    [ProducesResponseType(typeof(DonorChurnPrioritiesResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetChurnPriorities(CancellationToken ct)
    {
        var baseUrl = _configuration["DonorChurnMl:BaseUrl"]?.Trim();
        if (string.IsNullOrEmpty(baseUrl) && _hostEnvironment.IsDevelopment())
            baseUrl = "http://127.0.0.1:5056";

        if (string.IsNullOrEmpty(baseUrl))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Donor churn ML is not configured. Set DonorChurnMl:BaseUrl and run the Python service."
            });
        }

        var client = _httpClientFactory.CreateClient("DonorChurnMl");
        client.Timeout = TimeSpan.FromMinutes(2);

        var uri = baseUrl.TrimEnd('/') + "/v1/churn-priorities";
        try
        {
            using var response = await client.GetAsync(uri, ct);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(ct);
                _logger.LogWarning("Donor churn ML service returned {Status}: {Body}", response.StatusCode, body);
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    error = "Donor churn ML service returned an error.",
                    status = (int)response.StatusCode,
                    detail = body
                });
            }

            var dto = await response.Content.ReadFromJsonAsync<DonorChurnPrioritiesResponseDto>(
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                ct);
            if (dto == null)
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "Empty response from ML service." });

            return Ok(dto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reach donor churn ML service at {Uri}", uri);
            var detail = ex.InnerException != null ? $"{ex.Message} ({ex.InnerException.Message})" : ex.Message;
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                error = "Could not reach donor churn ML service.",
                detail
            });
        }
    }
}
