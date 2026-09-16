using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Tasks.Commands.CreateTask;

public record CreateTaskCommand(
    Guid TenantId,
    Guid WorkspaceId,
    string Title,
    string? Description = null,
    TaskPriority Priority = TaskPriority.Medium,
    Guid? AssigneeId = null,
    DateTimeOffset? DueDate = null) : IRequest<Result<TaskItemDto>>, ITenantScopedRequest;

public class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, Result<TaskItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public CreateTaskCommandHandler(
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

    public async Task<Result<TaskItemDto>> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        // 1. Verify workspace access
        var isWorkspaceMember = await _context.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == request.WorkspaceId && wm.UserId == currentUserId && wm.IsActive, cancellationToken);

        if (!isWorkspaceMember)
        {
            throw new ForbiddenAccessException("You must be an active workspace member to create tasks.");
        }

        // 2. Verify assignee belongs to workspace if provided
        User? assignee = null;
        if (request.AssigneeId.HasValue)
        {
            assignee = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.AssigneeId.Value && u.TenantId == request.TenantId, cancellationToken);

            if (assignee == null)
            {
                throw new NotFoundException("Assignee user was not found in this tenant.", request.AssigneeId.Value);
            }
        }

        var creator = await _context.Users
            .FirstAsync(u => u.Id == currentUserId, cancellationToken);

        var now = _dateTime.UtcNow;
        var taskId = Guid.NewGuid();

        var task = new TaskItem
        {
            Id = taskId,
            TenantId = request.TenantId,
            WorkspaceId = request.WorkspaceId,
            Title = request.Title.Trim(),
            Description = request.Description,
            Status = TaskStatus.Pending,
            Priority = request.Priority,
            AssigneeId = request.AssigneeId,
            CreatedBy = currentUserId,
            DueDate = request.DueDate,
            CompletedAt = null,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Tasks.Add(task);

        // Audit log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            UserId = currentUserId,
            Action = "task.created",
            EntityType = "TaskItem",
            EntityId = taskId,
            Metadata = $"{{\"title\":\"{task.Title}\",\"priority\":\"{task.Priority}\"}}",
            CreatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        var creatorDto = new TaskAssigneeDto(
            creator.Id,
            $"{creator.FirstName} {creator.LastName}",
            creator.Email,
            creator.AvatarUrl);

        var assigneeDto = assignee != null
            ? new TaskAssigneeDto(
                assignee.Id,
                $"{assignee.FirstName} {assignee.LastName}",
                assignee.Email,
                assignee.AvatarUrl)
            : null;

        var dto = new TaskItemDto(
            task.Id,
            task.TenantId,
            task.WorkspaceId,
            task.Title,
            task.Description,
            task.Status,
            task.Priority,
            task.DueDate,
            task.CompletedAt,
            assigneeDto,
            creatorDto,
            0,
            task.CreatedAt,
            task.UpdatedAt);

        await _realtimeHub.BroadcastToWorkspaceAsync(
            request.TenantId,
            request.WorkspaceId,
            "task.created",
            dto,
            cancellationToken);

        return Result<TaskItemDto>.Success(dto);
    }
}
