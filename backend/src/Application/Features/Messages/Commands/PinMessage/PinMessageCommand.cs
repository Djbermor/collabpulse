using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Messages.Commands.PinMessage;

public record PinMessageCommand(
    Guid TenantId,
    Guid MessageId) : IRequest<Result<bool>>, ITenantScopedRequest;

public class PinMessageCommandHandler : IRequestHandler<PinMessageCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public PinMessageCommandHandler(
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

    public async Task<Result<bool>> Handle(PinMessageCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        var message = await _context.Messages
            .FirstOrDefaultAsync(m => m.Id == request.MessageId && m.TenantId == request.TenantId, cancellationToken);

        if (message == null)
        {
            throw new NotFoundException(nameof(Message), request.MessageId);
        }

        var existingPin = await _context.MessagePins
            .FirstOrDefaultAsync(p => p.MessageId == request.MessageId, cancellationToken);

        var isPinned = false;
        if (existingPin != null)
        {
            _context.MessagePins.Remove(existingPin);
            message.IsPinned = false;
        }
        else
        {
            isPinned = true;
            message.IsPinned = true;
            _context.MessagePins.Add(new MessagePin
            {
                Id = Guid.NewGuid(),
                MessageId = request.MessageId,
                PinnedBy = currentUserId,
                PinnedAt = _dateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        var payload = new
        {
            MessageId = message.Id,
            IsPinned = isPinned,
            PinnedBy = currentUserId
        };

        if (message.ChannelId.HasValue)
        {
            await _realtimeHub.BroadcastToChannelAsync(request.TenantId, message.ChannelId.Value, "message.pinned", payload, cancellationToken);
        }
        else if (message.ConversationId.HasValue)
        {
            await _realtimeHub.BroadcastToConversationAsync(request.TenantId, message.ConversationId.Value, "message.pinned", payload, cancellationToken);
        }

        return Result<bool>.Success(isPinned);
    }
}
