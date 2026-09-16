using CollabPulse.Contracts.Calendar;
using CollabPulse.Contracts.Common;
using CollabPulse.Contracts.Meetings;
using CollabPulse.Contracts.Notifications;
using CollabPulse.Contracts.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace CollabPulse.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class TasksController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<TaskResponse>> GetTasks([FromQuery] Guid workspaceId)
    {
        var list = new List<TaskResponse>
        {
            new(Guid.NewGuid(), workspaceId, "Implement Part 7 Clean Architecture", "Core contracts and SignalR hubs", 2, 1, DateTimeOffset.UtcNow.AddDays(1), null, "Unassigned", DateTimeOffset.UtcNow)
        };
        return Ok(list);
    }

    [HttpPost]
    public ActionResult<TaskResponse> CreateTask([FromBody] CreateTaskRequest request)
    {
        var task = new TaskResponse(Guid.NewGuid(), request.WorkspaceId, request.Title, request.Description, request.Priority, 0, request.DueDate, request.AssigneeId, null, DateTimeOffset.UtcNow);
        return CreatedAtAction(nameof(GetTasks), task);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class CalendarController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<CalendarEventResponse>> GetEvents([FromQuery] Guid workspaceId)
    {
        var list = new List<CalendarEventResponse>
        {
            new(Guid.NewGuid(), workspaceId, "Engineering Sprint Sync", "Review SignalR and Backplane performance", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddHours(1), "Meeting Room A", Guid.NewGuid(), new List<Guid>())
        };
        return Ok(list);
    }

    [HttpPost]
    public ActionResult<CalendarEventResponse> CreateEvent([FromBody] CreateCalendarEventRequest request)
    {
        var evt = new CalendarEventResponse(Guid.NewGuid(), request.WorkspaceId, request.Title, request.Description, request.StartTime, request.EndTime, request.Location, Guid.NewGuid(), request.AttendeeIds ?? new List<Guid>());
        return CreatedAtAction(nameof(GetEvents), evt);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class MeetingsController : ApiControllerBase
{
    [HttpPost("start")]
    public ActionResult<MeetingResponse> StartMeeting([FromBody] StartMeetingRequest request)
    {
        var roomId = "room-" + Guid.NewGuid().ToString("N")[..8];
        var response = new MeetingResponse(
            Id: Guid.NewGuid(),
            WorkspaceId: request.WorkspaceId,
            Title: request.Title,
            RoomName: roomId,
            JoinUrl: $"https://meet.collabpulse.com/{roomId}",
            Token: "livekit-token-" + Guid.NewGuid().ToString("N"),
            Status: "Active",
            CreatedAt: DateTimeOffset.UtcNow
        );
        return Ok(response);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class NotificationsController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<NotificationResponse>> GetNotifications()
    {
        var list = new List<NotificationResponse>
        {
            new(Guid.NewGuid(), 0, "Mentioned in #general", "Alex Rivera mentioned you in a discussion", false, DateTimeOffset.UtcNow, "/channels/general")
        };
        return Ok(list);
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class SearchController : ApiControllerBase
{
    [HttpGet]
    public ActionResult<object> Search([FromQuery] string query, [FromQuery] Guid workspaceId)
    {
        return Ok(new
        {
            query,
            messages = new List<object>(),
            channels = new List<object>(),
            files = new List<object>()
        });
    }
}

[ApiController]
[Route("api/v1/[controller]")]
public class AdministrationController : ApiControllerBase
{
    [HttpGet("audit-logs")]
    public ActionResult<IReadOnlyList<object>> GetAuditLogs([FromQuery] Guid workspaceId)
    {
        return Ok(new List<object>
        {
            new { Id = Guid.NewGuid(), Action = "WorkspaceSettingsUpdated", Timestamp = DateTimeOffset.UtcNow }
        });
    }
}
