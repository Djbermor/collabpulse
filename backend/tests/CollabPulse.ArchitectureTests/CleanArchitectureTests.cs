using System.Reflection;
using CollabPulse.Domain.Common;
using FluentAssertions;
using Xunit;

namespace CollabPulse.ArchitectureTests;

public class CleanArchitectureTests
{
    private static readonly Assembly DomainAssembly = typeof(Entity).Assembly;
    private static readonly Assembly ApplicationAssembly = typeof(CollabPulse.Application.DependencyInjection).Assembly;
    private static readonly Assembly InfrastructureAssembly = typeof(CollabPulse.Infrastructure.DependencyInjection).Assembly;

    [Fact]
    public void Domain_ShouldNotHaveDependencyOn_OtherLayers()
    {
        var referencedAssemblies = DomainAssembly.GetReferencedAssemblies()
            .Select(a => a.Name);

        referencedAssemblies.Should().NotContain("CollabPulse.Application");
        referencedAssemblies.Should().NotContain("CollabPulse.Infrastructure");
        referencedAssemblies.Should().NotContain("CollabPulse.Api");
    }

    [Fact]
    public void Application_ShouldNotHaveDependencyOn_InfrastructureOrApi()
    {
        var referencedAssemblies = ApplicationAssembly.GetReferencedAssemblies()
            .Select(a => a.Name);

        referencedAssemblies.Should().NotContain("CollabPulse.Infrastructure");
        referencedAssemblies.Should().NotContain("CollabPulse.Api");
    }

    [Fact]
    public void DomainEvents_ShouldInheritFromDomainEvent()
    {
        var domainEventTypes = DomainAssembly.GetTypes()
            .Where(t => t.Namespace == "CollabPulse.Domain.Events" && !t.IsAbstract && !t.IsInterface);

        foreach (var type in domainEventTypes)
        {
            typeof(DomainEvent).IsAssignableFrom(type).Should().BeTrue(
                $"Domain event '{type.Name}' should inherit from DomainEvent base class.");
        }
    }
}
