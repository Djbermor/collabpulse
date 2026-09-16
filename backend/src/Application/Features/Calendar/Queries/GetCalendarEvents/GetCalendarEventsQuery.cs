using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Calendar.Queries.GetCalendarEvents;

public record GetCalendarEventsQuery(
    Guid TenantId,
    Guid WorkspaceId,
    DateTimeOffset StartRange,
    DateTimeOffset EndRange) : IRequest<Result<List<CalendarEventDto>>>, ITenantScopedRequest;

public class GetCalendarEventsQueryHandler : IRequestHandler<GetCalendarEventsQuery, Result<List<CalendarEventDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetCalendarEventsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<List<CalendarEventDto>>> Handle(GetCalendarEventsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var events = await _context.CalendarEvents
            .Where(e => e.TenantId == request.TenantId &&
                        e.WorkspaceId == request.WorkspaceId &&
                        e.StartTime <= request.EndRange &&
                        e.EndTime >= request.StartRange)
            .Include(e => e.Attendees)
                .ThenInclude(a => a.User)
            .OrderBy(e => e.StartTime)
            .ToListAsync(cancellationToken);

        var dtos = events.Select(e => new CalendarEventDto(
            e.Id,
            e.TenantId,
            e.WorkspaceId,
            e.Title,
            e.Description,
            e.Location,
            e.StartTime,
            e.EndTime,
            e.IsAllDay,
            e.RecurrenceRule,
            e.OrganizerId,
            e.Attendees.Select(a => new AttendeeDto(
                a.UserId,
                $"{a.User.FirstName} {a.User.LastName}",
                a.User.Email,
                a.Status)).ToList(),
            e.CreatedAt)).ToList();

        return Result<List<CalendarEventDto>>.Success(dtos);
    }
}
