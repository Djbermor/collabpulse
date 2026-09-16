using CollabPulse.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CollabPulse.Infrastructure.Data.Configurations;

public class FileMetadataConfiguration : IEntityTypeConfiguration<FileMetadata>
{
    public void Configure(EntityTypeBuilder<FileMetadata> builder)
    {
        builder.ToTable("files", t =>
        {
            t.HasCheckConstraint("chk_files_size", "size_bytes >= 0");
        });

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(f => f.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(f => f.UploadedBy).HasColumnName("uploaded_by").IsRequired();
        builder.Property(f => f.OriginalName).HasColumnName("original_name").HasMaxLength(500).IsRequired();
        builder.Property(f => f.StorageName).HasColumnName("storage_name").HasMaxLength(500).IsRequired();

        builder.Property(f => f.StorageProvider)
            .HasColumnName("storage_provider")
            .HasMaxLength(50)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(f => f.StoragePath).HasColumnName("storage_path").IsRequired();
        builder.Property(f => f.MimeType).HasColumnName("mime_type").HasMaxLength(200).IsRequired();
        builder.Property(f => f.Extension).HasColumnName("extension").HasMaxLength(20).IsRequired();
        builder.Property(f => f.SizeBytes).HasColumnName("size_bytes").IsRequired();
        builder.Property(f => f.Checksum).HasColumnName("checksum").HasMaxLength(128);
        builder.Property(f => f.IsPublic).HasColumnName("is_public").HasDefaultValue(false);
        builder.Property(f => f.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(f => f.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(f => new { f.TenantId, f.CreatedAt }).HasFilter("deleted_at IS NULL");
        builder.HasIndex(f => f.UploadedBy);

        builder.HasOne(f => f.Uploader)
            .WithMany()
            .HasForeignKey(f => f.UploadedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications");

        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(n => n.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(n => n.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(n => n.NotificationType).HasColumnName("notification_type").HasMaxLength(50).IsRequired();
        builder.Property(n => n.Title).HasColumnName("title").HasMaxLength(200).IsRequired();
        builder.Property(n => n.Message).HasColumnName("message").IsRequired();
        builder.Property(n => n.EntityType).HasColumnName("entity_type").HasMaxLength(100);
        builder.Property(n => n.EntityId).HasColumnName("entity_id");
        builder.Property(n => n.IsRead).HasColumnName("is_read").HasDefaultValue(false);
        builder.Property(n => n.ReadAt).HasColumnName("read_at");
        builder.Property(n => n.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");

        // Recommended composite index for feed speed
        builder.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });

        builder.HasOne(n => n.User)
            .WithMany(u => u.Notifications)
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(a => a.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(a => a.UserId).HasColumnName("user_id");
        builder.Property(a => a.Action).HasColumnName("action").HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityType).HasColumnName("entity_type").HasMaxLength(100).IsRequired();
        builder.Property(a => a.EntityId).HasColumnName("entity_id");
        builder.Property(a => a.IpAddress).HasColumnName("ip_address");
        builder.Property(a => a.UserAgent).HasColumnName("user_agent");
        builder.Property(a => a.RequestId).HasColumnName("request_id");
        builder.Property(a => a.MetadataJson).HasColumnName("metadata").HasColumnType("jsonb");
        builder.Property(a => a.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");

        builder.HasIndex(a => new { a.TenantId, a.CreatedAt });
        builder.HasIndex(a => new { a.TenantId, a.UserId });
        builder.HasIndex(a => new { a.TenantId, a.Action });
        builder.HasIndex(a => a.RequestId);
    }
}
