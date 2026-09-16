using System.Text.RegularExpressions;

namespace CollabPulse.Domain.ValueObjects;

public sealed record Email
{
    private static readonly Regex EmailRegex = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public string Value { get; }

    public Email(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Email cannot be empty.", nameof(value));

        var trimmed = value.Trim().ToLowerInvariant();
        if (!EmailRegex.IsMatch(trimmed))
            throw new ArgumentException($"Invalid email format: '{value}'", nameof(value));

        Value = trimmed;
    }

    public static implicit operator string(Email email) => email.Value;
    public static explicit operator Email(string value) => new(value);
    public override string ToString() => Value;
}
