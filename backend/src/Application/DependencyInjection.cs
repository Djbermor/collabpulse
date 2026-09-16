using System.Reflection;
using CollabPulse.Application.Common.Behaviours;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

namespace CollabPulse.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        // Register FluentValidation Validators
        services.AddValidatorsFromAssembly(assembly);

        // Register MediatR
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(assembly);

            // Register pipeline behaviors in execution order:
            // 1. Unhandled Exception Logging & Handling
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(UnhandledExceptionBehaviour<,>));

            // 2. Performance Tracking & Slow Request Warning
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(PerformanceBehaviour<,>));

            // 3. Structured Request Logging (Tenant & User Context)
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehaviour<,>));

            // 4. FluentValidation Pipeline
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));

            // 5. Strict Multi-Tenant Isolation & Role Authorization
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(TenantAuthorizationBehaviour<,>));
        });

        return services;
    }
}
