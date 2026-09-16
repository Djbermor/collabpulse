namespace CollabPulse.Domain.Enums;

public enum UserStatus
{
    Online,
    Away,
    Busy,
    Dnd,
    Offline
}

public enum ChannelType
{
    Public,
    Private
}

public enum ConversationType
{
    Direct,
    Group
}

public enum MessageType
{
    Text,
    System,
    File,
    Image,
    Audio,
    Video
}

public enum TaskStatus
{
    Pending,
    InProgress,
    Completed,
    Cancelled,
    Postponed
}

public enum TaskPriority
{
    Low,
    Medium,
    High,
    Urgent
}

public enum MeetingProvider
{
    Internal,
    LiveKit,
    Zoom,
    Teams
}

public enum MeetingStatus
{
    Scheduled,
    Active,
    Ended,
    Cancelled
}

public enum CalendarAttendeeStatus
{
    Pending,
    Accepted,
    Declined,
    Tentative
}

public enum StorageProvider
{
    Local,
    AzureBlob,
    S3,
    Minio
}
