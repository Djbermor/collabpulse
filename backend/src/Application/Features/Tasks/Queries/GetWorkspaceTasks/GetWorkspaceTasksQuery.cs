using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Tasks.Queries.GetWorkspaceTasks;

public record GetWorkspaceTasksQuery(
    Guid TenantId,
    Guid WorkspaceId,
    TaskStatus? Status = null,
    Guid? AssigneeId = null) : IRequest<Result<List<TaskItemDto>>>, ITenantScopedRequest;

public class GetWorkspaceTasksQueryHandler : IRequestHandler<GetWorkspaceTasksQuery, Result<List<TaskItemDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetWorkspaceTasksQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<List<TaskItemDto>>> Handle(GetWorkspaceTasksQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var isMember = await _context.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == request.WorkspaceId && wm.UserId == currentUserId && wm.IsActive, cancellationToken);

        if (!isMember)
        {
            throw new ForbiddenAccessException("You do not have access to this workspace.");
        }

        var query = _context.Tasks
            .Where(t => t.TenantId == request.TenantId && t.WorkspaceId == request.WorkspaceId);

        if (request.Status.HasValue)
        {
            query = query.Where(t => t.Status == request.Status.Value);
        }

        if (request.AssigneeId.HasValue)
        {
            query = query.Where(t => t.AssigneeId == request.AssigneeId.Value);
        }

        var tasks = await query
            .Include(t => t.Assignee)
            .Include(t => t.Creator)
            .Include(t => t.Comments)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new TaskItemDto(
                t.Id,
                t.TenantId,
                t.WorkspaceId,
                t.Title,
                t.Description,
                t.Status,
                t.Priority,
                t.DueDate,
                t.CompletedAt,
                t.Assignee != null ? new TaskAssigneeDto(t.Assignee.Id, $"{t.Assignee.FirstName} {t.Assignee.LastName}", t.Assignee.Email, t.Assignee.AvatarUrl) : null,
                new TaskAssigneeDto(t.Creator.Id, $"{t.Creator.FirstName} {t.Creator.LastName}", t.Creator.Email, t.Creator.AvatarUrl),
                t.Comments.Count,
                t.CreatedAt,
                t.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Result<List<TaskItemDto>>.Success(tasks);
    }
}
