using CollabPulse.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CollabPulse.Infrastructure.Data.Configurations;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenants");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");

        builder.Property(t => t.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(t => t.Slug).HasColumnName("slug").HasMaxLength(100).IsRequired();
        builder.Property(t => t.Description).HasColumnName("description");
        builder.Property(t => t.LogoUrl).HasColumnName("logo_url");
        builder.Property(t => t.Timezone).HasColumnName("timezone").HasMaxLength(100).HasDefaultValue("UTC");
        builder.Property(t => t.Language).HasColumnName("language").HasMaxLength(10).HasDefaultValue("es");
        builder.Property(t => t.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").IsRequired().HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at").IsRequired().HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(t => t.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(t => t.Slug).IsUnique();
        builder.HasIndex(t => t.IsActive).HasFilter("deleted_at IS NULL");
    }
}

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(u => u.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(u => u.FirstName).HasColumnName("first_name").HasMaxLength(100).IsRequired();
        builder.Property(u => u.LastName).HasColumnName("last_name").HasMaxLength(100).IsRequired();
        builder.Property(u => u.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
        builder.Property(u => u.PasswordHash).HasColumnName("password_hash").IsRequired();
        builder.Property(u => u.AvatarUrl).HasColumnName("avatar_url");
        builder.Property(u => u.JobTitle).HasColumnName("job_title").HasMaxLength(150);
        builder.Property(u => u.Phone).HasColumnName("phone").HasMaxLength(50);
        builder.Property(u => u.Timezone).HasColumnName("timezone").HasMaxLength(100).HasDefaultValue("UTC");

        builder.Property(u => u.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(u => u.CustomStatus).HasColumnName("custom_status");
        builder.Property(u => u.CustomStatusExpiresAt).HasColumnName("custom_status_expires_at");
        builder.Property(u => u.LastSeenAt).HasColumnName("last_seen_at");
        builder.Property(u => u.IsEmailVerified).HasColumnName("is_email_verified").HasDefaultValue(false);
        builder.Property(u => u.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(u => u.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(u => u.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(u => u.DeletedAt).HasColumnName("deleted_at");

        // Constraints & Indexes
        builder.HasIndex(u => new { u.TenantId, u.Email }).IsUnique();
        builder.HasIndex(u => new { u.TenantId, u.Status }).HasFilter("deleted_at IS NULL");
        builder.HasIndex(u => new { u.TenantId, u.LastSeenAt });

        builder.HasOne(u => u.Tenant)
            .WithMany(t => t.Users)
            .HasForeignKey(u => u.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
