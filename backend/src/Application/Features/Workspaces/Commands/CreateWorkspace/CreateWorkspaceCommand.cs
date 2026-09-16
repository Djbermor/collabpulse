using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Workspaces.Commands.CreateWorkspace;

public record CreateWorkspaceCommand(
    Guid TenantId,
    string Name,
    string Slug,
    string? Description = null,
    string? LogoUrl = null,
    string? Timezone = "UTC") : IRequest<Result<WorkspaceDto>>, ITenantScopedRequest;

public class CreateWorkspaceCommandHandler : IRequestHandler<CreateWorkspaceCommand, Result<WorkspaceDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IDateTime _dateTime;

    public CreateWorkspaceCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IDateTime dateTime)
    {
        _context = context;
        _currentUserService = currentUserService;
        _dateTime = dateTime;
    }

    public async Task<Result<WorkspaceDto>> Handle(CreateWorkspaceCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();
        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

        // Check if workspace slug already exists within tenant
        var slugExists = await _context.Workspaces
            .AnyAsync(w => w.TenantId == request.TenantId && w.Slug == normalizedSlug, cancellationToken);

        if (slugExists)
        {
            throw new ConflictException($"A workspace with slug '{normalizedSlug}' already exists in this organization.");
        }

        var now = _dateTime.UtcNow;
        var workspaceId = Guid.NewGuid();

        // 1. Create Workspace
        var workspace = new Workspace
        {
            Id = workspaceId,
            TenantId = request.TenantId,
            Name = request.Name.Trim(),
            Slug = normalizedSlug,
            Description = request.Description,
            LogoUrl = request.LogoUrl,
            Timezone = request.Timezone ?? "UTC",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Workspaces.Add(workspace);

        // 2. Add creator as workspace admin/member
        var adminRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.TenantId == request.TenantId && r.Slug == "admin", cancellationToken);

        _context.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = workspaceId,
            UserId = currentUserId,
            RoleId = adminRole?.Id,
            IsActive = true,
            JoinedAt = now
        });

        // 3. Create default #general channel
        var channel = new Channel
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            WorkspaceId = workspaceId,
            Name = "general",
            Slug = "general",
            Description = "General discussion",
            ChannelType = ChannelType.Public,
            CreatedBy = currentUserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Channels.Add(channel);

        _context.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = channel.Id,
            UserId = currentUserId,
            JoinedAt = now
        });

        // 4. Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = request.TenantId,
            UserId = currentUserId,
            Action = "workspace.created",
            EntityType = "Workspace",
            EntityId = workspaceId,
            Metadata = $"{{\"name\":\"{workspace.Name}\",\"slug\":\"{workspace.Slug}\"}}",
            CreatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        var dto = new WorkspaceDto(
            Id: workspace.Id,
            TenantId: workspace.TenantId,
            Name: workspace.Name,
            Slug: workspace.Slug,
            Description: workspace.Description,
            LogoUrl: workspace.LogoUrl,
            Timezone: workspace.Timezone,
            IsActive: workspace.IsActive,
            MemberCount: 1,
            ChannelCount: 1,
            UserRole: "Admin",
            CreatedAt: workspace.CreatedAt);

        return Result<WorkspaceDto>.Success(dto);
    }
}
