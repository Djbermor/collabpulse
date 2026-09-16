using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Authentication.Commands.Login;

public record LoginCommand(
    string Email,
    string Password,
    string? TenantSlug = null,
    string? IpAddress = "127.0.0.1",
    string? UserAgent = "CollabPulse Client") : IRequest<Result<AuthResponseDto>>;

public class LoginCommandHandler : IRequestHandler<LoginCommand, Result<AuthResponseDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;

    public LoginCommandHandler(
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

    public async Task<Result<AuthResponseDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        // 1. Resolve tenant if provided, or lookup through user email
        IQueryable<User> userQuery = _context.Users
            .Include(u => u.Tenant)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission);

        if (!string.IsNullOrWhiteSpace(request.TenantSlug))
        {
            var targetSlug = request.TenantSlug.Trim().ToLowerInvariant();
            userQuery = userQuery.Where(u => u.Tenant.Slug == targetSlug);
        }

        var user = await userQuery.FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new ValidationException("Authentication", "Invalid email or password.");
        }

        if (!user.IsActive || user.DeletedAt.HasValue)
        {
            throw new ForbiddenAccessException("This user account has been deactivated.");
        }

        if (!user.Tenant.IsActive || user.Tenant.DeletedAt.HasValue)
        {
            throw new ForbiddenAccessException("This organization account is currently inactive.");
        }

        var now = _dateTime.UtcNow;

        // 2. Extract roles and permissions
        var roles = user.UserRoles.Select(ur => ur.Role.Name).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToList();

        // 3. Issue Access and Refresh tokens
        var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
        var (refreshTokenString, refreshExpiry) = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshTokenString,
            ExpiresAt = refreshExpiry,
            CreatedAt = now,
            CreatedByIp = request.IpAddress ?? "127.0.0.1"
        });

        // 4. Create user session record
        _context.UserSessions.Add(new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            IpAddress = request.IpAddress,
            UserAgent = request.UserAgent,
            LastActiveAt = now,
            ExpiresAt = now.AddDays(7),
            CreatedAt = now
        });

        // 5. Update user status & last seen
        user.LastSeenAt = now;
        user.Status = UserStatus.Online;

        await _context.SaveChangesAsync(cancellationToken);

        var userDto = new AuthUserDto(
            Id: user.Id,
            TenantId: user.TenantId,
            TenantSlug: user.Tenant.Slug,
            Email: user.Email,
            FirstName: user.FirstName,
            LastName: user.LastName,
            AvatarUrl: user.AvatarUrl,
            JobTitle: user.JobTitle,
            Roles: roles,
            Permissions: permissions);

        return Result<AuthResponseDto>.Success(new AuthResponseDto(
            AccessToken: accessToken,
            RefreshToken: refreshTokenString,
            RefreshTokenExpiresAt: refreshExpiry,
            User: userDto));
    }
}
