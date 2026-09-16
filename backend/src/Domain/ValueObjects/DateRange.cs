namespace CollabPulse.Domain.ValueObjects;

public sealed record DateRange
{
    public DateTimeOffset Start { get; }
    public DateTimeOffset End { get; }

    public DateRange(DateTimeOffset start, DateTimeOffset end)
    {
        if (end < start)
            throw new ArgumentException("End date cannot be earlier than start date.", nameof(end));

        Start = start;
        End = end;
    }

    public TimeSpan Duration => End - Start;

    public bool Includes(DateTimeOffset dateTime) => dateTime >= Start && dateTime <= End;

    public bool Overlaps(DateRange other) => Start < other.End && other.Start < End;
}
