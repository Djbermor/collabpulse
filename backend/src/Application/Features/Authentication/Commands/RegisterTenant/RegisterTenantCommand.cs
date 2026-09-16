using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Authentication.Commands.RegisterTenant;

public record RegisterTenantCommand(
    string CompanyName,
    string CompanySlug,
    string AdminFirstName,
    string AdminLastName,
    string AdminEmail,
    string AdminPassword,
    string? Timezone = "UTC",
    string? Language = "es") : IRequest<Result<RegisterTenantResponseDto>>;

public class RegisterTenantCommandHandler : IRequestHandler<RegisterTenantCommand, Result<RegisterTenantResponseDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;

    public RegisterTenantCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        ITokenService tokenService,
        IDateTime dateTime)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
        _dateTime = dateTime;
    }

    public async Task<Result<RegisterTenantResponseDto>> Handle(RegisterTenantCommand request, CancellationToken cancellationToken)
    {
        var normalizedSlug = request.CompanySlug.Trim().ToLowerInvariant();
        var normalizedEmail = request.AdminEmail.Trim().ToLowerInvariant();

        // 1. Validate slug uniqueness across tenants
        var slugExists = await _context.Tenants
            .AnyAsync(t => t.Slug == normalizedSlug, cancellationToken);

        if (slugExists)
        {
            throw new ConflictException($"The organization slug '{normalizedSlug}' is already in use.");
        }

        var now = _dateTime.UtcNow;
        var tenantId = Guid.NewGuid();

        // 2. Create Tenant
        var tenant = new Tenant
        {
            Id = tenantId,
            Name = request.CompanyName.Trim(),
            Slug = normalizedSlug,
            Timezone = request.Timezone ?? "UTC",
            Language = request.Language ?? "es",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Tenants.Add(tenant);

        // 3. Create Root Administrator User
        var userId = Guid.NewGuid();
        var passwordHash = _passwordHasher.HashPassword(request.AdminPassword);

        var adminUser = new User
        {
            Id = userId,
            TenantId = tenantId,
            FirstName = request.AdminFirstName.Trim(),
            LastName = request.AdminLastName.Trim(),
            Email = normalizedEmail,
            PasswordHash = passwordHash,
            Status = UserStatus.Online,
            IsEmailVerified = true,
            IsActive = true,
            Timezone = request.Timezone ?? "UTC",
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Users.Add(adminUser);

        // 4. Create Standard Roles
        var ownerRole = new Role
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Owner",
            Slug = "owner",
            Description = "Full control over organization, workspaces, billing, and settings.",
            IsSystem = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var adminRole = new Role
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Administrator",
            Slug = "admin",
            Description = "Administrative access to workspaces, channels, and users.",
            IsSystem = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var memberRole = new Role
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Name = "Member",
            Slug = "member",
            Description = "Standard collaborative member.",
            IsSystem = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Roles.AddRange(ownerRole, adminRole, memberRole);

        // 5. Assign Owner Role to Admin User
        _context.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = ownerRole.Id,
            AssignedAt = now
        });

        // 6. Create Initial Workspace
        var workspaceId = Guid.NewGuid();
        var workspace = new Workspace
        {
            Id = workspaceId,
            TenantId = tenantId,
            Name = "General",
            Slug = "general",
            Description = "Default organization workspace",
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Workspaces.Add(workspace);

        _context.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = workspaceId,
            UserId = userId,
            RoleId = ownerRole.Id,
            IsActive = true,
            JoinedAt = now
        });

        // 7. Create Default Channels
        var generalChannel = new Channel
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            WorkspaceId = workspaceId,
            Name = "general",
            Slug = "general",
            Description = "Company-wide announcements and general discussion",
            ChannelType = ChannelType.Public,
            IsArchived = false,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now
        };

        var randomChannel = new Channel
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            WorkspaceId = workspaceId,
            Name = "random",
            Slug = "random",
            Description = "Non-work banter and water cooler chat",
            ChannelType = ChannelType.Public,
            IsArchived = false,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Channels.AddRange(generalChannel, randomChannel);

        _context.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = generalChannel.Id,
            UserId = userId,
            JoinedAt = now
        });

        _context.ChannelMembers.Add(new ChannelMember
        {
            ChannelId = randomChannel.Id,
            UserId = userId,
            JoinedAt = now
        });

        // 8. Generate Tokens
        var roles = new[] { "Owner" };
        var permissions = new[] { "workspace:manage", "channel:manage", "message:send", "user:invite" };
        var accessToken = _tokenService.GenerateAccessToken(adminUser, roles, permissions);
        var (refreshTokenString, refreshExpiry) = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = refreshTokenString,
            ExpiresAt = refreshExpiry,
            CreatedAt = now,
            CreatedByIp = "127.0.0.1"
        });

        // 9. Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            UserId = userId,
            Action = "tenant.registered",
            EntityType = "Tenant",
            EntityId = tenantId,
            Metadata = $"{{\"company\":\"{request.CompanyName}\",\"slug\":\"{normalizedSlug}\"}}",
            CreatedAt = now
        });

        await _context.SaveChangesAsync(cancellationToken);

        var responseDto = new RegisterTenantResponseDto(
            TenantId: tenantId,
            TenantSlug: normalizedSlug,
            TenantName: tenant.Name,
            UserId: userId,
            UserEmail: adminUser.Email,
            UserFullName: $"{adminUser.FirstName} {adminUser.LastName}",
            DefaultWorkspaceId: workspaceId,
            AccessToken: accessToken,
            RefreshToken: refreshTokenString,
            RefreshTokenExpiresAt: refreshExpiry);

        return Result<RegisterTenantResponseDto>.Success(responseDto);
    }
}
