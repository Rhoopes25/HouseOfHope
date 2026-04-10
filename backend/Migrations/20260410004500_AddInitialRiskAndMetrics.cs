using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HouseOfHope.API.Migrations;

/// <summary>Adds residents.initial_risk_level and safehouse_monthly_metrics (SQL Server / Azure SQL).</summary>
public partial class AddInitialRiskAndMetrics : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "initial_risk_level",
            table: "residents",
            type: "nvarchar(max)",
            nullable: true);

        migrationBuilder.CreateTable(
            name: "safehouse_monthly_metrics",
            columns: table => new
            {
                metric_id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                safehouse_id = table.Column<int>(type: "int", nullable: false),
                month_start = table.Column<string>(type: "nvarchar(max)", nullable: true),
                month_end = table.Column<string>(type: "nvarchar(max)", nullable: true),
                active_residents = table.Column<int>(type: "int", nullable: true),
                avg_education_progress = table.Column<double>(type: "float", nullable: true),
                avg_health_score = table.Column<double>(type: "float", nullable: true),
                process_recording_count = table.Column<int>(type: "int", nullable: true),
                home_visitation_count = table.Column<int>(type: "int", nullable: true),
                incident_count = table.Column<int>(type: "int", nullable: true),
                notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_safehouse_monthly_metrics", x => x.metric_id);
                table.ForeignKey(
                    name: "FK_safehouse_monthly_metrics_safehouses_safehouse_id",
                    column: x => x.safehouse_id,
                    principalTable: "safehouses",
                    principalColumn: "safehouse_id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_safehouse_monthly_metrics_safehouse_id",
            table: "safehouse_monthly_metrics",
            column: "safehouse_id");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "safehouse_monthly_metrics");

        migrationBuilder.DropColumn(
            name: "initial_risk_level",
            table: "residents");
    }
}
