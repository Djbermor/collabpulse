namespace CollabPulse.Application.Common.Models;

public class Result
{
    internal Result(bool succeeded, IEnumerable<string> errors)
    {
        Succeeded = succeeded;
        Errors = errors.ToArray();
    }

    public bool Succeeded { get; init; }
    public string[] Errors { get; init; }

    public static Result Success() => new(true, Array.Empty<string>());
    public static Result Failure(IEnumerable<string> errors) => new(false, errors);
    public static Result Failure(string error) => new(false, new[] { error });
}

public class Result<T> : Result
{
    internal Result(bool succeeded, T? data, IEnumerable<string> errors) : base(succeeded, errors)
    {
        Data = data;
    }

    public T? Data { get; init; }

    public static Result<T> Success(T data) => new(true, data, Array.Empty<string>());
    public static new Result<T> Failure(IEnumerable<string> errors) => new(false, default, errors);
    public static new Result<T> Failure(string error) => new(false, default, new[] { error });
}
