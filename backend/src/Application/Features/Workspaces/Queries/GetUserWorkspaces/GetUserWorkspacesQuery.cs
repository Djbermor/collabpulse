using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Workspaces.Queries.GetUserWorkspaces;

public record GetUserWorkspacesQuery(Guid TenantId) : IRequest<Result<List<WorkspaceDto>>>, ITenantScopedRequest;

public class GetUserWorkspacesQueryHandler : IRequestHandler<GetUserWorkspacesQuery, Result<List<WorkspaceDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetUserWorkspacesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<List<WorkspaceDto>>> Handle(GetUserWorkspacesQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var workspaces = await _context.WorkspaceMembers
            .Where(wm => wm.UserId == currentUserId && wm.IsActive && wm.Workspace.TenantId == request.TenantId)
            .Include(wm => wm.Workspace)
                .ThenInclude(w => w.Members)
            .Include(wm => wm.Workspace)
                .ThenInclude(w => w.Channels)
            .Include(wm => wm.Role)
            .Select(wm => new WorkspaceDto(
                wm.Workspace.Id,
                wm.Workspace.TenantId,
                wm.Workspace.Name,
                wm.Workspace.Slug,
                wm.Workspace.Description,
                wm.Workspace.LogoUrl,
                wm.Workspace.Timezone,
                wm.Workspace.IsActive,
                wm.Workspace.Members.Count(m => m.IsActive),
                wm.Workspace.Channels.Count(c => !c.IsArchived),
                wm.Role != null ? wm.Role.Name : "Member",
                wm.Workspace.CreatedAt))
            .ToListAsync(cancellationToken);

        return Result<List<WorkspaceDto>>.Success(workspaces);
    }
}
