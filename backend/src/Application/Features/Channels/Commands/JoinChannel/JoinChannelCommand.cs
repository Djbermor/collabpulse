using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Channels.Commands.JoinChannel;

public record JoinChannelCommand(
    Guid TenantId,
    Guid ChannelId) : IRequest<Result<bool>>, ITenantScopedRequest;

public class JoinChannelCommandHandler : IRequestHandler<JoinChannelCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public JoinChannelCommandHandler(
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

    public async Task<Result<bool>> Handle(JoinChannelCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var channel = await _context.Channels
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == request.ChannelId && c.TenantId == request.TenantId, cancellationToken);

        if (channel == null || channel.IsArchived)
        {
            throw new NotFoundException(nameof(Channel), request.ChannelId);
        }

        if (channel.ChannelType == ChannelType.Private)
        {
            throw new ForbiddenAccessException("Private channels cannot be joined without an invitation.");
        }

        var alreadyMember = channel.Members.Any(m => m.UserId == currentUserId);
        if (alreadyMember)
        {
            return Result<bool>.Success(true);
        }

        var now = _dateTime.UtcNow;
        _context.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = currentUserId,
            JoinedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        await _realtimeHub.BroadcastToChannelAsync(
            request.TenantId,
            channel.Id,
            "channel.member_joined",
            new { ChannelId = channel.Id, UserId = currentUserId },
            cancellationToken);

        return Result<bool>.Success(true);
    }
}
