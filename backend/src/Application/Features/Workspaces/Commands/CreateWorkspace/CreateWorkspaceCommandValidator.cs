using FluentValidation;

namespace CollabPulse.Application.Features.Workspaces.Commands.CreateWorkspace;

public class CreateWorkspaceCommandValidator : AbstractValidator<CreateWorkspaceCommand>
{
    public CreateWorkspaceCommandValidator()
    {
        RuleFor(v => v.Name)
            .NotEmpty().WithMessage("Workspace name is required.")
            .MaximumLength(150);

        RuleFor(v => v.Slug)
            .NotEmpty().WithMessage("Workspace slug is required.")
            .MaximumLength(100)
            .Matches("^[a-z0-9-]+$").WithMessage("Slug may only contain lowercase alphanumeric characters and hyphens.");
    }
}
