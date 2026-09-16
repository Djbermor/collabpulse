namespace CollabPulse.Contracts.Auth;

public record RegisterRequest(string Email, string Password, string FullName);
public record LoginRequest(string Email, string Password);
public record RefreshTokenRequest(string RefreshToken);
public record AuthResponse(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, UserSummaryDto User);
public record UserSummaryDto(Guid Id, string Email, string FullName, string? AvatarUrl, string Status);

namespace CollabPulse.Contracts.Workspaces;

public record CreateWorkspaceRequest(string Name, string? Description, string? Slug);
public record WorkspaceResponse(Guid Id, string Name, string Slug, string? Description, DateTimeOffset CreatedAt, string Role);
public record InviteMemberRequest(string Email, string Role);

namespace CollabPulse.Contracts.Channels;

public record CreateChannelRequest(Guid WorkspaceId, string Name, string? Topic, bool IsPrivate);
public record ChannelResponse(Guid Id, Guid WorkspaceId, string Name, string? Topic, bool IsPrivate, int MemberCount, DateTimeOffset CreatedAt);

namespace CollabPulse.Contracts.Messages;

public record SendMessageRequest(Guid? ChannelId, Guid? ConversationId, string Content, int Type = 0, Guid? ParentMessageId = null);
public record EditMessageRequest(string Content);
public record MessageResponse(Guid Id, Guid? ChannelId, Guid? ConversationId, Guid SenderId, string SenderName, string? SenderAvatarUrl, string Content, int Type, bool IsEdited, DateTimeOffset CreatedAt, IReadOnlyList<ReactionDto>? Reactions = null, int ThreadReplyCount = 0);
public record ReactionDto(string EmojiCode, int Count, List<Guid> UserIds);

namespace CollabPulse.Contracts.Tasks;

public record CreateTaskRequest(Guid WorkspaceId, string Title, string? Description, int Priority, DateTimeOffset? DueDate, Guid? AssigneeId);
public record UpdateTaskStatusRequest(int Status);
public record TaskResponse(Guid Id, Guid WorkspaceId, string Title, string? Description, int Priority, int Status, DateTimeOffset? DueDate, Guid? AssigneeId, string? AssigneeName, DateTimeOffset CreatedAt);

namespace CollabPulse.Contracts.Calendar;

public record CreateCalendarEventRequest(Guid WorkspaceId, string Title, string? Description, DateTimeOffset StartTime, DateTimeOffset EndTime, string? Location, List<Guid>? AttendeeIds);
public record CalendarEventResponse(Guid Id, Guid WorkspaceId, string Title, string? Description, DateTimeOffset StartTime, DateTimeOffset EndTime, string? Location, Guid OrganizerId, List<Guid> AttendeeIds);

namespace CollabPulse.Contracts.Meetings;

public record StartMeetingRequest(Guid WorkspaceId, string Title, string Provider = "LiveKit");
public record MeetingResponse(Guid Id, Guid WorkspaceId, string Title, string RoomName, string JoinUrl, string Token, string Status, DateTimeOffset CreatedAt);

namespace CollabPulse.Contracts.Notifications;

public record NotificationResponse(Guid Id, int Type, string Title, string Content, bool IsRead, DateTimeOffset CreatedAt, string? ActionUrl);
