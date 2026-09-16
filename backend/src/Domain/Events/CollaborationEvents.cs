using CollabPulse.Domain.Common;
using CollabPulse.Domain.Enums;

namespace CollabPulse.Domain.Events;

public sealed class MessageCreated : DomainEvent
{
    public Guid MessageId { get; }
    public Guid? ChannelId { get; }
    public Guid? ConversationId { get; }
    public Guid SenderId { get; }
    public string Content { get; }
    public MessageType Type { get; }

    public MessageCreated(Guid messageId, Guid? channelId, Guid? conversationId, Guid senderId, string content, MessageType type)
    {
        MessageId = messageId;
        ChannelId = channelId;
        ConversationId = conversationId;
        SenderId = senderId;
        Content = content;
        Type = type;
    }
}

public sealed class MessageUpdated : DomainEvent
{
    public Guid MessageId { get; }
    public string NewContent { get; }
    public DateTimeOffset EditedAt { get; }

    public MessageUpdated(Guid messageId, string newContent, DateTimeOffset editedAt)
    {
        MessageId = messageId;
        NewContent = newContent;
        EditedAt = editedAt;
    }
}

public sealed class MessageDeleted : DomainEvent
{
    public Guid MessageId { get; }
    public Guid DeletedBy { get; }

    public MessageDeleted(Guid messageId, Guid deletedBy)
    {
        MessageId = messageId;
        DeletedBy = deletedBy;
    }
}

public sealed class ReactionAdded : DomainEvent
{
    public Guid MessageId { get; }
    public Guid UserId { get; }
    public string EmojiCode { get; }

    public ReactionAdded(Guid messageId, Guid userId, string emojiCode)
    {
        MessageId = messageId;
        UserId = userId;
        EmojiCode = emojiCode;
    }
}

public sealed class ReactionRemoved : DomainEvent
{
    public Guid MessageId { get; }
    public Guid UserId { get; }
    public string EmojiCode { get; }

    public ReactionRemoved(Guid messageId, Guid userId, string emojiCode)
    {
        MessageId = messageId;
        UserId = userId;
        EmojiCode = emojiCode;
    }
}

public sealed class TaskCreated : DomainEvent
{
    public Guid TaskId { get; }
    public Guid WorkspaceId { get; }
    public string Title { get; }
    public Guid? AssigneeId { get; }
    public TaskPriority Priority { get; }

    public TaskCreated(Guid taskId, Guid workspaceId, string title, Guid? assigneeId, TaskPriority priority)
    {
        TaskId = taskId;
        WorkspaceId = workspaceId;
        Title = title;
        AssigneeId = assigneeId;
        Priority = priority;
    }
}

public sealed class TaskCompleted : DomainEvent
{
    public Guid TaskId { get; }
    public Guid CompletedBy { get; }
    public DateTimeOffset CompletedAt { get; }

    public TaskCompleted(Guid taskId, Guid completedBy, DateTimeOffset completedAt)
    {
        TaskId = taskId;
        CompletedBy = completedBy;
        CompletedAt = completedAt;
    }
}

public sealed class CalendarEventCreated : DomainEvent
{
    public Guid EventId_ { get; }
    public Guid WorkspaceId { get; }
    public string Title { get; }
    public DateTimeOffset StartTime { get; }
    public DateTimeOffset EndTime { get; }

    public CalendarEventCreated(Guid eventId, Guid workspaceId, string title, DateTimeOffset startTime, DateTimeOffset endTime)
    {
        EventId_ = eventId;
        WorkspaceId = workspaceId;
        Title = title;
        StartTime = startTime;
        EndTime = endTime;
    }
}

public sealed class NotificationCreated : DomainEvent
{
    public Guid NotificationId { get; }
    public Guid RecipientId { get; }
    public NotificationType Type { get; }
    public string Title { get; }
    public string Content { get; }

    public NotificationCreated(Guid notificationId, Guid recipientId, NotificationType type, string title, string content)
    {
        NotificationId = notificationId;
        RecipientId = recipientId;
        Type = type;
        Title = title;
        Content = content;
    }
}
