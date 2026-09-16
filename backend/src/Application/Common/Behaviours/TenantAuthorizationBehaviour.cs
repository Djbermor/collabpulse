using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Security;
using MediatR;

namespace CollabPulse.Application.Common.Behaviours;

public class TenantAuthorizationBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ICurrentTenantService _currentTenantService;
    private readonly ICurrentUserService _currentUserService;

    public TenantAuthorizationBehaviour(
        ICurrentTenantService currentTenantService,
        ICurrentUserService currentUserService)
    {
        _currentTenantService = currentTenantService;
        _currentUserService = currentUserService;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        // Tenant Isolation Check
        if (request is ITenantScopedRequest tenantScopedRequest)
        {
            var currentTenantId = _currentTenantService.CurrentTenantId;
            if (currentTenantId.HasValue && currentTenantId.Value != Guid.Empty)
            {
                if (tenantScopedRequest.TenantId != Guid.Empty && tenantScopedRequest.TenantId != currentTenantId.Value)
                {
                    throw new TenantMismatchException(currentTenantId.Value, tenantScopedRequest.TenantId);
                }
            }
        }

        // Role / Permission Authorization Check
        if (request is IAuthorizeRequest authorizeRequest)
        {
            if (!_currentUserService.IsAuthenticated)
            {
                throw new ForbiddenAccessException("Authentication required.");
            }

            if (authorizeRequest.RequiredRoles != null && authorizeRequest.RequiredRoles.Any())
            {
                var hasRole = authorizeRequest.RequiredRoles.Any(role => _currentUserService.IsInRole(role));
                if (!hasRole)
                {
                    throw new ForbiddenAccessException($"Missing required role: {string.Join(", ", authorizeRequest.RequiredRoles)}");
                }
            }

            if (authorizeRequest.RequiredPermissions != null && authorizeRequest.RequiredPermissions.Any())
            {
                var hasPermission = authorizeRequest.RequiredPermissions.All(perm => _currentUserService.HasPermission(perm));
                if (!hasPermission)
                {
                    throw new ForbiddenAccessException($"Missing required permissions: {string.Join(", ", authorizeRequest.RequiredPermissions)}");
                }
            }
        }

        return await next();
    }
}
