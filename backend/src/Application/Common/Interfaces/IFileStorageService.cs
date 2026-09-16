namespace CollabPulse.Application.Common.Interfaces;

public record FileUploadResult(string StorageKey, string PublicUrl, long SizeBytes, string ContentType);

public interface IFileStorageService
{
    Task<FileUploadResult> UploadFileAsync(
        Guid tenantId,
        string fileName,
        string contentType,
        Stream contentStream,
        CancellationToken cancellationToken = default);

    Task DeleteFileAsync(string storageKey, CancellationToken cancellationToken = default);
    Task<string> GetDownloadUrlAsync(string storageKey, TimeSpan expiry, CancellationToken cancellationToken = default);
}
