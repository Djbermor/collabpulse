namespace CollabPulse.Application.Common.Exceptions;

public class NotFoundException : Exception
{
    public NotFoundException() : base()
    {
    }

    public NotFoundException(string message) : base(message)
    {
    }

    public NotFoundException(string message, Exception innerException) : base(message, innerException)
    {
    }

    public NotFoundException(string name, object key)
        : base($"Entity \"{name}\" ({key}) was not found.")
    {
    }
}

public class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException() : base("You do not have permission to access this resource.")
    {
    }

    public ForbiddenAccessException(string message) : base(message)
    {
    }
}

public class TenantMismatchException : Exception
{
    public TenantMismatchException()
        : base("Cross-tenant access violation: Target entity does not belong to the current authenticated tenant.")
    {
    }

    public TenantMismatchException(Guid expectedTenantId, Guid actualTenantId)
        : base($"Tenant mismatch violation: Expected tenant {expectedTenantId}, but received operation for tenant {actualTenantId}.")
    {
    }
}

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message)
    {
    }
}
