using Microsoft.AspNetCore.Identity;
using Microsoft.VisualBasic;

namespace RootkitAuth.API.Data
{
    public class AuthIdentityGenerator
    {
        public static async Task GenerateDefaultIdentityAsync(IServiceProvider serviceProvider, IConfiguration configuration)
        {
            var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();

            foreach (var roleName in new[] { AuthRoles.Admin, AuthRoles.Customer })
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    var createRoleResults = await roleManager.CreateAsync(new IdentityRole(roleName));

                    if (!createRoleResults.Succeeded)
                    {
                        throw new Exception($"Failed to create role '{roleName}': {string.Join(", ", createRoleResults.Errors.Select(e => e.Description))}");
                    }
                }
            }
        
            var adminSection = configuration.GetSection("GenerateDefaultIdentityAdmin");
            var adminEmail = adminSection["Email"] ?? "admin@rootkit.local";
            var adminPassword = adminSection["Password"] ?? "Rootkit2026!Admin";

            var adminUser = await userManager.FindByEmailAsync(adminEmail);
            if (adminUser == null)
            {
                adminUser = new ApplicationUser
                {
                    UserName = adminEmail,
                    Email = adminEmail,
                    EmailConfirmed = true
                };

                var createAdminResult = await userManager.CreateAsync(adminUser, adminPassword);
                if (!createAdminResult.Succeeded)
                {
                    throw new Exception($"Failed to create admin user: {string.Join(", ", createAdminResult.Errors.Select(e => e.Description))}");
                }
            }
            if (!await userManager.IsInRoleAsync(adminUser, AuthRoles.Admin))
            {
                var addToRoleResult = await userManager.AddToRoleAsync(adminUser, AuthRoles.Admin);
                if (!addToRoleResult.Succeeded)
                {
                    throw new Exception($"Failed to assign admin role to user: {string.Join(", ", addToRoleResult.Errors.Select(e => e.Description))}");
                }
            }
        }
    }
}