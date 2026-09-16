using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Channels.Queries.GetWorkspaceChannels;

public record GetWorkspaceChannelsQuery(
    Guid TenantId,
    Guid WorkspaceId) : IRequest<Result<List<ChannelDto>>>, ITenantScopedRequest;

public class GetWorkspaceChannelsQueryHandler : IRequestHandler<GetWorkspaceChannelsQuery, Result<List<ChannelDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetWorkspaceChannelsQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<List<ChannelDto>>> Handle(GetWorkspaceChannelsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        // Check workspace membership
        var isMember = await _context.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == request.WorkspaceId && wm.UserId == currentUserId && wm.IsActive, cancellationToken);

        if (!isMember)
        {
            throw new ForbiddenAccessException("You do not have access to this workspace.");
        }

        // Return channels: public channels + private channels where the user is a member
        var channels = await _context.Channels
            .Where(c => c.WorkspaceId == request.WorkspaceId && !c.IsArchived)
            .Where(c => c.ChannelType == ChannelType.Public || c.Members.Any(m => m.UserId == currentUserId))
            .Include(c => c.Members)
            .OrderBy(c => c.Name)
            .Select(c => new ChannelDto(
                c.Id,
                c.WorkspaceId,
                c.Name,
                c.Slug,
                c.Topic,
                c.Description,
                c.ChannelType,
                c.IsArchived,
                c.Members.Count,
                c.Members.Any(m => m.UserId == currentUserId),
                c.CreatedBy,
                c.CreatedAt))
            .ToListAsync(cancellationToken);

        return Result<List<ChannelDto>>.Success(channels);
    }
}
