using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Authentication.Commands.RefreshToken;

public record RefreshTokenResponseDto(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);

public record RefreshTokenCommand(
    string Token,
    string? IpAddress = "127.0.0.1") : IRequest<Result<RefreshTokenResponseDto>>;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, Result<RefreshTokenResponseDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IDateTime _dateTime;

    public RefreshTokenCommandHandler(
        IApplicationDbContext context,
        ITokenService tokenService,
        IDateTime dateTime)
    {
        _context = context;
        _tokenService = tokenService;
        _dateTime = dateTime;
    }

    public async Task<Result<RefreshTokenResponseDto>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var now = _dateTime.UtcNow;

        var existingToken = await _context.RefreshTokens
            .Include(rt => rt.User)
                .ThenInclude(u => u.Tenant)
            .Include(rt => rt.User)
                .ThenInclude(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(rt => rt.Token == request.Token, cancellationToken);

        if (existingToken == null || existingToken.RevokedAt.HasValue || existingToken.ExpiresAt <= now)
        {
            throw new ForbiddenAccessException("Invalid or expired refresh token.");
        }

        var user = existingToken.User;
        if (!user.IsActive || user.DeletedAt.HasValue || !user.Tenant.IsActive || user.Tenant.DeletedAt.HasValue)
        {
            throw new ForbiddenAccessException("Account is not active.");
        }

        // 1. Revoke the used token (Token Rotation)
        var (newRefreshTokenString, newRefreshExpiry) = _tokenService.GenerateRefreshToken();
        existingToken.RevokedAt = now;
        existingToken.ReplacedByToken = newRefreshTokenString;

        // 2. Add the replacement token
        _context.RefreshTokens.Add(new Domain.Entities.RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = newRefreshTokenString,
            ExpiresAt = newRefreshExpiry,
            CreatedAt = now,
            CreatedByIp = request.IpAddress ?? "127.0.0.1"
        });

        // 3. Issue new access token
        var roles = user.UserRoles.Select(ur => ur.Role.Name).Distinct().ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToList();

        var newAccessToken = _tokenService.GenerateAccessToken(user, roles, permissions);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<RefreshTokenResponseDto>.Success(new RefreshTokenResponseDto(
            AccessToken: newAccessToken,
            RefreshToken: newRefreshTokenString,
            RefreshTokenExpiresAt: newRefreshExpiry));
    }
}
