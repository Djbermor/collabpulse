using CollabPulse.Domain.Entities;

namespace CollabPulse.Application.Common.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions);
    (string Token, DateTimeOffset ExpiresAt) GenerateRefreshToken();
    Guid? ValidateAccessToken(string token);
}
