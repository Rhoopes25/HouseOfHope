using Microsoft.AspNetCore.Identity;

namespace HouseOfHope.API.Data;

public static class AuthIdentityGenerator
{
    private sealed record SeedUserConfig(string Email, string Password, string? DisplayName = null);

    public static async Task GenerateDefaultIdentityAsync(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var roleName in new[] { AuthRoles.Admin, AuthRoles.Donor })
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var createRoleResult = await roleManager.CreateAsync(new IdentityRole(roleName));
                if (!createRoleResult.Succeeded)
                {
                    throw new Exception($"Failed to create role '{roleName}'.");
                }
            }
        }

        var admin = GetSeedUserConfig(configuration, "GenerateDefaultIdentityAdmin");
        if (admin is not null)
        {
            await EnsureUserWithRoleAsync(userManager, admin.Email, admin.Password, AuthRoles.Admin);
        }

        var donor = GetSeedUserConfig(configuration, "GenerateDefaultIdentityDonor");
        if (donor is not null)
        {
            var donorUser = await EnsureUserWithRoleAsync(userManager, donor.Email, donor.Password, AuthRoles.Donor);
            if (!string.IsNullOrWhiteSpace(donor.DisplayName))
            {
                var currentClaims = await userManager.GetClaimsAsync(donorUser);
                if (currentClaims.All(c => c.Type != "supporter_display_name"))
                {
                    await userManager.AddClaimAsync(
                        donorUser,
                        new System.Security.Claims.Claim("supporter_display_name", donor.DisplayName));
                }
            }
        }
    }

    private static SeedUserConfig? GetSeedUserConfig(IConfiguration configuration, string sectionName)
    {
        var section = configuration.GetSection(sectionName);
        var email = section["Email"];
        var password = section["Password"];
        var displayName = section["DisplayName"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        return new SeedUserConfig(email, password, displayName);
    }

    private static async Task<ApplicationUser> EnsureUserWithRoleAsync(
        UserManager<ApplicationUser> userManager,
        string email,
        string password,
        string role)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user == null)
        {
            user = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true
            };

            var createUserResult = await userManager.CreateAsync(user, password);
            if (!createUserResult.Succeeded)
            {
                throw new Exception($"Failed to create seeded user '{email}'.");
            }
        }

        if (!await userManager.IsInRoleAsync(user, role))
        {
            var addRoleResult = await userManager.AddToRoleAsync(user, role);
            if (!addRoleResult.Succeeded)
            {
                throw new Exception($"Failed to add role '{role}' for '{email}'.");
            }
        }

        return user;
    }
}
