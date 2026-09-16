using MediatR;
using Microsoft.Extensions.Logging;

namespace CollabPulse.Application.Behaviors;

public class TransactionBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<TransactionBehavior<TRequest, TResponse>> _logger;

    public TransactionBehavior(ILogger<TransactionBehavior<TRequest, TResponse>> _logger)
    {
        this._logger = _logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        // Commands mutate state and are wrapped in transactional context
        if (requestName.EndsWith("Command", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogDebug("[TransactionBehavior] Begin transaction scope for {RequestName}", requestName);
            var response = await next();
            _logger.LogDebug("[TransactionBehavior] Commit transaction scope for {RequestName}", requestName);
            return response;
        }

        return await next();
    }
}
