namespace CollabPulse.Domain.ValueObjects;

public sealed record WorkspaceName
{
    public string Value { get; }

    public WorkspaceName(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Workspace name cannot be empty.", nameof(value));

        var trimmed = value.Trim();
        if (trimmed.Length is < 2 or > 64)
            throw new ArgumentException("Workspace name must be between 2 and 64 characters.", nameof(value));

        Value = trimmed;
    }

    public static implicit operator string(WorkspaceName name) => name.Value;
    public static explicit operator WorkspaceName(string value) => new(value);
    public override string ToString() => Value;
}
