using FluentValidation;

namespace CollabPulse.Application.Features.Channels.Commands.CreateChannel;

public class CreateChannelCommandValidator : AbstractValidator<CreateChannelCommand>
{
    public CreateChannelCommandValidator()
    {
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Channel name is required.")
            .MaximumLength(80)
            .Matches("^[a-z0-9-_]+$").WithMessage("Channel name may only contain lowercase letters, numbers, hyphens, and underscores.");

        RuleFor(v => v.WorkspaceId)
            .NotEmpty().WithMessage("Workspace ID is required.");

        RuleFor(v => v.TenantId)
            .NotEmpty().WithMessage("Tenant ID is required.");
    }
}
