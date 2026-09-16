using CollabPulse.Domain.Common;
using CollabPulse.Domain.Enums;

namespace CollabPulse.Domain.Entities;

public class Channel : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ChannelType ChannelType { get; set; } = ChannelType.Public;
    public bool IsArchived { get; set; } = false;
    public Guid CreatedBy { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public ICollection<ChannelMember> Members { get; set; } = new List<ChannelMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}

public class ChannelMember
{
    public Guid ChannelId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastReadAt { get; set; }
    public bool IsMuted { get; set; } = false;
    public bool NotificationsEnabled { get; set; } = true;

    public Channel Channel { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class Conversation : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public ConversationType ConversationType { get; set; } = ConversationType.Direct;
    public string? Name { get; set; }
    public Guid CreatedBy { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public ICollection<ConversationMember> Members { get; set; } = new List<ConversationMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}

public class ConversationMember
{
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastReadAt { get; set; }
    public bool IsMuted { get; set; } = false;
    public bool IsAdmin { get; set; } = false;
    public DateTimeOffset? LeftAt { get; set; }

    public Conversation Conversation { get; set; } = null!;
    public User User { get; set; } = null!;
}
