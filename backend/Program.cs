using HouseOfHope.API.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.AddDbContext<LighthouseDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Lighthouse")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "https://localhost:3000",
                "https://127.0.0.1:3000",
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors("Frontend");
// In Development, skip HTTPS redirection so the SPA can call http://localhost:4000 without a redirect
// (redirects confuse CORS for fetch). Use https://localhost:5000 directly when you want TLS.
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
