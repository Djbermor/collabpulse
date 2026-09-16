using System.Diagnostics;
using CollabPulse.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace CollabPulse.Application.Common.Behaviours;

public class PerformanceBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly Stopwatch _timer;
    private readonly ILogger<PerformanceBehaviour<TRequest, TResponse>> _logger;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICurrentTenantService _currentTenantService;

    public PerformanceBehaviour(
        ILogger<PerformanceBehaviour<TRequest, TResponse>> logger,
        ICurrentUserService currentUserService,
        ICurrentTenantService currentTenantService)
    {
        _timer = new Stopwatch();
        _logger = logger;
        _currentUserService = currentUserService;
        _currentTenantService = currentTenantService;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        _timer.Restart();

        var response = await next();

        _timer.Stop();

        var elapsedMilliseconds = _timer.ElapsedMilliseconds;

        if (elapsedMilliseconds > 500)
        {
            var requestName = typeof(TRequest).Name;
            var userId = _currentUserService.UserId?.ToString() ?? "Anonymous";
            var tenantId = _currentTenantService.CurrentTenantId?.ToString() ?? "None";

            _logger.LogWarning("CollabPulse Long Running Request: {Name} ({ElapsedMilliseconds} ms) [Tenant: {TenantId}] [User: {UserId}]",
                requestName, elapsedMilliseconds, tenantId, userId);
        }

        return response;
    }
}
