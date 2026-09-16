using CollabPulse.Domain.Enums;

namespace CollabPulse.Application.Features.Meetings;

public record MeetingDto(
    Guid Id,
    Guid TenantId,
    Guid WorkspaceId,
    Guid? ChannelId,
    string Title,
    MeetingProvider Provider,
    MeetingStatus Status,
    string RoomId,
    string? Passcode,
    string JoinUrl,
    Guid HostId,
    DateTimeOffset ScheduledStartTime,
    DateTimeOffset? ActualStartTime,
    DateTimeOffset? EndedAt,
    int ParticipantCount,
    DateTimeOffset CreatedAt);
