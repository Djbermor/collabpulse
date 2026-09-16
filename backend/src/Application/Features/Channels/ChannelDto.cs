using CollabPulse.Domain.Enums;

namespace CollabPulse.Application.Features.Channels;

public record ChannelDto(
    Guid Id,
    Guid WorkspaceId,
    string Name,
    string Slug,
    string? Topic,
    string? Description,
    ChannelType ChannelType,
    bool IsArchived,
    int MemberCount,
    bool IsMember,
    Guid CreatedBy,
    DateTimeOffset CreatedAt);
