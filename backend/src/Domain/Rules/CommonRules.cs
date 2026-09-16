namespace CollabPulse.Domain.Rules;

public sealed class MemberMustBeActiveRule : IBusinessRule
{
    private readonly bool _isActive;

    public MemberMustBeActiveRule(bool isActive)
    {
        _isActive = isActive;
    }

    public bool IsBroken() => !_isActive;
    public string Message => "User membership in workspace is inactive or suspended.";
}

public sealed class MessageContentMustNotBeEmptyRule : IBusinessRule
{
    private readonly string? _content;

    public MessageContentMustNotBeEmptyRule(string? content)
    {
        _content = content;
    }

    public bool IsBroken() => string.IsNullOrWhiteSpace(_content);
    public string Message => "Message content cannot be null, empty, or whitespace.";
}

public sealed class WorkspaceNameMustBeValidRule : IBusinessRule
{
    private readonly string _name;

    public WorkspaceNameMustBeValidRule(string name)
    {
        _name = name;
    }

    public bool IsBroken() => string.IsNullOrWhiteSpace(_name) || _name.Length is < 2 or > 64;
    public string Message => "Workspace name length must be between 2 and 64 characters.";
}
