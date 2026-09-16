using CollabPulse.Application.Common.Behaviours;
using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Security;
using MediatR;
using Moq;
using Xunit;

namespace CollabPulse.Application.UnitTests.Common.Behaviours;

public class TenantAuthorizationBehaviourTests
{
    public record TenantScopedCommand(Guid TenantId) : IRequest<bool>, ITenantScopedRequest;

    [Fact]
    public async Task Handle_WhenRequestTenantMatchesCurrentTenant_ShouldAllowExecution()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var currentTenantMock = new Mock<ICurrentTenantService>();
        currentTenantMock.Setup(t => t.CurrentTenantId).Returns(tenantId);

        var currentUserMock = new Mock<ICurrentUserService>();

        var nextMock = new Mock<RequestHandlerDelegate<bool>>();
        nextMock.Setup(n => n()).ReturnsAsync(true);

        var behaviour = new TenantAuthorizationBehaviour<TenantScopedCommand, bool>(
            currentTenantMock.Object,
            currentUserMock.Object);

        // Act
        var result = await behaviour.Handle(new TenantScopedCommand(tenantId), nextMock.Object, CancellationToken.None);

        // Assert
        Assert.True(result);
        nextMock.Verify(n => n(), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenRequestTenantDiffersFromCurrentTenant_ShouldThrowTenantMismatchException()
    {
        // Arrange
        var currentTenantId = Guid.NewGuid();
        var requestTenantId = Guid.NewGuid();

        var currentTenantMock = new Mock<ICurrentTenantService>();
        currentTenantMock.Setup(t => t.CurrentTenantId).Returns(currentTenantId);

        var currentUserMock = new Mock<ICurrentUserService>();

        var nextMock = new Mock<RequestHandlerDelegate<bool>>();

        var behaviour = new TenantAuthorizationBehaviour<TenantScopedCommand, bool>(
            currentTenantMock.Object,
            currentUserMock.Object);

        // Act & Assert
        await Assert.ThrowsAsync<TenantMismatchException>(() =>
            behaviour.Handle(new TenantScopedCommand(requestTenantId), nextMock.Object, CancellationToken.None));

        nextMock.Verify(n => n(), Times.Never);
    }
}
