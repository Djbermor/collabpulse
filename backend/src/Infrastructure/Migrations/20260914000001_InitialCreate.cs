using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CollabPulse.Infrastructure.Migrations;

/// <inheritdoc />
public partial class InitialCreate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterDatabase()
            .Annotation("Npgsql:PostgresExtension:pgcrypto", ",,")
            .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
            .Annotation("Npgsql:PostgresExtension:unaccent", ",,");

        // Schema creation matching database/migrations/V1-V6
        migrationBuilder.Sql(@"
            DO $$ BEGIN
                CREATE EXTENSION IF NOT EXISTS ""pgcrypto"";
                CREATE EXTENSION IF NOT EXISTS ""pg_trgm"";
                CREATE EXTENSION IF NOT EXISTS ""unaccent"";
            END $$;
        ");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Down migration
    }
}
