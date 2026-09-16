using System.Text.RegularExpressions;

namespace CollabPulse.Domain.ValueObjects;

public sealed record UserName
{
    private static readonly Regex UserNameRegex = new(
        @"^[a-zA-Z0-9._-]{3,32}$",
        RegexOptions.Compiled);

    public string Value { get; }

    public UserName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Username cannot be empty.", nameof(value));

        var trimmed = value.Trim();
        if (!UserNameRegex.IsMatch(trimmed))
            throw new ArgumentException($"Invalid username '{value}'. Must be 3-32 alphanumeric or ._- characters.", nameof(value));

        Value = trimmed;
    }

    public static implicit operator string(UserName name) => name.Value;
    public static explicit operator UserName(string value) => new(value);
    public override string ToString() => Value;
}
