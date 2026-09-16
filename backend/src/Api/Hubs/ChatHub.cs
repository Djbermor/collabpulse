using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace CollabPulse.Api.Hubs;

public interface IChatClient
{
    Task ReceiveMessage(object message);
    Task MessageUpdated(object message);
    Task MessageDeleted(Guid messageId);
    Task UserTyping(Guid channelId, Guid userId, string userName);
    Task UserPresenceChanged(Guid userId, string status);
    Task NotificationReceived(object notification);
    Task TaskUpdated(object task);
    Task MeetingStarted(object meeting);
}

public class ChatHub : Hub<IChatClient>
{
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ILogger<ChatHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var workspaceId = httpContext?.Request.Query["workspaceId"].ToString();

        if (!string.IsNullOrEmpty(workspaceId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace_{workspaceId}");
            _logger.LogInformation("Connection {ConnectionId} joined workspace {WorkspaceId}", Context.ConnectionId, workspaceId);
        }

        await base.OnConnectedAsync();
    }

    public async Task JoinChannel(string channelId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"channel_{channelId}");
        _logger.LogDebug("Connection {ConnectionId} joined channel {ChannelId}", Context.ConnectionId, channelId);
    }

    public async Task LeaveChannel(string channelId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel_{channelId}");
        _logger.LogDebug("Connection {ConnectionId} left channel {ChannelId}", Context.ConnectionId, channelId);
    }

    public async Task SendTypingIndicator(string channelId, string userName)
    {
        var userIdStr = Context.UserIdentifier ?? Context.ConnectionId;
        Guid.TryParse(userIdStr, out var userId);
        Guid.TryParse(channelId, out var chId);

        await Clients.OthersInGroup($"channel_{channelId}").UserTyping(chId, userId, userName);
    }

    public async Task UpdatePresence(string status)
    {
        var userIdStr = Context.UserIdentifier ?? Context.ConnectionId;
        if (Guid.TryParse(userIdStr, out var userId))
        {
            await Clients.All.UserPresenceChanged(userId, status);
        }
    }
}
