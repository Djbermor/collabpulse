using CollabPulse.Domain.Common;
using CollabPulse.Domain.Enums;

namespace CollabPulse.Domain.Entities;

public class Message : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public Guid? ChannelId { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public Guid? ParentMessageId { get; set; }
    public string Content { get; set; } = string.Empty;
    public MessageType MessageType { get; set; } = MessageType.Text;
    public bool IsEdited { get; set; } = false;
    public DateTimeOffset? EditedAt { get; set; }
    public bool IsDeleted { get; set; } = false;

    // Navigation properties
    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public Channel? Channel { get; set; }
    public Conversation? Conversation { get; set; }
    public User Sender { get; set; } = null!;
    public Message? ParentMessage { get; set; }
    public ICollection<Message> ThreadReplies { get; set; } = new List<Message>();
    public ICollection<MessageReaction> Reactions { get; set; } = new List<MessageReaction>();
    public ICollection<MessageRead> Reads { get; set; } = new List<MessageRead>();
    public ICollection<MessagePin> Pins { get; set; } = new List<MessagePin>();
    public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
}

public class MessageReaction : BaseEntity
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class MessageRead
{
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset ReadAt { get; set; } = DateTimeOffset.UtcNow;

    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class MessagePin : BaseEntity
{
    public Guid MessageId { get; set; }
    public Guid? ChannelId { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid PinnedBy { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Message Message { get; set; } = null!;
    public Channel? Channel { get; set; }
    public Conversation? Conversation { get; set; }
    public User PinnedByUser { get; set; } = null!;
}

public class MessageAttachment : BaseEntity
{
    public Guid MessageId { get; set; }
    public Guid FileId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Message Message { get; set; } = null!;
    public FileMetadata File { get; set; } = null!;
}
