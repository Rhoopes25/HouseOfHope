namespace HouseOfHope.API.Infrastructure;

/// <summary>
/// Separate EF migration history tables when multiple DbContexts share one SQL Server database.
/// </summary>
public static class EfMigrationHistory
{
    public const string LighthouseTable = "__LighthouseMigrationsHistory";
    public const string IdentityTable = "__IdentityMigrationsHistory";
}
