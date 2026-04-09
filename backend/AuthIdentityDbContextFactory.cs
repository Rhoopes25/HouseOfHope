using HouseOfHope.API.Data;
using HouseOfHope.API.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace HouseOfHope.API;

/// <summary>
/// Used by <c>dotnet ef</c> only. Defaults to Production (SQL Server) so migrations match Azure;
/// set <c>ASPNETCORE_ENVIRONMENT=Development</c> to scaffold against SQLite.
/// </summary>
public sealed class AuthIdentityDbContextFactory : IDesignTimeDbContextFactory<AuthIdentityDbContext>
{
    public AuthIdentityDbContext CreateDbContext(string[] args)
    {
        var env = ResolveEnvironment(args);

        var config = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile($"appsettings.{env}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var optionsBuilder = new DbContextOptionsBuilder<AuthIdentityDbContext>();

        if (string.Equals(env, "Development", StringComparison.OrdinalIgnoreCase))
        {
            var identityConnection = config.GetConnectionString("IdentityConnection")
                ?? "Data Source=houseofhope_identity.sqlite";
            optionsBuilder.UseSqlite(identityConnection);
        }
        else
        {
            var cs = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException(
                    "DefaultConnection is missing. Set it in appsettings or ConnectionStrings__DefaultConnection.");
            optionsBuilder.UseSqlServer(cs, sql => sql.MigrationsHistoryTable(EfMigrationHistory.IdentityTable));
        }

        return new AuthIdentityDbContext(optionsBuilder.Options);
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
