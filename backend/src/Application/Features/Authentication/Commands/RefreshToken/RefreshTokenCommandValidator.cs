using FluentValidation;

namespace CollabPulse.Application.Features.Authentication.Commands.RefreshToken;

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator()
    {
        RuleFor(v => v.Token)
            .NotEmpty().WithMessage("Refresh token is required.");
    }
}
