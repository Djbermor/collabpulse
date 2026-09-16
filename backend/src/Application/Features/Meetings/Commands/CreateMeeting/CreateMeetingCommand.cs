using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Meetings.Commands.CreateMeeting;

public record CreateMeetingCommand(
    Guid TenantId,
    Guid WorkspaceId,
    string Title,
    Guid? ChannelId = null,
    MeetingProvider Provider = MeetingProvider.Internal,
    DateTimeOffset? ScheduledStartTime = null) : IRequest<Result<MeetingDto>>, ITenantScopedRequest;

public class CreateMeetingCommandHandler : IRequestHandler<CreateMeetingCommand, Result<MeetingDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public CreateMeetingCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IRealtimeHubService realtimeHub,
        IDateTime dateTime)
    {
        _context = context;
        _currentUserService = currentUserService;
        _realtimeHub = realtimeHub;
        _dateTime = dateTime;
    }

    public async Task<Result<MeetingDto>> Handle(CreateMeetingCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();
        var now = _dateTime.UtcNow;
        var scheduledStart = request.ScheduledStartTime ?? now;
        var roomId = $"room-{Guid.NewGuid():N}";
        var passcode = Guid.NewGuid().ToString("N")[..6];
        var joinUrl = $"/meetings/{roomId}?pwd={passcode}";

        var meeting = new Meeting
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            WorkspaceId = request.WorkspaceId,
            ChannelId = request.ChannelId,
            Title = request.Title.Trim(),
            Provider = request.Provider,
            Status = MeetingStatus.Scheduled,
            RoomId = roomId,
            Passcode = passcode,
            JoinUrl = joinUrl,
            HostId = currentUserId,
            ScheduledStartTime = scheduledStart,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Meetings.Add(meeting);

        // Add host as initial participant
        _context.MeetingParticipants.Add(new MeetingParticipant
        {
            MeetingId = meeting.Id,
            UserId = currentUserId,
            Role = "host",
            JoinedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new MeetingDto(
            meeting.Id,
            meeting.TenantId,
            meeting.WorkspaceId,
            meeting.ChannelId,
            meeting.Title,
            meeting.Provider,
            meeting.Status,
            meeting.RoomId,
            meeting.Passcode,
            meeting.JoinUrl,
            meeting.HostId,
            meeting.ScheduledStartTime,
            meeting.ActualStartTime,
            meeting.EndedAt,
            1,
            meeting.CreatedAt);

        if (request.ChannelId.HasValue)
        {
            await _realtimeHub.BroadcastToChannelAsync(
                request.TenantId,
                request.ChannelId.Value,
                "meeting.created",
                dto,
                cancellationToken);
        }

        return Result<MeetingDto>.Success(dto);
    }
}
