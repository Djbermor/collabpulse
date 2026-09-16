using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Messages.Commands.AddReaction;

public record AddReactionCommand(
    Guid TenantId,
    Guid MessageId,
    string Emoji) : IRequest<Result<bool>>, ITenantScopedRequest;

public class AddReactionCommandHandler : IRequestHandler<AddReactionCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public AddReactionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IRealtimeHubService realtimeHub,
        IDateTime dateTime)
    {
        _context = context;
        _currentUserService = currentUserService;
        _realtimeHub = realtimeHub;
        _dateTime = dateTime;
    }

    public async Task<Result<bool>> Handle(AddReactionCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();
        var cleanEmoji = request.Emoji.Trim();

        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.Id == request.MessageId && m.TenantId == request.TenantId, cancellationToken);

        if (message == null)
        {
            throw new NotFoundException(nameof(Message), request.MessageId);
        }

        // Check if user already reacted with this emoji (toggle pattern)
        var existing = await _context.MessageReactions
            .FirstOrDefaultAsync(r => r.MessageId == request.MessageId && r.UserId == currentUserId && r.Emoji == cleanEmoji, cancellationToken);

        var isAdded = false;
        if (existing != null)
        {
            _context.MessageReactions.Remove(existing);
        }
        else
        {
            isAdded = true;
            _context.MessageReactions.Add(new MessageReaction
            {
                Id = Guid.NewGuid(),
                MessageId = request.MessageId,
                UserId = currentUserId,
                Emoji = cleanEmoji,
                CreatedAt = _dateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        // Realtime notification
        var payload = new
        {
            MessageId = request.MessageId,
            UserId = currentUserId,
            Emoji = cleanEmoji,
            Action = isAdded ? "added" : "removed"
        };

        if (message.ChannelId.HasValue)
        {
            await _realtimeHub.BroadcastToChannelAsync(request.TenantId, message.ChannelId.Value, "message.reaction", payload, cancellationToken);
        }
        else if (message.ConversationId.HasValue)
        {
            await _realtimeHub.BroadcastToConversationAsync(request.TenantId, message.ConversationId.Value, "message.reaction", payload, cancellationToken);
        }

        return Result<bool>.Success(isAdded);
    }
}
