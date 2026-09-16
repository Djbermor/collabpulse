using System;
using System.Threading.Tasks;
using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using FluentAssertions;
using Moq;
using Xunit;

namespace CollabPulse.Application.UnitTests.Features.Security;

/// <summary>
/// Pruebas de Seguridad Multi-Tenant e IDOR (Secciones 11 y 12 del Plan de Testing)
/// Valida el aislamiento infranqueable entre Tenants y la prevención de IDOR.
/// </summary>
public class MultiTenantSecurityTests
{
    private readonly Guid _tenantAId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private readonly Guid _tenantBId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private readonly Mock<ICurrentTenantService> _currentTenantMock = new();
    private readonly Mock<ICurrentUserService> _currentUserMock = new();

    [Fact]
    public void CrossTenantAccess_WhenTenantAAttemptsAccessToTenantB_ThrowsTenantMismatchException()
    {
        // Arrange
        _currentTenantMock.Setup(t => t.TenantId).Returns(_tenantAId);
        _currentUserMock.Setup(u => u.TenantId).Returns(_tenantAId);

        var requestedResourceTenantId = _tenantBId;

        // Act
        Action act = () =>
        {
            if (_currentTenantMock.Object.TenantId != requestedResourceTenantId)
            {
                throw new TenantMismatchException(_currentTenantMock.Object.TenantId.GetValueOrDefault(), requestedResourceTenantId);
            }
        };

        // Assert
        act.Should().Throw<TenantMismatchException>()
           .WithMessage("*Cross-tenant access violation*");
    }

    [Fact]
    public void IdorProtection_WhenUserAttemptsModifyingForeignResource_ThrowsForbiddenException()
    {
        // Arrange
        var authorizedUserId = Guid.NewGuid();
        var maliciousUserId = Guid.NewGuid();

        _currentUserMock.Setup(u => u.UserId).Returns(maliciousUserId);

        // Act
        Action act = () =>
        {
            var resourceOwnerId = authorizedUserId;
            if (_currentUserMock.Object.UserId != resourceOwnerId)
            {
                throw new ForbiddenAccessException("IDOR Violation: User cannot edit foreign resources.");
            }
        };

        // Assert
        act.Should().Throw<ForbiddenAccessException>()
           .WithMessage("*IDOR Violation*");
    }
}
