namespace CollabPulse.Domain.ValueObjects;

public sealed record FileSize
{
    public const long MaxSizeBytes = 100 * 1024 * 1024; // 100 MB max

    public long Bytes { get; }

    public FileSize(long bytes)
    {
        if (bytes < 0)
            throw new ArgumentOutOfRangeException(nameof(bytes), "File size cannot be negative.");
        if (bytes > MaxSizeBytes)
            throw new ArgumentOutOfRangeException(nameof(bytes), $"File size exceeds limit of {MaxSizeBytes} bytes.");

        Bytes = bytes;
    }

    public double MegaBytes => Bytes / (1024.0 * 1024.0);

    public static implicit operator long(FileSize size) => size.Bytes;
    public static explicit operator FileSize(long bytes) => new(bytes);
    public override string ToString() => $"{MegaBytes:0.##} MB";
}
