using CollabPulse.Domain.Common;
using CollabPulse.Domain.Enums;

namespace CollabPulse.Domain.Entities;

public class TaskItem : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public Guid CreatedBy { get; set; }
    public Guid? AssignedTo { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TaskStatus Status { get; set; } = TaskStatus.Pending;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public DateTimeOffset? DueDate { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public User? Assignee { get; set; }
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
    public ICollection<TaskAttachment> Attachments { get; set; } = new List<TaskAttachment>();
}

public class TaskComment : BaseEntity, IAuditableEntity, ISoftDeletable
{
    public Guid TaskId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeletedAt { get; set; }

    public TaskItem Task { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class TaskAttachment : BaseEntity
{
    public Guid TaskId { get; set; }
    public Guid FileId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public TaskItem Task { get; set; } = null!;
    public FileMetadata File { get; set; } = null!;
}

public class Meeting : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = string.Empty;
    public string MeetingCode { get; set; } = string.Empty;
    public MeetingProvider Provider { get; set; } = MeetingProvider.Internal;
    public string? ProviderRoomId { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public MeetingStatus Status { get; set; } = MeetingStatus.Scheduled;

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public ICollection<MeetingParticipant> Participants { get; set; } = new List<MeetingParticipant>();
    public ICollection<CalendarEvent> LinkedCalendarEvents { get; set; } = new List<CalendarEvent>();
}

public class MeetingParticipant
{
    public Guid MeetingId { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset JoinedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LeftAt { get; set; }

    public Meeting Meeting { get; set; } = null!;
    public User User { get; set; } = null!;
}

public class CalendarEvent : AuditableTenantEntity
{
    public Guid WorkspaceId { get; set; }
    public Guid CreatedBy { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public string? Location { get; set; }
    public Guid? MeetingId { get; set; }
    public bool IsAllDay { get; set; } = false;
    public string? RecurrenceRule { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public Workspace Workspace { get; set; } = null!;
    public User Creator { get; set; } = null!;
    public Meeting? LinkedMeeting { get; set; }
    public ICollection<CalendarEventAttendee> Attendees { get; set; } = new List<CalendarEventAttendee>();
}

public class CalendarEventAttendee
{
    public Guid EventId { get; set; }
    public Guid UserId { get; set; }
    public CalendarAttendeeStatus ResponseStatus { get; set; } = CalendarAttendeeStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public CalendarEvent Event { get; set; } = null!;
    public User User { get; set; } = null!;
}
