using System.Text.RegularExpressions;

namespace CollabPulse.Domain.ValueObjects;

public sealed record ChannelName
{
    private static readonly Regex ChannelSlugRegex = new(
        @"^[a-z0-9-_]{2,64}$",
        RegexOptions.Compiled);

    public string Value { get; }

    public ChannelName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Channel name cannot be empty.", nameof(value));

        var trimmed = value.Trim().ToLowerInvariant().Replace(" ", "-");
        if (!ChannelSlugRegex.IsMatch(trimmed))
            throw new ArgumentException($"Invalid channel name '{value}'. Must be 2-64 lowercase letters, numbers, hyphens or underscores.", nameof(value));

        Value = trimmed;
    }

    public static implicit operator string(ChannelName name) => name.Value;
    public static explicit operator ChannelName(string value) => new(value);
    public override string ToString() => Value;
}
