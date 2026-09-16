using CollabPulse.Domain.Common;

namespace CollabPulse.Domain.Entities;

public class Tenant : BaseEntity, IAuditableEntity, ISoftDeletable
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? LogoUrl { get; set; }
    public string Timezone { get; set; } = "UTC";
    public string Language { get; set; } = "es";
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }

    // Navigation properties
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Workspace> Workspaces { get; set; } = new List<Workspace>();
    public ICollection<Role> Roles { get; set; } = new List<Role>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    public ICollection<FileMetadata> Files { get; set; } = new List<FileMetadata>();
    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
    public ICollection<Integration> Integrations { get; set; } = new List<Integration>();
}
