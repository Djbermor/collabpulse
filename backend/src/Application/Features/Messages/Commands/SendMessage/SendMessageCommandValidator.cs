using FluentValidation;

namespace CollabPulse.Application.Features.Messages.Commands.SendMessage;

public class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(v => v.TenantId)
            .NotEmpty().WithMessage("Tenant ID is required.");

        RuleFor(v => v.WorkspaceId)
            .NotEmpty().WithMessage("Workspace ID is required.");

        // PostgreSQL Constraint: chk_message_target
        RuleFor(v => v)
            .Must(v => (v.ChannelId.HasValue && !v.ConversationId.HasValue) || (!v.ChannelId.HasValue && v.ConversationId.HasValue))
            .WithMessage("A message must target either a Channel OR a Conversation, but never both.");

        RuleFor(v => v.Content)
            .NotEmpty()
            .When(v => v.AttachmentFileIds == null || !v.AttachmentFileIds.Any())
            .WithMessage("Message content cannot be empty when no attachments are provided.")
            .MaximumLength(10000).WithMessage("Message content cannot exceed 10,000 characters.");
    }
}
