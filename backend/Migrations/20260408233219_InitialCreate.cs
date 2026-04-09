using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HouseOfHope.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "education_records",
                columns: table => new
                {
                    education_record_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    resident_id = table.Column<int>(type: "int", nullable: false),
                    record_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    progress_percent = table.Column<double>(type: "float", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_education_records", x => x.education_record_id);
                });

            migrationBuilder.CreateTable(
                name: "health_wellbeing_records",
                columns: table => new
                {
                    health_record_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    resident_id = table.Column<int>(type: "int", nullable: false),
                    record_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    general_health_score = table.Column<double>(type: "float", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_health_wellbeing_records", x => x.health_record_id);
                });

            migrationBuilder.CreateTable(
                name: "home_visitations",
                columns: table => new
                {
                    visitation_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    resident_id = table.Column<int>(type: "int", nullable: false),
                    visit_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    social_worker = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    visit_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    location_visited = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    family_members_present = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    purpose = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    observations = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    family_cooperation_level = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    safety_concerns_noted = table.Column<int>(type: "int", nullable: false),
                    follow_up_needed = table.Column<int>(type: "int", nullable: false),
                    visit_outcome = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_home_visitations", x => x.visitation_id);
                });

            migrationBuilder.CreateTable(
                name: "incident_reports",
                columns: table => new
                {
                    incident_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    incident_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    severity = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_incident_reports", x => x.incident_id);
                });

            migrationBuilder.CreateTable(
                name: "intervention_plans",
                columns: table => new
                {
                    plan_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    resident_id = table.Column<int>(type: "int", nullable: false),
                    plan_category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    plan_description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    services_provided = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    target_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    case_conference_date = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_intervention_plans", x => x.plan_id);
                });

            migrationBuilder.CreateTable(
                name: "process_recordings",
                columns: table => new
                {
                    recording_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    resident_id = table.Column<int>(type: "int", nullable: false),
                    session_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    social_worker = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    session_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    session_duration_minutes = table.Column<int>(type: "int", nullable: true),
                    emotional_state_observed = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    emotional_state_end = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    session_narrative = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    interventions_applied = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    follow_up_actions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    progress_noted = table.Column<int>(type: "int", nullable: false),
                    concerns_flagged = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_process_recordings", x => x.recording_id);
                });

            migrationBuilder.CreateTable(
                name: "public_impact_snapshots",
                columns: table => new
                {
                    snapshot_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    snapshot_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    metric_payload_json = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_public_impact_snapshots", x => x.snapshot_id);
                });

            migrationBuilder.CreateTable(
                name: "safehouses",
                columns: table => new
                {
                    safehouse_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    name = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_safehouses", x => x.safehouse_id);
                });

            migrationBuilder.CreateTable(
                name: "social_media_posts",
                columns: table => new
                {
                    post_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    platform = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    post_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    media_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    impressions = table.Column<int>(type: "int", nullable: true),
                    reach = table.Column<int>(type: "int", nullable: true),
                    engagement_rate = table.Column<double>(type: "float", nullable: true),
                    donation_referrals = table.Column<int>(type: "int", nullable: true),
                    estimated_donation_value_php = table.Column<double>(type: "float", nullable: true),
                    content_topic = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    sentiment_tone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    campaign_name = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_social_media_posts", x => x.post_id);
                });

            migrationBuilder.CreateTable(
                name: "supporters",
                columns: table => new
                {
                    supporter_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    supporter_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    display_name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    country = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    region = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    first_donation_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    acquisition_channel = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supporters", x => x.supporter_id);
                });

            migrationBuilder.CreateTable(
                name: "residents",
                columns: table => new
                {
                    resident_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    case_control_no = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    internal_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    safehouse_id = table.Column<int>(type: "int", nullable: false),
                    case_status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    case_category = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    sub_cat_orphaned = table.Column<int>(type: "int", nullable: false),
                    sub_cat_trafficked = table.Column<int>(type: "int", nullable: false),
                    sub_cat_child_labor = table.Column<int>(type: "int", nullable: false),
                    sub_cat_physical_abuse = table.Column<int>(type: "int", nullable: false),
                    sub_cat_sexual_abuse = table.Column<int>(type: "int", nullable: false),
                    sub_cat_osaec = table.Column<int>(type: "int", nullable: false),
                    sub_cat_cicl = table.Column<int>(type: "int", nullable: false),
                    sub_cat_at_risk = table.Column<int>(type: "int", nullable: false),
                    sub_cat_street_child = table.Column<int>(type: "int", nullable: false),
                    sub_cat_child_with_hiv = table.Column<int>(type: "int", nullable: false),
                    current_risk_level = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    assigned_social_worker = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reintegration_status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reintegration_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_of_admission = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    date_of_birth = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    religion = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    birth_status = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    place_of_birth = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    referral_source = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    referring_agency_person = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    initial_case_assessment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    family_is_4ps = table.Column<int>(type: "int", nullable: false),
                    family_solo_parent = table.Column<int>(type: "int", nullable: false),
                    family_indigenous = table.Column<int>(type: "int", nullable: false),
                    family_informal_settler = table.Column<int>(type: "int", nullable: false),
                    family_parent_pwd = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_residents", x => x.resident_id);
                    table.ForeignKey(
                        name: "FK_residents_safehouses_safehouse_id",
                        column: x => x.safehouse_id,
                        principalTable: "safehouses",
                        principalColumn: "safehouse_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "donations",
                columns: table => new
                {
                    donation_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    supporter_id = table.Column<int>(type: "int", nullable: false),
                    donation_type = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    donation_date = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    amount = table.Column<double>(type: "float", nullable: true),
                    estimated_value = table.Column<double>(type: "float", nullable: true),
                    currency_code = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    campaign_name = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_donations", x => x.donation_id);
                    table.ForeignKey(
                        name: "FK_donations_supporters_supporter_id",
                        column: x => x.supporter_id,
                        principalTable: "supporters",
                        principalColumn: "supporter_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_donations_supporter_id",
                table: "donations",
                column: "supporter_id");

            migrationBuilder.CreateIndex(
                name: "IX_residents_safehouse_id",
                table: "residents",
                column: "safehouse_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "donations");

            migrationBuilder.DropTable(
                name: "education_records");

            migrationBuilder.DropTable(
                name: "health_wellbeing_records");

            migrationBuilder.DropTable(
                name: "home_visitations");

            migrationBuilder.DropTable(
                name: "incident_reports");

            migrationBuilder.DropTable(
                name: "intervention_plans");

            migrationBuilder.DropTable(
                name: "process_recordings");

            migrationBuilder.DropTable(
                name: "public_impact_snapshots");

            migrationBuilder.DropTable(
                name: "residents");

            migrationBuilder.DropTable(
                name: "social_media_posts");

            migrationBuilder.DropTable(
                name: "supporters");

            migrationBuilder.DropTable(
                name: "safehouses");
        }
    }
}
