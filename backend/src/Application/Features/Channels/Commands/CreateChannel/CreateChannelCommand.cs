using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Channels.Commands.CreateChannel;

public record CreateChannelCommand(
    Guid TenantId,
    Guid WorkspaceId,
    string Name,
    ChannelType ChannelType = ChannelType.Public,
    string? Topic = null,
    string? Description = null) : IRequest<Result<ChannelDto>>, ITenantScopedRequest;

public class CreateChannelCommandHandler : IRequestHandler<CreateChannelCommand, Result<ChannelDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public CreateChannelCommandHandler(
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

    public async Task<Result<ChannelDto>> Handle(CreateChannelCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();
        var normalizedSlug = request.Name.Trim().ToLowerInvariant();

        // 1. Verify user is member of this workspace
        var isWorkspaceMember = await _context.WorkspaceMembers
            .AnyAsync(wm => wm.WorkspaceId == request.WorkspaceId && wm.UserId == currentUserId && wm.IsActive, cancellationToken);

        if (!isWorkspaceMember)
        {
            throw new ForbiddenAccessException("You must be an active workspace member to create channels.");
        }

        // 2. Check channel slug uniqueness in workspace
        var channelExists = await _context.Channels
            .AnyAsync(c => c.WorkspaceId == request.WorkspaceId && c.Slug == normalizedSlug && !c.IsArchived, cancellationToken);

        if (channelExists)
        {
            throw new ConflictException($"A channel named '#{normalizedSlug}' already exists in this workspace.");
        }

        var now = _dateTime.UtcNow;
        var channelId = Guid.NewGuid();

        // 3. Create channel
        var channel = new Channel
        {
            Id = channelId,
            TenantId = request.TenantId,
            WorkspaceId = request.WorkspaceId,
            Name = normalizedSlug,
            Slug = normalizedSlug,
            Topic = request.Topic,
            Description = request.Description,
            ChannelType = request.ChannelType,
            IsArchived = false,
            CreatedBy = currentUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Channels.Add(channel);

        // 4. Add creator as first member
        _context.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channelId,
            UserId = currentUserId,
            JoinedAt = now
        });

        // 5. Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            UserId = currentUserId,
            Action = "channel.created",
            EntityType = "Channel",
            EntityId = channelId,
            Metadata = $"{{\"name\":\"{channel.Name}\",\"type\":\"{channel.ChannelType}\"}}",
            CreatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new ChannelDto(
            Id: channel.Id,
            WorkspaceId: channel.WorkspaceId,
            Name: channel.Name,
            Slug: channel.Slug,
            Topic: channel.Topic,
            Description: channel.Description,
            ChannelType: channel.ChannelType,
            IsArchived: false,
            MemberCount: 1,
            IsMember: true,
            CreatedBy: currentUserId,
            CreatedAt: channel.CreatedAt);

        // Notify workspace members in real-time
        await _realtimeHub.BroadcastToWorkspaceAsync(
            request.TenantId,
            request.WorkspaceId,
            "channel.created",
            dto,
            cancellationToken);

        return Result<ChannelDto>.Success(dto);
    }
}
