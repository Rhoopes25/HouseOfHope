using System.Security.Claims;
using HouseOfHope.API.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace HouseOfHope.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager) : ControllerBase
{
    [HttpPost("register-with-roles")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var email = request.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Email and password are required." });
        }

        var normalizedRoles = (request.Roles ?? [])
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedRoles.Count == 0)
        {
            return BadRequest(new { message = "Select at least one role." });
        }

        foreach (var role in normalizedRoles)
        {
            if (!string.Equals(role, AuthRoles.Admin, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(role, AuthRoles.Donor, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = $"Unsupported role '{role}'." });
            }
        }

        var existingUser = await userManager.FindByEmailAsync(email);
        if (existingUser != null)
        {
            return BadRequest(new { message = "An account with that email already exists." });
        }

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var createResult = await userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var message = createResult.Errors.FirstOrDefault()?.Description ?? "Unable to create account.";
            return BadRequest(new { message });
        }

        var roleResult = await userManager.AddToRolesAsync(user, normalizedRoles);
        if (!roleResult.Succeeded)
        {
            var message = roleResult.Errors.FirstOrDefault()?.Description ?? "Unable to assign roles.";
            return BadRequest(new { message });
        }

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            await userManager.AddClaimAsync(user, new Claim("supporter_display_name", request.DisplayName.Trim()));
        }

        await signInManager.SignInAsync(user, isPersistent: false);

        return Ok(new
        {
            message = "Registration successful.",
            roles = normalizedRoles
        });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentSession()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Ok(new
            {
                isAuthenticated = false,
                userName = (string?)null,
                email = (string?)null,
                roles = Array.Empty<string>()
            });
        }

        var user = await userManager.GetUserAsync(User);
        if (user == null)
        {
            // Identity API cookie may occasionally lack one lookup path; try common fallbacks.
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrWhiteSpace(userId))
            {
                user = await userManager.FindByIdAsync(userId);
            }

            if (user == null)
            {
                var email = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity?.Name;
                if (!string.IsNullOrWhiteSpace(email))
                {
                    user = await userManager.FindByEmailAsync(email);
                }
            }
        }

        var rolesFromStore = user == null
            ? Array.Empty<string>()
            : (await userManager.GetRolesAsync(user)).ToArray();
        var rolesFromClaims = User.Claims
            .Where(c => c.Type == ClaimTypes.Role)
            .Select(c => c.Value)
            .ToArray();
        var roles = rolesFromStore
            .Concat(rolesFromClaims)
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(role => role)
            .ToArray();

        var supporterDisplayName = User.Claims.FirstOrDefault(c => c.Type == "supporter_display_name")?.Value;

        return Ok(new
        {
            isAuthenticated = true,
            userName = user?.UserName ?? User.Identity?.Name,
            email = user?.Email,
            supporterDisplayName,
            roles
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return Ok(new { message = "Logout successful." });
    }
}

public class RegisterRequest
{
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? DisplayName { get; set; }
    public List<string>? Roles { get; set; }
}
