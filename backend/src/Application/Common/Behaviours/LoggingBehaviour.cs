using CollabPulse.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CollabPulse.Application.Common.Behaviours;

public class LoggingBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehaviour<TRequest, TResponse>> _logger;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentTenantService _currentTenantService;

    public LoggingBehaviour(
        ILogger<LoggingBehaviour<TRequest, TResponse>> logger,
        ICurrentUserService currentUserService,
        ICurrentTenantService currentTenantService)
    {
        _logger = logger;
        _currentUserService = currentUserService;
        _currentTenantService = currentTenantService;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        var userId = _currentUserService.UserId?.ToString() ?? "Anonymous";
        var tenantId = _currentTenantService.CurrentTenantId?.ToString() ?? "None";

        _logger.LogInformation("CollabPulse Request Handling: {RequestName} [Tenant: {TenantId}] [User: {UserId}]",
            requestName, tenantId, userId);

        var response = await next();

        _logger.LogInformation("CollabPulse Request Completed: {RequestName} [Tenant: {TenantId}] [User: {UserId}]",
            requestName, tenantId, userId);

        return response;
    }
}
