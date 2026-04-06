using Microsoft.EntityFrameworkCore;

namespace HouseOfHope.API.Data;

public class LighthouseDbContext : DbContext
{
    public LighthouseDbContext(DbContextOptions<LighthouseDbContext> options) : base(options) { }

    public DbSet<Resident> Residents => Set<Resident>();
    public DbSet<Safehouse> Safehouses => Set<Safehouse>();
    public DbSet<ProcessRecording> ProcessRecordings => Set<ProcessRecording>();
    public DbSet<HomeVisitation> HomeVisitations => Set<HomeVisitation>();
    public DbSet<InterventionPlan> InterventionPlans => Set<InterventionPlan>();
    public DbSet<Supporter> Supporters => Set<Supporter>();
    public DbSet<Donation> Donations => Set<Donation>();
    public DbSet<SocialMediaPost> SocialMediaPosts => Set<SocialMediaPost>();
    public DbSet<EducationRecord> EducationRecords => Set<EducationRecord>();
    public DbSet<HealthWellbeingRecord> HealthWellbeingRecords => Set<HealthWellbeingRecord>();
    public DbSet<PublicImpactSnapshot> PublicImpactSnapshots => Set<PublicImpactSnapshot>();
    public DbSet<IncidentReport> IncidentReports => Set<IncidentReport>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Resident>(e =>
        {
            e.ToTable("residents");
            e.HasKey(r => r.ResidentId);
            e.HasOne(r => r.Safehouse).WithMany().HasForeignKey(r => r.SafehouseId);
        });
        modelBuilder.Entity<Safehouse>(e => e.ToTable("safehouses"));
        modelBuilder.Entity<ProcessRecording>(e => e.ToTable("process_recordings"));
        modelBuilder.Entity<HomeVisitation>(e => e.ToTable("home_visitations"));
        modelBuilder.Entity<InterventionPlan>(e => e.ToTable("intervention_plans"));
        modelBuilder.Entity<Supporter>(e => e.ToTable("supporters"));
        modelBuilder.Entity<Donation>(e =>
        {
            e.ToTable("donations");
            e.HasOne(d => d.Supporter).WithMany().HasForeignKey(d => d.SupporterId);
        });
        modelBuilder.Entity<SocialMediaPost>(e => e.ToTable("social_media_posts"));
        modelBuilder.Entity<EducationRecord>(e => e.ToTable("education_records"));
        modelBuilder.Entity<HealthWellbeingRecord>(e => e.ToTable("health_wellbeing_records"));
        modelBuilder.Entity<PublicImpactSnapshot>(e => e.ToTable("public_impact_snapshots"));
        modelBuilder.Entity<IncidentReport>(e => e.ToTable("incident_reports"));
    }
}
