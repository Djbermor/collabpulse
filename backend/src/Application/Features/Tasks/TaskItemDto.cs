using CollabPulse.Domain.Enums;

namespace CollabPulse.Application.Features.Tasks;

public record TaskAssigneeDto(
    Guid Id,
    string FullName,
    string Email,
    string? AvatarUrl);

public record TaskItemDto(
    Guid Id,
    Guid TenantId,
    Guid WorkspaceId,
    string Title,
    string? Description,
    TaskStatus Status,
    TaskPriority Priority,
    DateTimeOffset? DueDate,
    DateTimeOffset? CompletedAt,
    TaskAssigneeDto? Assignee,
    TaskAssigneeDto Creator,
    int CommentCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
