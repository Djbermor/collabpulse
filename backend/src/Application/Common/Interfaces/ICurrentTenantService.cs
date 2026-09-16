namespace CollabPulse.Application.Common.Interfaces;

public interface ICurrentTenantService
{
    Guid? CurrentTenantId { get; }
    string? TenantSlug { get; }
    void SetTenant(Guid tenantId, string? tenantSlug = null);
}
