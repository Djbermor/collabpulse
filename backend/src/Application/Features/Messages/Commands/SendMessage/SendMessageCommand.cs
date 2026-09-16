using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using CollabPulse.Domain.Entities;
using CollabPulse.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Messages.Commands.SendMessage;

public record SendMessageCommand(
    Guid TenantId,
    Guid WorkspaceId,
    Guid? ChannelId,
    Guid? ConversationId,
    string Content,
    Guid? ParentId = null,
    MessageType MessageType = MessageType.Text,
    List<Guid>? AttachmentFileIds = null) : IRequest<Result<MessageDto>>, ITenantScopedRequest;

public class SendMessageCommandHandler : IRequestHandler<SendMessageCommand, Result<MessageDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IRealtimeHubService _realtimeHub;
    private readonly IDateTime _dateTime;

    public SendMessageCommandHandler(
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

    public async Task<Result<MessageDto>> Handle(SendMessageCommand request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        // 1. Target Validation & Membership Checks
        if (request.ChannelId.HasValue)
        {
            var isChannelMember = await _context.ChannelMembers
                .AnyAsync(cm => cm.ChannelId == request.ChannelId.Value && cm.UserId == currentUserId, cancellationToken);

            if (!isChannelMember)
            {
                throw new ForbiddenAccessException("You must be a member of this channel to send messages.");
            }
        }
        else if (request.ConversationId.HasValue)
        {
            var isConversationMember = await _context.ConversationMembers
                .AnyAsync(cm => cm.ConversationId == request.ConversationId.Value && cm.UserId == currentUserId, cancellationToken);

            if (!isConversationMember)
            {
                throw new ForbiddenAccessException("You must be a participant in this conversation to send messages.");
            }
        }

        // 2. Thread parent validation
        if (request.ParentId.HasValue)
        {
            var parentMessage = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == request.ParentId.Value && m.TenantId == request.TenantId, cancellationToken);

            if (parentMessage == null)
            {
                throw new NotFoundException(nameof(Message), request.ParentId.Value);
            }

            if (request.ChannelId.HasValue && parentMessage.ChannelId != request.ChannelId.Value)
            {
                throw new ValidationException("ParentId", "Thread reply must belong to the same channel as parent message.");
            }

            if (request.ConversationId.HasValue && parentMessage.ConversationId != request.ConversationId.Value)
            {
                throw new ValidationException("ParentId", "Thread reply must belong to the same conversation as parent message.");
            }
        }

        var now = _dateTime.UtcNow;
        var messageId = Guid.NewGuid();

        // 3. Create message entity
        var message = new Message
        {
            Id = messageId,
            TenantId = request.TenantId,
            WorkspaceId = request.WorkspaceId,
            ChannelId = request.ChannelId,
            ConversationId = request.ConversationId,
            ParentId = request.ParentId,
            SenderId = currentUserId,
            Content = request.Content.Trim(),
            MessageType = request.MessageType,
            IsPinned = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        _context.Messages.Add(message);

        // 4. Attachments
        var attachmentDtos = new List<MessageAttachmentDto>();
        if (request.AttachmentFileIds != null && request.AttachmentFileIds.Any())
        {
            var files = await _context.Files
                .Where(f => request.AttachmentFileIds.Contains(f.Id) && f.TenantId == request.TenantId)
                .ToListAsync(cancellationToken);

            foreach (var file in files)
            {
                var attachment = new MessageAttachment
                {
                    Id = Guid.NewGuid(),
                    MessageId = messageId,
                    FileId = file.Id,
                    CreatedAt = now
                };
                _context.MessageAttachments.Add(attachment);

                attachmentDtos.Add(new MessageAttachmentDto(
                    attachment.Id,
                    file.Id,
                    file.FileName,
                    file.ContentType,
                    file.SizeBytes,
                    file.StorageKey,
                    file.PublicUrl ?? string.Empty));
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        // 5. Load sender profile for the response
        var sender = await _context.Users
            .FirstAsync(u => u.Id == currentUserId, cancellationToken);

        var senderDto = new MessageSenderDto(
            sender.Id,
            $"{sender.FirstName} {sender.LastName}",
            sender.Email,
            sender.AvatarUrl);

        var messageDto = new MessageDto(
            Id: message.Id,
            TenantId: message.TenantId,
            WorkspaceId: message.WorkspaceId,
            ChannelId: message.ChannelId,
            ConversationId: message.ConversationId,
            ParentId: message.ParentId,
            Sender: senderDto,
            Content: message.Content,
            MessageType: message.MessageType,
            IsPinned: false,
            ReplyCount: 0,
            EditedAt: null,
            CreatedAt: message.CreatedAt,
            Reactions: new List<ReactionSummaryDto>(),
            Attachments: attachmentDtos);

        // 6. Real-time broadcast
        if (request.ChannelId.HasValue)
        {
            await _realtimeHub.BroadcastToChannelAsync(
                request.TenantId,
                request.ChannelId.Value,
                "message.new",
                messageDto,
                cancellationToken);
        }
        else if (request.ConversationId.HasValue)
        {
            await _realtimeHub.BroadcastToConversationAsync(
                request.TenantId,
                request.ConversationId.Value,
                "message.new",
                messageDto,
                cancellationToken);
        }

        return Result<MessageDto>.Success(messageDto);
    }
}
