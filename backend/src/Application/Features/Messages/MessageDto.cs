using CollabPulse.Domain.Enums;

namespace CollabPulse.Application.Features.Messages;

public record ReactionSummaryDto(
    string Emoji,
    int Count,
    bool ReactedByMe,
    List<Guid> UserIds);

public record MessageAttachmentDto(
    Guid Id,
    Guid FileId,
    string FileName,
    string ContentType,
    long FileSize,
    string StorageKey,
    string DownloadUrl);

public record MessageSenderDto(
    Guid Id,
    string FullName,
    string Email,
    string? AvatarUrl);

public record MessageDto(
    Guid Id,
    Guid TenantId,
    Guid WorkspaceId,
    Guid? ChannelId,
    Guid? ConversationId,
    Guid? ParentId,
    MessageSenderDto Sender,
    string Content,
    MessageType MessageType,
    bool IsPinned,
    int ReplyCount,
    DateTimeOffset? EditedAt,
    DateTimeOffset CreatedAt,
    List<ReactionSummaryDto> Reactions,
    List<MessageAttachmentDto> Attachments);
