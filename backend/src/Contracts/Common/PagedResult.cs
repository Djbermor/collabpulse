namespace CollabPulse.Contracts.Common;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int PageNumber,
    int PageSize,
    int TotalCount,
    bool HasNextPage,
    bool HasPreviousPage
)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)Math.Max(1, PageSize));
}

public record ProblemDetailsResponse(
    string Type,
    string Title,
    int Status,
    string Detail,
    string Instance,
    IDictionary<string, string[]>? Extensions = null
);

public record ErrorResponse(
    string Code,
    string Message,
    IReadOnlyList<string>? Errors = null
);
