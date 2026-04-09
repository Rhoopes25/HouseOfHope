using HouseOfHope.API.Data;
using HouseOfHope.API.Infrastructure;
using HouseOfHope.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
const string FrontendCorsPolicy = "Frontend";

builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddSingleton<SocialMediaPredictionService>();
builder.Services.AddScoped<CaseManagementPredictionService>();

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDbContext<LighthouseDbContext>(options =>
        options.UseSqlite(builder.Configuration.GetConnectionString("Lighthouse")));
}
else
{
    builder.Services.AddDbContext<LighthouseDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.MigrationsHistoryTable(EfMigrationHistory.LighthouseTable)));
}

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddDbContext<AuthIdentityDbContext>(options =>
    {
        var identityConnection = builder.Configuration.GetConnectionString("IdentityConnection")
            ?? "Data Source=houseofhope_identity.sqlite";
        options.UseSqlite(identityConnection);
    });
}
else
{
    builder.Services.AddDbContext<AuthIdentityDbContext>(options =>
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            sql => sql.MigrationsHistoryTable(EfMigrationHistory.IdentityTable)));
}

builder.Services.AddIdentityApiEndpoints<ApplicationUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AuthIdentityDbContext>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthPolicies.ManageData, policy => policy.RequireRole(AuthRoles.Admin));
});

builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 14;
    options.Password.RequiredUniqueChars = 1;
    options.Lockout.AllowedForNewUsers = true;
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("AuthEndpoints", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });
});

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    if (builder.Environment.IsDevelopment())
    {
        // Dev: Vite proxies /api to Kestrel — same site as the browser URL, Lax is fine.
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    }
    else
    {
        // Production: SPA on another host (e.g. Static Web Apps) calls the API cross-origin with credentials.
        // Browsers do not send SameSite=Lax cookies on those requests; None + Secure is required.
        options.Cookie.SameSite = SameSiteMode.None;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    }
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        var defaultOrigins = new[]
        {
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "https://localhost:3000",
            "https://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://localhost:5173",
            "https://127.0.0.1:5173",
            "https://polite-bush-0e7f0950f.1.azurestaticapps.net"
        };
        var configuredOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? [];
        var allowedOrigins = defaultOrigins
            .Concat(configuredOrigins)
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        policy.SetIsOriginAllowed(origin =>
            allowedOrigins.Contains(origin) ||
            (Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
             string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
             uri.Host.EndsWith(".azurestaticapps.net", StringComparison.OrdinalIgnoreCase)))
            .AllowCredentials()
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var appDb = services.GetRequiredService<LighthouseDbContext>();
    var identityDb = services.GetRequiredService<AuthIdentityDbContext>();

    if (app.Environment.IsDevelopment())
    {
        // In local SQLite dev, schema may already exist without matching EF migration history.
        // EnsureCreated avoids PendingModelChanges/table-exists startup crashes.
        appDb.Database.EnsureCreated();
        identityDb.Database.EnsureCreated();

        // Keep local development easy mode for seeded auth users/roles.
        await AuthIdentityGenerator.GenerateDefaultIdentityAsync(services, app.Configuration);
    }
    else
    {
        // PRODUCTION: intentionally no startup DB work to keep boot fast and reliable.
        // If you ever need one-time reseed/reinit, temporarily uncomment:
        // await appDb.Database.MigrateAsync();
        // DataSeeder.Seed(appDb, app.Environment.ContentRootPath);
        // await identityDb.Database.MigrateAsync();
        // await AuthIdentityGenerator.GenerateDefaultIdentityAsync(services, app.Configuration);
    }
}

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors(FrontendCorsPolicy);
app.UseSecurityHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGroup("/api/auth")
    .RequireRateLimiting("AuthEndpoints")
    .MapIdentityApi<ApplicationUser>();

app.Run();