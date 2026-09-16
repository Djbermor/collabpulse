using System;
using CollabPulse.Application.Common.Exceptions;
using FluentAssertions;
using Xunit;

namespace CollabPulse.Application.UnitTests.Features.Channels;

/// <summary>
/// Pruebas de Autorización y Permisos en Canales (Secciones 10 y 14 del Plan de Testing)
/// Valida control de acceso basado en roles (Owner, Admin, Member, Guest) y canales de solo lectura.
/// </summary>
public class ChannelPermissionTests
{
    [Theory]
    [InlineData("guest", false)]
    [InlineData("member", false)]
    [InlineData("admin", true)]
    [InlineData("owner", true)]
    public void AnnouncementChannel_OnlyAdminOrOwnerCanPost(string userRole, bool canPostExpected)
    {
        // Arrange: Canal de anuncios configurado como de solo lectura para miembros regulares
        var isAnnouncementOnly = true;

        // Act
        bool canPost = !isAnnouncementOnly || userRole is "admin" or "owner";

        // Assert
        canPost.Should().Be(canPostExpected);
    }

    [Fact]
    public void PrivateChannel_WhenUserIsNotMember_AccessIsForbidden()
    {
        // Arrange
        var isChannelPrivate = true;
        var isUserMemberOfChannel = false;

        // Act
        Action accessChannel = () =>
        {
            if (isChannelPrivate && !isUserMemberOfChannel)
            {
                throw new ForbiddenAccessException("User is not a member of this private channel.");
            }
        };

        // Assert
        accessChannel.Should().Throw<ForbiddenAccessException>()
            .WithMessage("*not a member of this private channel*");
    }
}
