namespace CollabPulse.Application.Features.Authentication.Commands.RegisterTenant;

public record RegisterTenantResponseDto(
    Guid TenantId,
    string TenantSlug,
    string TenantName,
    Guid UserId,
    string UserEmail,
    string UserFullName,
    Guid DefaultWorkspaceId,
    string AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt);
