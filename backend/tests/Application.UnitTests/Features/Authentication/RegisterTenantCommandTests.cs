using CollabPulse.Application.Features.Authentication.Commands.RegisterTenant;
using FluentValidation.TestHelper;
using Xunit;

namespace CollabPulse.Application.UnitTests.Features.Authentication;

public class RegisterTenantCommandTests
{
    private readonly RegisterTenantCommandValidator _validator = new();

    [Theory]
    [InlineData("Invalid Slug With Spaces")]
    [InlineData("slug_with_special!")]
    [InlineData("UPPERCASE-SLUG")]
    public void Validate_WhenSlugHasInvalidCharacters_ShouldFail(string slug)
    {
        // Arrange
        var command = new RegisterTenantCommand(
            CompanyName: "Acme Corp",
            CompanySlug: slug,
            AdminFirstName: "Jane",
            AdminLastName: "Doe",
            AdminEmail: "jane@acme.com",
            AdminPassword: "Password123!");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.CompanySlug);
    }

    [Theory]
    [InlineData("acme-corp")]
    [InlineData("pulse-saas-123")]
    [InlineData("collab")]
    public void Validate_WhenSlugIsValid_ShouldPass(string slug)
    {
        // Arrange
        var command = new RegisterTenantCommand(
            CompanyName: "Acme Corp",
            CompanySlug: slug,
            AdminFirstName: "Jane",
            AdminLastName: "Doe",
            AdminEmail: "jane@acme.com",
            AdminPassword: "Password123!");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.CompanySlug);
    }

    [Theory]
    [InlineData("short")] // < 8 characters
    [InlineData("alllowercase123")] // missing uppercase
    [InlineData("ALLUPPERCASE123")] // missing lowercase
    [InlineData("NoDigitsInPassword!")] // missing digit
    public void Validate_WhenPasswordIsWeak_ShouldFail(string password)
    {
        // Arrange
        var command = new RegisterTenantCommand(
            CompanyName: "Acme Corp",
            CompanySlug: "acme-corp",
            AdminFirstName: "Jane",
            AdminLastName: "Doe",
            AdminEmail: "jane@acme.com",
            AdminPassword: password);

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.AdminPassword);
    }
}
