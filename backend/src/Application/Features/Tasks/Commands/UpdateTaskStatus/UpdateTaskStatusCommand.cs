using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Tasks.Commands.UpdateTaskStatus;

public record UpdateTaskStatusCommand(
    Guid TenantId,
    Guid TaskId,
    TaskStatus NewStatus) : IRequest<Result<bool>>, ITenantScopedRequest;

public class UpdateTaskStatusCommandHandler : IRequestHandler<UpdateTaskStatusCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public UpdateTaskStatusCommandHandler(
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

    public async Task<Result<bool>> Handle(UpdateTaskStatusCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var task = await _context.Tasks
            .FirstOrDefaultAsync(t => t.Id == request.TaskId && t.TenantId == request.TenantId, cancellationToken);

        if (task == null)
        {
            throw new NotFoundException(nameof(TaskItem), request.TaskId);
        }

        var now = _dateTime.UtcNow;
        task.Status = request.NewStatus;
        task.UpdatedAt = now;

        if (request.NewStatus == TaskStatus.Completed)
        {
            task.CompletedAt = now;
        }
        else
        {
            task.CompletedAt = null;
        }

        await _context.SaveChangesAsync(cancellationToken);

        await _realtimeHub.BroadcastToWorkspaceAsync(
            request.TenantId,
            task.WorkspaceId,
            "task.updated",
            new { TaskId = task.Id, Status = task.Status, UpdatedBy = currentUserId },
            cancellationToken);

        return Result<bool>.Success(true);
    }
}
