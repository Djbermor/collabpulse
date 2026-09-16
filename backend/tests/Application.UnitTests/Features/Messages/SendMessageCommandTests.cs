using CollabPulse.Application.Features.Messages.Commands.SendMessage;
using FluentValidation.TestHelper;
using Xunit;

namespace CollabPulse.Application.UnitTests.Features.Messages;

public class SendMessageCommandTests
{
    private readonly SendMessageCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenBothChannelAndConversationProvided_ShouldHaveValidationError()
    {
        // Arrange
        var command = new SendMessageCommand(
            TenantId: Guid.NewGuid(),
            WorkspaceId: Guid.NewGuid(),
            ChannelId: Guid.NewGuid(),
            ConversationId: Guid.NewGuid(),
            Content: "Hello world");

        // Act
        var result = _validator.TestValidate(command);

        // Assert - Violates PostgreSQL chk_message_target constraint
        result.ShouldHaveValidationErrorFor(x => x)
            .WithErrorMessage("A message must target either a Channel OR a Conversation, but never both.");
    }

    [Fact]
    public void Validate_WhenNeitherChannelNorConversationProvided_ShouldHaveValidationError()
    {
        // Arrange
        var command = new SendMessageCommand(
            TenantId: Guid.NewGuid(),
            WorkspaceId: Guid.NewGuid(),
            ChannelId: null,
            ConversationId: null,
            Content: "Hello world");

        // Act
        var result = _validator.TestValidate(command);

        // Assert - Violates PostgreSQL chk_message_target constraint
        result.ShouldHaveValidationErrorFor(x => x)
            .WithErrorMessage("A message must target either a Channel OR a Conversation, but never both.");
    }

    [Fact]
    public void Validate_WhenOnlyChannelProvided_ShouldBeValid()
    {
        // Arrange
        var command = new SendMessageCommand(
            TenantId: Guid.NewGuid(),
            WorkspaceId: Guid.NewGuid(),
            ChannelId: Guid.NewGuid(),
            ConversationId: null,
            Content: "Valid channel message");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenOnlyConversationProvided_ShouldBeValid()
    {
        // Arrange
        var command = new SendMessageCommand(
            TenantId: Guid.NewGuid(),
            WorkspaceId: Guid.NewGuid(),
            ChannelId: null,
            ConversationId: Guid.NewGuid(),
            Content: "Valid direct message");

        // Act
        var result = _validator.TestValidate(command);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
