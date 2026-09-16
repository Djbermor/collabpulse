using CollabPulse.Domain.Common;

namespace CollabPulse.Domain.Entities;

public class Workspace : AuditableTenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string Timezone { get; set; } = "UTC";
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Tenant Tenant { get; set; } = null!;
    public ICollection<WorkspaceMember> Members { get; set; } = new List<WorkspaceMember>();
    public ICollection<WorkspaceInvitation> Invitations { get; set; } = new List<WorkspaceInvitation>();
    public ICollection<Channel> Channels { get; set; } = new List<Channel>();
    public ICollection<Conversation> Conversations { get; set; } = new List<Conversation>();
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    public ICollection<CalendarEvent> CalendarEvents { get; set; } = new List<CalendarEvent>();
    public ICollection<Meeting> Meetings { get; set; } = new List<Meeting>();
}

public class WorkspaceMember
{
    public Guid WorkspaceId { get; set; }
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastActiveAt { get; set; }
    public bool IsActive { get; set; } = true;

    public Workspace Workspace { get; set; } = null!;
    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}

public class WorkspaceInvitation : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid WorkspaceId { get; set; }
    public string Email { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public Guid InvitedBy { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public Role Role { get; set; } = null!;
    public User Inviter { get; set; } = null!;
}
