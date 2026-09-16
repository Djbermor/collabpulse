namespace CollabPulse.Application.Features.Workspaces;

public record WorkspaceDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string Slug,
    string? Description,
    string? LogoUrl,
    string Timezone,
    bool IsActive,
    int MemberCount,
    int ChannelCount,
    string UserRole,
    DateTimeOffset CreatedAt);
