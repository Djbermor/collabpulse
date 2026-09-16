using CollabPulse.Application.Common.Behaviours;
using CollabPulse.Application.Common.Exceptions;
using FluentValidation;
using FluentValidation.Results;
using MediatR;
using Moq;
using Xunit;

namespace CollabPulse.Application.UnitTests.Common.Behaviours;

public class ValidationBehaviourTests
{
    public record SampleCommand(string Value) : IRequest<string>;

    [Fact]
    public async Task Handle_WhenNoValidationFailures_ShouldCallNextDelegate()
    {
        // Arrange
        var validatorMock = new Mock<IValidator<SampleCommand>>();
        validatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<ValidationContext<SampleCommand>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult());

        var behaviour = new ValidationBehaviour<SampleCommand, string>(new[] { validatorMock.Object });
        var nextMock = new Mock<RequestHandlerDelegate<string>>();
        nextMock.Setup(n => n()).ReturnsAsync("Success");

        // Act
        var result = await behaviour.Handle(new SampleCommand("valid"), nextMock.Object, CancellationToken.None);

        // Assert
        Assert.Equal("Success", result);
        nextMock.Verify(n => n(), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenValidationFailuresExist_ShouldThrowValidationException()
    {
        // Arrange
        var failures = new List<ValidationFailure>
        {
            new("Value", "Value must not be empty.")
        };

        var validatorMock = new Mock<IValidator<SampleCommand>>();
        validatorMock
            .Setup(v => v.ValidateAsync(It.IsAny<ValidationContext<SampleCommand>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ValidationResult(failures));

        var behaviour = new ValidationBehaviour<SampleCommand, string>(new[] { validatorMock.Object });
        var nextMock = new Mock<RequestHandlerDelegate<string>>();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            behaviour.Handle(new SampleCommand(""), nextMock.Object, CancellationToken.None));

        Assert.True(ex.Errors.ContainsKey("Value"));
        nextMock.Verify(n => n(), Times.Never);
    }
}
