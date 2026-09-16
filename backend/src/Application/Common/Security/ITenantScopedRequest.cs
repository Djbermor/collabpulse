namespace CollabPulse.Application.Common.Security;

public interface ITenantScopedRequest
{
    Guid TenantId { get; }
}

public interface IAuthorizeRequest
{
    string[] RequiredPermissions => Array.Empty<string>();
    string[] RequiredRoles => Array.Empty<string>();
}
