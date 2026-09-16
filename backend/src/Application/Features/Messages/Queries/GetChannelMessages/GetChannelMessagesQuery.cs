using CollabPulse.Application.Common.Exceptions;
using CollabPulse.Application.Common.Interfaces;
using CollabPulse.Application.Common.Models;
using CollabPulse.Application.Common.Security;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace CollabPulse.Application.Features.Messages.Queries.GetChannelMessages;

public record GetChannelMessagesQuery(
    Guid TenantId,
    Guid ChannelId,
    Guid? ParentId = null,
    int PageIndex = 1,
    int PageSize = 50) : IRequest<Result<PaginatedList<MessageDto>>>, ITenantScopedRequest;

public class GetChannelMessagesQueryHandler : IRequestHandler<GetChannelMessagesQuery, Result<PaginatedList<MessageDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetChannelMessagesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<PaginatedList<MessageDto>>> Handle(GetChannelMessagesQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId ?? throw new ForbiddenAccessException();

        // 1. Verify channel access
        var isMember = await _context.ChannelMembers
            .AnyAsync(cm => cm.ChannelId == request.ChannelId && cm.UserId == currentUserId, cancellationToken);

        if (!isMember)
        {
            throw new ForbiddenAccessException("You must be a channel member to read its messages.");
        }

        // 2. Base Query
        var query = _context.Messages
            .Where(m => m.TenantId == request.TenantId && m.ChannelId == request.ChannelId && m.ParentId == request.ParentId)
            .OrderByDescending(m => m.CreatedAt);

        var totalCount = await query.CountAsync(cancellationToken);

        var rawMessages = await query
            .Skip((request.PageIndex - 1) * request.PageSize)
            .Take(request.PageSize)
            .Include(m => m.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Replies)
            .Include(m => m.Attachments)
                .ThenInclude(a => a.File)
            .ToListAsync(cancellationToken);

        // Map to DTOs
        var dtos = rawMessages.Select(m =>
        {
            var reactions = m.Reactions
                .GroupBy(r => r.Emoji)
                .Select(g => new ReactionSummaryDto(
                    Emoji: g.Key,
                    Count: g.Count(),
                    ReactedByMe: g.Any(r => r.UserId == currentUserId),
                    UserIds: g.Select(r => r.UserId).ToList()))
                .ToList();

            var attachments = m.Attachments.Select(a => new MessageAttachmentDto(
                a.Id,
                a.FileId,
                a.File.FileName,
                a.File.ContentType,
                a.File.SizeBytes,
                a.File.StorageKey,
                a.File.PublicUrl ?? string.Empty)).ToList();

            var senderDto = new MessageSenderDto(
                m.Sender.Id,
                $"{m.Sender.FirstName} {m.Sender.LastName}",
                m.Sender.Email,
                m.Sender.AvatarUrl);

            return new MessageDto(
                Id: m.Id,
                TenantId: m.TenantId,
                WorkspaceId: m.WorkspaceId,
                ChannelId: m.ChannelId,
                ConversationId: m.ConversationId,
                ParentId: m.ParentId,
                Sender: senderDto,
                Content: m.Content,
                MessageType: m.MessageType,
                IsPinned: m.IsPinned,
                ReplyCount: m.Replies.Count,
                EditedAt: m.EditedAt,
                CreatedAt: m.CreatedAt,
                Reactions: reactions,
                Attachments: attachments);
        })
        .OrderBy(m => m.CreatedAt) // Chronological order for chat feed
        .ToList();

        var paginated = new PaginatedList<MessageDto>(dtos, totalCount, request.PageIndex, request.PageSize);
        return Result<PaginatedList<MessageDto>>.Success(paginated);
    }
}
