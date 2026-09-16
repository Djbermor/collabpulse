using CollabPulse.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CollabPulse.Infrastructure.Data.Configurations;

public class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("tasks");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(t => t.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(t => t.WorkspaceId).HasColumnName("workspace_id").IsRequired();
        builder.Property(t => t.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(t => t.AssignedTo).HasColumnName("assigned_to");
        builder.Property(t => t.Title).HasColumnName("title").HasMaxLength(250).IsRequired();
        builder.Property(t => t.Description).HasColumnName("description");

        builder.Property(t => t.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(t => t.Priority)
            .HasColumnName("priority")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(t => t.DueDate).HasColumnName("due_date");
        builder.Property(t => t.CompletedAt).HasColumnName("completed_at");
        builder.Property(t => t.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(t => t.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(t => t.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(t => new { t.TenantId, t.AssignedTo, t.Status }).HasFilter("deleted_at IS NULL");
        builder.HasIndex(t => new { t.WorkspaceId, t.Status }).HasFilter("deleted_at IS NULL");

        builder.HasOne(t => t.Workspace)
            .WithMany(w => w.Tasks)
            .HasForeignKey(t => t.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Creator)
            .WithMany()
            .HasForeignKey(t => t.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.Assignee)
            .WithMany(u => u.AssignedTasks)
            .HasForeignKey(t => t.AssignedTo)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class MeetingConfiguration : IEntityTypeConfiguration<Meeting>
{
    public void Configure(EntityTypeBuilder<Meeting> builder)
    {
        builder.ToTable("meetings");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(m => m.WorkspaceId).HasColumnName("workspace_id").IsRequired();
        builder.Property(m => m.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(m => m.Title).HasColumnName("title").HasMaxLength(250).IsRequired();
        builder.Property(m => m.MeetingCode).HasColumnName("meeting_code").HasMaxLength(100).IsRequired();

        builder.Property(m => m.Provider)
            .HasColumnName("provider")
            .HasMaxLength(50)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(m => m.ProviderRoomId).HasColumnName("provider_room_id").HasMaxLength(250);
        builder.Property(m => m.StartAt).HasColumnName("start_at").IsRequired();
        builder.Property(m => m.EndAt).HasColumnName("end_at").IsRequired();

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(m => m.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(m => m.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");

        builder.HasIndex(m => m.MeetingCode);
        builder.HasIndex(m => new { m.TenantId, m.Status, m.StartAt });
    }
}

public class CalendarEventConfiguration : IEntityTypeConfiguration<CalendarEvent>
{
    public void Configure(EntityTypeBuilder<CalendarEvent> builder)
    {
        builder.ToTable("calendar_events");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(e => e.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(e => e.WorkspaceId).HasColumnName("workspace_id").IsRequired();
        builder.Property(e => e.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(e => e.Title).HasColumnName("title").HasMaxLength(250).IsRequired();
        builder.Property(e => e.Description).HasColumnName("description");
        builder.Property(e => e.StartAt).HasColumnName("start_at").IsRequired();
        builder.Property(e => e.EndAt).HasColumnName("end_at").IsRequired();
        builder.Property(e => e.Location).HasColumnName("location");
        builder.Property(e => e.MeetingId).HasColumnName("meeting_id");
        builder.Property(e => e.IsAllDay).HasColumnName("is_all_day").HasDefaultValue(false);
        builder.Property(e => e.RecurrenceRule).HasColumnName("recurrence_rule");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(e => e.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(e => new { e.TenantId, e.WorkspaceId, e.StartAt, e.EndAt })
            .HasFilter("deleted_at IS NULL");

        builder.HasOne(e => e.LinkedMeeting)
            .WithMany(m => m.LinkedCalendarEvents)
            .HasForeignKey(e => e.MeetingId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
