namespace CollabPulse.Domain.Common;

public abstract class SoftDeletableEntity : AuditableEntity, ISoftDeletable
{
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
    public bool IsDeleted => DeletedAt.HasValue;

    public virtual void SoftDelete(Guid? deletedBy = null)
    {
        DeletedAt = DateTimeOffset.UtcNow;
        DeletedBy = deletedBy;
    }

    public virtual void Restore()
    {
        DeletedAt = null;
        DeletedBy = null;
    }
}
