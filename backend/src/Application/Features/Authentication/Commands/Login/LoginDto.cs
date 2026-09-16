namespace CollabPulse.Application.Features.Authentication.Commands.Login;

public record AuthUserDto(
    Guid Id,
    Guid TenantId,
    string TenantSlug,
    string Email,
    string FirstName,
    string LastName,
    string? AvatarUrl,
    string? JobTitle,
    IReadOnlyCollection<string> Roles,
    IReadOnlyCollection<string> Permissions);

public record AuthResponseDto(
    string AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    AuthUserDto User);
