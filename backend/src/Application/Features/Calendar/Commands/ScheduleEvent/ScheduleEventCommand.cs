using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Calendar.Commands.ScheduleEvent;

public record ScheduleEventCommand(
    Guid TenantId,
    Guid WorkspaceId,
    string Title,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    string? Description = null,
    string? Location = null,
    bool IsAllDay = false,
    List<Guid>? AttendeeUserIds = null) : IRequest<Result<CalendarEventDto>>, ITenantScopedRequest;

public class ScheduleEventCommandHandler : IRequestHandler<ScheduleEventCommand, Result<CalendarEventDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public ScheduleEventCommandHandler(
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

    public async Task<Result<CalendarEventDto>> Handle(ScheduleEventCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        if (request.EndTime < request.StartTime)
        {
            throw new ValidationException("EndTime", "End time cannot be earlier than start time.");
        }

        var now = _dateTime.UtcNow;
        var eventId = Guid.NewGuid();

        var calendarEvent = new CalendarEvent
        {
            Id = eventId,
            TenantId = request.TenantId,
            WorkspaceId = request.WorkspaceId,
            Title = request.Title.Trim(),
            Description = request.Description,
            Location = request.Location,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            IsAllDay = request.IsAllDay,
            OrganizerId = currentUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.CalendarEvents.Add(calendarEvent);

        var attendeeDtos = new List<AttendeeDto>();

        // Organizer is always an accepted attendee
        var organizerUser = await _context.Users.FirstAsync(u => u.Id == currentUserId, cancellationToken);
        _context.CalendarEventAttendees.Add(new CalendarEventAttendee
        {
            EventId = eventId,
            UserId = currentUserId,
            Status = CalendarAttendeeStatus.Accepted,
            RespondedAt = now
        });
        attendeeDtos.Add(new AttendeeDto(currentUserId, $"{organizerUser.FirstName} {organizerUser.LastName}", organizerUser.Email, CalendarAttendeeStatus.Accepted));

        // Add requested attendees
        if (request.AttendeeUserIds != null && request.AttendeeUserIds.Any())
        {
            var invitedUsers = await _context.Users
                .Where(u => request.AttendeeUserIds.Contains(u.Id) && u.TenantId == request.TenantId && u.Id != currentUserId)
                .ToListAsync(cancellationToken);

            foreach (var invited in invitedUsers)
            {
                _context.CalendarEventAttendees.Add(new CalendarEventAttendee
                {
                    EventId = eventId,
                    UserId = invited.Id,
                    Status = CalendarAttendeeStatus.Pending
                });

                attendeeDtos.Add(new AttendeeDto(invited.Id, $"{invited.FirstName} {invited.LastName}", invited.Email, CalendarAttendeeStatus.Pending));
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new CalendarEventDto(
            calendarEvent.Id,
            calendarEvent.TenantId,
            calendarEvent.WorkspaceId,
            calendarEvent.Title,
            calendarEvent.Description,
            calendarEvent.Location,
            calendarEvent.StartTime,
            calendarEvent.EndTime,
            calendarEvent.IsAllDay,
            calendarEvent.RecurrenceRule,
            calendarEvent.OrganizerId,
            attendeeDtos,
            calendarEvent.CreatedAt);

        await _realtimeHub.BroadcastToWorkspaceAsync(request.TenantId, request.WorkspaceId, "calendar.event_created", dto, cancellationToken);

        return Result<CalendarEventDto>.Success(dto);
    }
}
