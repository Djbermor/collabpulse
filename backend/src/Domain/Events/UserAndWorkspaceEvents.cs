using CollabPulse.Domain.Common;
using CollabPulse.Domain.Enums;

namespace CollabPulse.Domain.Events;

public sealed class UserRegistered : DomainEvent
{
    public Guid UserId { get; }
    public string Email { get; }
    public string FullName { get; }

    public UserRegistered(Guid userId, string email, string fullName)
    {
        UserId = userId;
        Email = email;
        FullName = fullName;
    }
}

public sealed class UserInvited : DomainEvent
{
    public Guid InvitationId { get; }
    public Guid WorkspaceId { get; }
    public string Email { get; }
    public WorkspaceMemberRole Role { get; }
    public Guid InvitedBy { get; }

    public UserInvited(Guid invitationId, Guid workspaceId, string email, WorkspaceMemberRole role, Guid invitedBy)
    {
        InvitationId = invitationId;
        WorkspaceId = workspaceId;
        Email = email;
        Role = role;
        InvitedBy = invitedBy;
    }
}

public sealed class WorkspaceCreated : DomainEvent
{
    public Guid WorkspaceId { get; }
    public string Name { get; }
    public Guid OwnerId { get; }

    public WorkspaceCreated(Guid workspaceId, string name, Guid ownerId)
    {
        WorkspaceId = workspaceId;
        Name = name;
        OwnerId = ownerId;
    }
}

public sealed class ChannelCreated : DomainEvent
{
    public Guid ChannelId { get; }
    public Guid WorkspaceId { get; }
    public string Name { get; }
    public ChannelType Type { get; }
    public Guid CreatedBy { get; }

    public ChannelCreated(Guid channelId, Guid workspaceId, string name, ChannelType type, Guid createdBy)
    {
        ChannelId = channelId;
        WorkspaceId = workspaceId;
        Name = name;
        Type = type;
        CreatedBy = createdBy;
    }
}

public sealed class ChannelMemberAdded : DomainEvent
{
    public Guid ChannelId { get; }
    public Guid UserId { get; }
    public Guid AddedBy { get; }

    public ChannelMemberAdded(Guid channelId, Guid userId, Guid addedBy)
    {
        ChannelId = channelId;
        UserId = userId;
        AddedBy = addedBy;
    }
}
