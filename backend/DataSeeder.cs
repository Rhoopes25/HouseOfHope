using System.Globalization;
using System.Runtime.CompilerServices;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Data;

public static class DataSeeder
{
    public static void Seed(LighthouseDbContext context, string contentRootPath)
    {
        var residentsPath = CsvPath(contentRootPath, "residents.csv");

        Console.WriteLine($"DIAGNOSTIC: ContentRootPath: {contentRootPath}");
        Console.WriteLine($"DIAGNOSTIC: Expected residents.csv path: {residentsPath}");
        var seedDataDir = Path.Combine(contentRootPath, "SeedData");
        if (Directory.Exists(seedDataDir))
        {
            var csvNames = Directory.GetFiles(seedDataDir, "*.csv").Select(Path.GetFileName);
            Console.WriteLine($"DIAGNOSTIC: SeedData folder found; CSV files ({csvNames.Count()}): {string.Join(", ", csvNames)}");
        }
        else
        {
            Console.WriteLine($"DIAGNOSTIC: SeedData folder NOT found at: {seedDataDir}");
        }

        // PHASE 1: Parent Tables (No dependencies)
        if (!context.Safehouses.Any() && File.Exists(CsvPath(contentRootPath, "safehouses.csv")))
        {
            var safehouses = ReadCsv<Safehouse>(CsvPath(contentRootPath, "safehouses.csv"));
            SeedWithIdentityInsert(context, "safehouses", safehouses);
        }

        if (!context.Supporters.Any() && File.Exists(CsvPath(contentRootPath, "supporters.csv")))
        {
            var supporters = ReadCsv<Supporter>(CsvPath(contentRootPath, "supporters.csv"));
            SeedWithIdentityInsert(context, "supporters", supporters);
        }

        // PHASE 2: Core Entities (Rely on Phase 1)
        if (!context.Residents.Any() && File.Exists(residentsPath))
        {
            var residents = ReadCsv<Resident>(residentsPath);
            SeedWithIdentityInsert(context, "residents", residents);
        }
        else
        {
            Console.WriteLine(
                $"DIAGNOSTIC: Residents seed skipped. Table has data: {context.Residents.Any()}, File exists: {File.Exists(residentsPath)}");
        }

        if (!context.EducationRecords.Any() && File.Exists(CsvPath(contentRootPath, "education_records.csv")))
        {
            var educationRecords = ReadCsv<EducationRecord>(CsvPath(contentRootPath, "education_records.csv"));
            SeedWithIdentityInsert(context, "education_records", educationRecords);
        }

        if (!context.HealthWellbeingRecords.Any() && File.Exists(CsvPath(contentRootPath, "health_wellbeing_records.csv")))
        {
            var healthRecords = ReadCsv<HealthWellbeingRecord>(CsvPath(contentRootPath, "health_wellbeing_records.csv"));
            SeedWithIdentityInsert(context, "health_wellbeing_records", healthRecords);
        }
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static string CsvPath(string baseDirectory, string fileName) =>
        Path.Combine(baseDirectory, "SeedData", fileName);

    private static List<T> ReadCsv<T>(string filePath)
    {
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            PrepareHeaderForMatch = args => SnakeToPascalHeader(args.Header)
        };
        using var reader = new StreamReader(filePath);
        using var csv = new CsvReader(reader, config);
        return csv.GetRecords<T>().ToList();
    }

    /// <summary>Maps CSV headers like education_record_id to EducationRecordId for CsvHelper.</summary>
    private static string SnakeToPascalHeader(string header)
    {
        var parts = header.Split('_', StringSplitOptions.RemoveEmptyEntries);
        return string.Concat(parts.Select(static p =>
            p.Length == 0 ? string.Empty : char.ToUpperInvariant(p[0]) + p[1..].ToLowerInvariant()));
    }

    private static void SeedWithIdentityInsert<T>(LighthouseDbContext context, string tableName, List<T> entities) where T : class
    {
        if (!entities.Any()) return;

        using var transaction = context.Database.BeginTransaction();
        try
        {
            context.Set<T>().AddRange(entities);
            context.Database.ExecuteSqlRaw($"SET IDENTITY_INSERT [{tableName}] ON");
            context.SaveChanges();
            context.Database.ExecuteSqlRaw($"SET IDENTITY_INSERT [{tableName}] OFF");
            transaction.Commit();
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            Console.WriteLine($"DIAGNOSTIC: CRITICAL ERROR seeding table [{tableName}]: {ex.Message}");
            if (ex.InnerException != null)
                Console.WriteLine($"DIAGNOSTIC: Inner exception: {ex.InnerException.Message}");
            throw;
        }
    }
}
