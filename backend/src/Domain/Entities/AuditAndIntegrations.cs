using System.Net;
using CollabPulse.Domain.Common;

namespace CollabPulse.Domain.Entities;

public class AuditLog : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public IPAddress? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public Guid? RequestId { get; set; }
    public string? MetadataJson { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public User? User { get; set; }
}

public class SubscriptionPlan : BaseEntity, IAuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int PriceCents { get; set; } = 0;
    public string BillingPeriod { get; set; } = "monthly";
    public string FeaturesJson { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}

public class Subscription : BaseEntity, ITenantEntity, IAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid PlanId { get; set; }
    public string Status { get; set; } = "active";
    public DateTimeOffset CurrentPeriodStart { get; set; }
    public DateTimeOffset CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; } = false;
    public string? ExternalCustomerId { get; set; }
    public string? ExternalSubscriptionId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public SubscriptionPlan Plan { get; set; } = null!;
    public ICollection<SubscriptionItem> Items { get; set; } = new List<SubscriptionItem>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
}

public class SubscriptionItem : BaseEntity
{
    public Guid SubscriptionId { get; set; }
    public string FeatureKey { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public int UnitPriceCents { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Subscription Subscription { get; set; } = null!;
}

public class Invoice : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid? SubscriptionId { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public int AmountDueCents { get; set; }
    public int AmountPaidCents { get; set; } = 0;
    public string Currency { get; set; } = "USD";
    public string Status { get; set; } = "draft";
    public DateTimeOffset DueDate { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public Subscription? Subscription { get; set; }
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class Payment : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid InvoiceId { get; set; }
    public int AmountCents { get; set; }
    public string Currency { get; set; } = "USD";
    public string PaymentMethod { get; set; } = "credit_card";
    public string PaymentGateway { get; set; } = "stripe";
    public string? GatewayTransactionId { get; set; }
    public string Status { get; set; } = "succeeded";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public Invoice Invoice { get; set; } = null!;
}

public class Integration : BaseEntity, ITenantEntity, IAuditableEntity
{
    public Guid TenantId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string ConfigJson { get; set; } = "{}";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
}

public class OAuthConnection : BaseEntity, ITenantEntity, IAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid UserId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string? AccountEmail { get; set; }
    public string AccessTokenHash { get; set; } = string.Empty;
    public string? RefreshTokenHash { get; set; }
    public DateTimeOffset? TokenExpiresAt { get; set; }
    public string[] Scopes { get; set; } = Array.Empty<string>();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class Webhook : BaseEntity, ITenantEntity, IAuditableEntity
{
    public Guid TenantId { get; set; }
    public Guid WorkspaceId { get; set; }
    public string TargetUrl { get; set; } = string.Empty;
    public string SecretHash { get; set; } = string.Empty;
    public string[] SubscribedEvents { get; set; } = Array.Empty<string>();
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
}

public class ApiKey : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; set; }
    public Guid CreatedBy { get; set; }
    public string KeyPrefix { get; set; } = string.Empty;
    public string KeyHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string[] Scopes { get; set; } = Array.Empty<string>();
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RevokedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public User Creator { get; set; } = null!;
}
