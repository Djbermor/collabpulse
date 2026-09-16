namespace CollabPulse.Application.Common.Interfaces;

public interface IRealtimeHubService
{
    Task BroadcastToChannelAsync(Guid tenantId, Guid channelId, string eventName, object payload, CancellationToken cancellationToken = default);
    Task BroadcastToConversationAsync(Guid tenantId, Guid conversationId, string eventName, object payload, CancellationToken cancellationToken = default);
    Task BroadcastToWorkspaceAsync(Guid tenantId, Guid workspaceId, string eventName, object payload, CancellationToken cancellationToken = default);
    Task SendToUserAsync(Guid tenantId, Guid userId, string eventName, object payload, CancellationToken cancellationToken = default);
}
