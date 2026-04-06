using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace HouseOfHope.API;

/// <summary>
/// Used by <c>dotnet ef</c> only. Defaults to Production (SQL Server) so migrations match Azure;
/// set <c>ASPNETCORE_ENVIRONMENT=Development</c> to scaffold or update against SQLite.
/// </summary>
public sealed class LighthouseDbContextFactory : IDesignTimeDbContextFactory<LighthouseDbContext>
{
    public LighthouseDbContext CreateDbContext(string[] args)
    {
        var env = ResolveEnvironment(args);

        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{env}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<LighthouseDbContext>();

        if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
        {
            optionsBuilder.UseSqlite(config.GetConnectionString("Lighthouse"));
        }
        else
        {
            var cs = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException(
                    "DefaultConnection is missing. Set it in appsettings or ConnectionStrings__DefaultConnection.");
            optionsBuilder.UseSqlServer(cs);
        }

        return new LighthouseDbContext(optionsBuilder.Options);
    }

    private static string ResolveEnvironment(string[] args)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] is "--environment" or "--Environment")
                return args[i + 1];
        }

        return Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
    }
}
