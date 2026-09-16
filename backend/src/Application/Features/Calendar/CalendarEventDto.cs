using CollabPulse.Domain.Enums;

namespace CollabPulse.Application.Features.Calendar;

public record AttendeeDto(
    Guid UserId,
    string FullName,
    string Email,
    CalendarAttendeeStatus Status);

public record CalendarEventDto(
    Guid Id,
    Guid TenantId,
    Guid WorkspaceId,
    string Title,
    string? Description,
    string? Location,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    bool IsAllDay,
    string? RecurrenceRule,
    Guid OrganizerId,
    List<AttendeeDto> Attendees,
    DateTimeOffset CreatedAt);
