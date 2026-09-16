namespace CollabPulse.Application.Common.Interfaces;

public interface IDateTime
{
    DateTimeOffset UtcNow { get; }
}

public class MachineDateTime : IDateTime
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
