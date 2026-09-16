using CollabPulse.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CollabPulse.Infrastructure.Data.Configurations;

public class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.ToTable("workspaces");

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(w => w.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(w => w.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
        builder.Property(w => w.Slug).HasColumnName("slug").HasMaxLength(100).IsRequired();
        builder.Property(w => w.Description).HasColumnName("description");
        builder.Property(w => w.LogoUrl).HasColumnName("logo_url");
        builder.Property(w => w.Timezone).HasColumnName("timezone").HasMaxLength(100).HasDefaultValue("UTC");
        builder.Property(w => w.IsActive).HasColumnName("is_active").HasDefaultValue(true);
        builder.Property(w => w.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(w => w.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(w => w.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(w => new { w.TenantId, w.Slug }).IsUnique();
        builder.HasIndex(w => w.TenantId).HasFilter("deleted_at IS NULL");

        builder.HasOne(w => w.Tenant)
            .WithMany(t => t.Workspaces)
            .HasForeignKey(w => w.TenantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class WorkspaceMemberConfiguration : IEntityTypeConfiguration<WorkspaceMember>
{
    public void Configure(EntityTypeBuilder<WorkspaceMember> builder)
    {
        builder.ToTable("workspace_members");

        builder.HasKey(wm => new { wm.WorkspaceId, wm.UserId });
        builder.Property(wm => wm.WorkspaceId).HasColumnName("workspace_id");
        builder.Property(wm => wm.UserId).HasColumnName("user_id");
        builder.Property(wm => wm.RoleId).HasColumnName("role_id");
        builder.Property(wm => wm.JoinedAt).HasColumnName("joined_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(wm => wm.LastActiveAt).HasColumnName("last_active_at");
        builder.Property(wm => wm.IsActive).HasColumnName("is_active").HasDefaultValue(true);

        builder.HasOne(wm => wm.Workspace)
            .WithMany(w => w.Members)
            .HasForeignKey(wm => wm.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(wm => wm.User)
            .WithMany(u => u.WorkspaceMemberships)
            .HasForeignKey(wm => wm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ChannelConfiguration : IEntityTypeConfiguration<Channel>
{
    public void Configure(EntityTypeBuilder<Channel> builder)
    {
        builder.ToTable("channels");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(c => c.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(c => c.WorkspaceId).HasColumnName("workspace_id").IsRequired();
        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(c => c.Slug).HasColumnName("slug").HasMaxLength(120).IsRequired();
        builder.Property(c => c.Description).HasColumnName("description");

        builder.Property(c => c.ChannelType)
            .HasColumnName("channel_type")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(c => c.IsArchived).HasColumnName("is_archived").HasDefaultValue(false);
        builder.Property(c => c.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(c => c.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(c => new { c.WorkspaceId, c.Slug }).IsUnique();
        builder.HasIndex(c => c.WorkspaceId).HasFilter("deleted_at IS NULL");

        builder.HasOne(c => c.Workspace)
            .WithMany(w => w.Channels)
            .HasForeignKey(c => c.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Creator)
            .WithMany()
            .HasForeignKey(c => c.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ChannelMemberConfiguration : IEntityTypeConfiguration<ChannelMember>
{
    public void Configure(EntityTypeBuilder<ChannelMember> builder)
    {
        builder.ToTable("channel_members");

        builder.HasKey(cm => new { cm.ChannelId, cm.UserId });
        builder.Property(cm => cm.ChannelId).HasColumnName("channel_id");
        builder.Property(cm => cm.UserId).HasColumnName("user_id");
        builder.Property(cm => cm.JoinedAt).HasColumnName("joined_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(cm => cm.LastReadAt).HasColumnName("last_read_at");
        builder.Property(cm => cm.IsMuted).HasColumnName("is_muted").HasDefaultValue(false);
        builder.Property(cm => cm.NotificationsEnabled).HasColumnName("notifications_enabled").HasDefaultValue(true);

        builder.HasOne(cm => cm.Channel)
            .WithMany(c => c.Members)
            .HasForeignKey(cm => cm.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cm => cm.User)
            .WithMany(u => u.ChannelMemberships)
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
