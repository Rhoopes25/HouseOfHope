using Microsoft.AspNetCore.Identity;

namespace HouseOfHope.API.Data;

public static class AuthIdentityGenerator
{
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

        var adminSection = configuration.GetSection("GenerateDefaultIdentityAdmin");
        var adminEmail = adminSection["Email"] ?? "admin@houseofhope.local";
        var adminPassword = adminSection["Password"] ?? "HouseOfHope2026";
        await EnsureUserWithRoleAsync(userManager, adminEmail, adminPassword, AuthRoles.Admin);

        var donorSection = configuration.GetSection("GenerateDefaultIdentityDonor");
        var donorEmail = donorSection["Email"] ?? "donor@houseofhope.local";
        var donorPassword = donorSection["Password"] ?? "HouseOfHope2026";
        var donorDisplayName = donorSection["DisplayName"] ?? "Mila Alvarez";
        var donorUser = await EnsureUserWithRoleAsync(userManager, donorEmail, donorPassword, AuthRoles.Donor);

        var currentClaims = await userManager.GetClaimsAsync(donorUser);
        if (currentClaims.All(c => c.Type != "supporter_display_name"))
        {
            await userManager.AddClaimAsync(donorUser, new System.Security.Claims.Claim("supporter_display_name", donorDisplayName));
        }
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
