using CollabPulse.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CollabPulse.Infrastructure.Data.Configurations;

public class ConversationConfiguration : IEntityTypeConfiguration<Conversation>
{
    public void Configure(EntityTypeBuilder<Conversation> builder)
    {
        builder.ToTable("conversations");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(c => c.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(c => c.WorkspaceId).HasColumnName("workspace_id").IsRequired();

        builder.Property(c => c.ConversationType)
            .HasColumnName("conversation_type")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(150);
        builder.Property(c => c.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(c => c.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(c => c.DeletedAt).HasColumnName("deleted_at");

        builder.HasIndex(c => c.WorkspaceId).HasFilter("deleted_at IS NULL");

        builder.HasOne(c => c.Workspace)
            .WithMany(w => w.Conversations)
            .HasForeignKey(c => c.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Creator)
            .WithMany()
            .HasForeignKey(c => c.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("messages", t =>
        {
            t.HasCheckConstraint("chk_message_target",
                "(channel_id IS NOT NULL AND conversation_id IS NULL) OR (channel_id IS NULL AND conversation_id IS NOT NULL)");
        });

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
        builder.Property(m => m.TenantId).HasColumnName("tenant_id").IsRequired();
        builder.Property(m => m.WorkspaceId).HasColumnName("workspace_id").IsRequired();
        builder.Property(m => m.ChannelId).HasColumnName("channel_id");
        builder.Property(m => m.ConversationId).HasColumnName("conversation_id");
        builder.Property(m => m.SenderId).HasColumnName("sender_id").IsRequired();
        builder.Property(m => m.ParentMessageId).HasColumnName("parent_message_id");
        builder.Property(m => m.Content).HasColumnName("content").IsRequired();

        builder.Property(m => m.MessageType)
            .HasColumnName("message_type")
            .HasMaxLength(30)
            .HasConversion<string>()
            .IsRequired();

        builder.Property(m => m.IsEdited).HasColumnName("is_edited").HasDefaultValue(false);
        builder.Property(m => m.EditedAt).HasColumnName("edited_at");
        builder.Property(m => m.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
        builder.Property(m => m.DeletedAt).HasColumnName("deleted_at");
        builder.Property(m => m.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");
        builder.Property(m => m.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("CLOCK_TIMESTAMP()");

        // Critical indexes for high concurrency & timeline querying
        builder.HasIndex(m => new { m.TenantId, m.ChannelId, m.CreatedAt })
            .HasFilter("channel_id IS NOT NULL AND deleted_at IS NULL");

        builder.HasIndex(m => new { m.TenantId, m.ConversationId, m.CreatedAt })
            .HasFilter("conversation_id IS NOT NULL AND deleted_at IS NULL");

        builder.HasIndex(m => new { m.ParentMessageId, m.CreatedAt })
            .HasFilter("parent_message_id IS NOT NULL AND deleted_at IS NULL");

        builder.HasIndex(m => new { m.SenderId, m.CreatedAt });

        // Relational mappings
        builder.HasOne(m => m.Channel)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Conversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Sender)
            .WithMany(u => u.SentMessages)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.ParentMessage)
            .WithMany(p => p.ThreadReplies)
            .HasForeignKey(m => m.ParentMessageId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
