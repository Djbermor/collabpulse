using FluentValidation;

namespace CollabPulse.Application.Features.Tasks.Commands.CreateTask;

public class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
{
    public CreateTaskCommandValidator()
    {
        RuleFor(v => v.Title)
            .NotEmpty().WithMessage("Task title is required.")
            .MaximumLength(255);

        RuleFor(v => v.WorkspaceId)
            .NotEmpty().WithMessage("Workspace ID is required.");

        RuleFor(v => v.TenantId)
            .NotEmpty().WithMessage("Tenant ID is required.");
    }
}
