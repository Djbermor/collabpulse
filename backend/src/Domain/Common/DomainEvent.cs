namespace CollabPulse.Domain.Common;

public abstract class DomainEvent
{
    public Guid EventId { get; } = Guid.NewGuid();
    public DateTimeOffset OccurredOn { get; } = DateTimeOffset.UtcNow;
}

public interface IDomainEventNotification
{
    Guid EventId { get; }
    DateTimeOffset OccurredOn { get; }
}
