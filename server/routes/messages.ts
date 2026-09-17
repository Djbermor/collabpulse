import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';
import { Message, MessageReaction, MessageEditHistory, PinnedMessage, SavedMessage } from '../../src/types';

export const messagesRouter = Router();

// Track idempotency to avoid duplicate messages from network retries (Section 42)
const processedClientMessageIds = new Map<string, { messageId: string; timestamp: number }>();

// Cleanup processed client message IDs every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of processedClientMessageIds.entries()) {
    if (value.timestamp < cutoff) {
      processedClientMessageIds.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Helper to check user can access the channel/conversation
function checkAccess(req: AuthenticatedRequest, channelId?: string, conversationId?: string): { allowed: boolean; error?: string; status?: number } {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  if (channelId) {
    const channel = db.channels.find(c => c.id === channelId && c.tenantId === tenantId && !c.deletedAt);
    if (!channel) {
      return { allowed: false, error: 'Canal no encontrado', status: 404 };
    }
    if (channel.isPrivate) {
      const isMember = db.channelMembers.some(m => m.channelId === channelId && m.userId === userId);
      if (!isMember) {
        return { allowed: false, error: 'No tienes acceso a este canal privado', status: 403 };
      }
    }
    return { allowed: true };
  }

  if (conversationId) {
    const conv = db.conversations.find(c => c.id === conversationId);
    if (!conv) {
      return { allowed: false, error: 'Conversación no encontrada', status: 404 };
    }
    if (!conv.memberIds.includes(userId)) {
      return { allowed: false, error: 'No tienes acceso a esta conversación', status: 403 };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

// 1. Get messages with Cursor Pagination (Section 38-41)
messagesRouter.get('/', authenticate, requirePermission('messages.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;
  const { channelId, conversationId, parentMessageId, cursor, limit = 50, direction = 'before' } = req.query;

  const access = checkAccess(req, channelId as string, conversationId as string);
  if (!access.allowed) {
    return res.status(access.status || 403).json({ success: false, message: access.error });
  }

  let filtered = db.messages.filter(m => {
    if (m.isDeleted) return false;
    if (conversationId) return m.conversationId === conversationId;
    if (channelId) return m.channelId === channelId && m.tenantId === tenantId;
    return m.tenantId === tenantId;
  });

  if (parentMessageId) {
    filtered = filtered.filter(m => m.parentMessageId === parentMessageId || m.threadRootMessageId === parentMessageId);
  } else {
    // Only top-level messages
    filtered = filtered.filter(m => !m.parentMessageId);

    if (channelId) {
      filtered = filtered.filter(m => m.channelId === channelId);
    } else if (conversationId) {
      filtered = filtered.filter(m => m.conversationId === conversationId);
    }
  }

  // Chronological sorting (ascending)
  filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Cursor pagination logic
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  let resultMessages: Message[] = [];
  let hasMore = false;

  if (cursor) {
    const cursorIndex = filtered.findIndex(m => m.id === cursor);
    if (cursorIndex !== -1) {
      if (direction === 'after') {
        resultMessages = filtered.slice(cursorIndex + 1, cursorIndex + 1 + pageSize);
        hasMore = cursorIndex + 1 + pageSize < filtered.length;
      } else {
        // before
        const start = Math.max(0, cursorIndex - pageSize);
        resultMessages = filtered.slice(start, cursorIndex);
        hasMore = start > 0;
      }
    } else {
      resultMessages = filtered.slice(-pageSize);
      hasMore = filtered.length > pageSize;
    }
  } else {
    // Default: latest page (tail of array)
    resultMessages = filtered.slice(-pageSize);
    hasMore = filtered.length > pageSize;
  }

  // Populate isSaved for requesting user
  const userSavedMessageIds = new Set(
    db.savedMessages.filter(s => s.userId === userId).map(s => s.messageId)
  );

  const decorated = resultMessages.map(m => ({
    ...m,
    isSaved: userSavedMessageIds.has(m.id)
  }));

  const nextCursor = decorated.length > 0 ? decorated[decorated.length - 1].id : null;
  const prevCursor = decorated.length > 0 ? decorated[0].id : null;

  res.json({
    success: true,
    data: decorated,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
      total: filtered.length
    }
  });
});

// 2. Saved messages endpoint (Section 55-57)
messagesRouter.get('/saved', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  const userSaved = db.savedMessages.filter(s => s.userId === userId);
  const result = userSaved.map(s => {
    const msg = db.messages.find(m => m.id === s.messageId && m.tenantId === tenantId);
    return {
      ...s,
      message: msg || null
    };
  }).filter(s => s.message !== null && !s.message?.isDeleted);

  res.json({ success: true, data: result });
});

// 3. Search messages (Section 62-65)
messagesRouter.get('/search', authenticate, requirePermission('messages.read'), (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;
  const { q, channelId, conversationId, senderId, hasAttachments } = req.query;

  if (!q && !hasAttachments && !senderId) {
    return res.status(400).json({ success: false, message: 'Se requiere un término de búsqueda o filtro' });
  }

  let candidates = db.messages.filter(m => m.tenantId === tenantId && !m.isDeleted);

  if (channelId) {
    const access = checkAccess(req, channelId as string);
    if (!access.allowed) return res.status(403).json({ success: false, message: access.error });
    candidates = candidates.filter(m => m.channelId === channelId);
  } else if (conversationId) {
    const access = checkAccess(req, undefined, conversationId as string);
    if (!access.allowed) return res.status(403).json({ success: false, message: access.error });
    candidates = candidates.filter(m => m.conversationId === conversationId);
  }

  if (senderId) {
    candidates = candidates.filter(m => m.senderId === senderId);
  }

  if (hasAttachments === 'true') {
    candidates = candidates.filter(m => m.attachments && m.attachments.length > 0);
  }

  if (q) {
    const term = String(q).toLowerCase();
    candidates = candidates.filter(m =>
      m.content.toLowerCase().includes(term) ||
      m.senderName.toLowerCase().includes(term) ||
      m.attachments?.some(a => a.name.toLowerCase().includes(term))
    );
  }

  // Sort descending by relevance/date
  candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ success: true, data: candidates.slice(0, 50), total: candidates.length });
});

// 4. Thread root and replies (Section 48-51)
messagesRouter.get('/:id/thread', authenticate, requirePermission('messages.read'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  const rootMessage = db.messages.find(m => m.id === id && m.tenantId === tenantId && !m.isDeleted);
  if (!rootMessage) {
    return res.status(404).json({ success: false, message: 'Mensaje raíz no encontrado' });
  }

  const access = checkAccess(req, rootMessage.channelId, rootMessage.conversationId);
  if (!access.allowed) {
    return res.status(access.status || 403).json({ success: false, message: access.error });
  }

  const replies = db.messages
    .filter(m => (m.parentMessageId === id || m.threadRootMessageId === id) && m.tenantId === tenantId && !m.isDeleted)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({
    success: true,
    data: {
      rootMessage,
      replies,
      repliesCount: replies.length
    }
  });
});

// 5. Message edit history (Section 44)
messagesRouter.get('/:id/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const history = db.messageEdits.filter(e => e.messageId === id).sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime());
  res.json({ success: true, data: history });
});

// 6. Post message (with idempotency, thread support, mentions, and outbox)
messagesRouter.post('/', authenticate, requirePermission('messages.create'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const user = req.user!;
  const {
    channelId,
    conversationId,
    parentMessageId,
    content,
    attachments = [],
    clientMessageId
  } = req.body;

  // Idempotency check (Section 42)
  if (clientMessageId && processedClientMessageIds.has(clientMessageId)) {
    const existing = db.messages.find(m => m.id === processedClientMessageIds.get(clientMessageId)!.messageId);
    if (existing) {
      return res.status(200).json({ success: true, data: existing, duplicate: true });
    }
  }

  if (!channelId && !conversationId) {
    return res.status(400).json({ success: false, message: 'Se requiere un canal o conversación de destino para enviar el mensaje', code: 'TARGET_REQUIRED' });
  }

  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ success: false, message: 'El contenido del mensaje no puede estar vacío', code: 'EMPTY_CONTENT' });
  }

  const access = checkAccess(req, channelId, conversationId);
  if (!access.allowed) {
    return res.status(access.status || 403).json({ success: false, message: access.error });
  }

  // If channel is archived, prevent sending messages
  if (channelId) {
    const ch = db.channels.find(c => c.id === channelId);
    if (ch?.isArchived && req.member?.role !== 'Owner' && req.member?.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Este canal está archivado y es de solo lectura', code: 'CHANNEL_ARCHIVED' });
    }
  }

  const cleanContent = sanitizeText(content || '');

  // Determine thread root if replying
  let rootId = parentMessageId;
  let parentMsg: Message | undefined;
  if (parentMessageId) {
    parentMsg = db.messages.find(m => m.id === parentMessageId && m.tenantId === tenantId && !m.isDeleted);
    if (!parentMsg) {
      return res.status(404).json({ success: false, message: 'El mensaje al que respondes ya no existe' });
    }
    rootId = parentMsg.threadRootMessageId || parentMsg.id;
  }

  const workspaceId = req.workspace?.id || db.workspaces[0]?.id || '';

  const newMessage: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId,
    workspaceId,
    channelId,
    conversationId,
    parentMessageId,
    threadRootMessageId: rootId,
    senderId: user.id,
    senderName: user.displayName || `${user.firstName} ${user.lastName}`,
    senderAvatar: user.avatarUrl,
    content: cleanContent,
    messageType: (attachments.length > 0 && !content ? 'file' : 'text') as 'text' | 'file',
    isEdited: false,
    isDeleted: false,
    isPinned: false,
    reactions: [],
    attachments: attachments || [],
    repliesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.messages.push(newMessage);
  await db.persistMessage(newMessage);

  if (clientMessageId) {
    processedClientMessageIds.set(clientMessageId, { messageId: newMessage.id, timestamp: Date.now() });
  }

  // Update root message thread stats
  if (rootId) {
    const root = db.messages.find(m => m.id === rootId);
    if (root) {
      root.repliesCount = (root.repliesCount || 0) + 1;
      root.lastReplyAt = newMessage.createdAt;
      realtimeHub.broadcastToWorkspace(req.workspace!.id, 'MessageUpdated', root);
    }
  }

  // Update conversation last message if direct conversation
  if (conversationId) {
    const conv = db.conversations.find(c => c.id === conversationId && c.tenantId === tenantId);
    if (conv) {
      conv.lastMessage = cleanContent || 'Archivo adjunto';
      conv.lastMessageAt = newMessage.createdAt;
      conv.updatedAt = new Date().toISOString();
      realtimeHub.broadcastToConversation(conversationId, 'ConversationUpdated', conv);
    }
  }

  // Section 99: Mention Parsing & Notification Dispatch
  const mentionResult = db.parseMentions(cleanContent, tenantId);
  const usersToNotify = new Set<string>();

  mentionResult.users.forEach(u => {
    if (u.id !== user.id) usersToNotify.add(u.id);
  });

  if (mentionResult.isChannelMention || mentionResult.isHereMention) {
    if (channelId) {
      const channelMems = db.channelMembers.filter(m => m.channelId === channelId);
      channelMems.forEach(m => {
        if (m.userId !== user.id) usersToNotify.add(m.userId);
      });
    }
  }

  usersToNotify.forEach(targetUserId => {
    const notif = {
      id: `notif-${Date.now()}-${targetUserId}`,
      tenantId,
      userId: targetUserId,
      type: 'Mention' as const,
      title: `Mención de ${user.displayName || user.firstName}`,
      message: `${user.displayName || user.firstName} te mencionó: "${cleanContent.substring(0, 60)}..."`,
      linkUrl: channelId ? `/channel/${channelId}` : `/dm/${conversationId}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.unshift(notif);
    realtimeHub.sendToUser(targetUserId, 'NotificationCreated', notif);
  });

  // Section 93: Enqueue Outbox event for guaranteed delivery
  db.enqueueOutbox(parentMessageId ? 'ThreadReplyCreated' : 'MessageCreated', {
    message: newMessage,
    channelId,
    conversationId
  });

  // SignalR Event Broadcasting (Section 121) - Guaranteed dual delivery
  const eventName = parentMessageId ? 'ThreadReplyCreated' : 'MessageCreated';
  if (channelId) {
    realtimeHub.broadcastToChannel(channelId, eventName, newMessage);
    realtimeHub.broadcastToWorkspace(req.workspace!.id, eventName, newMessage);
    if (parentMessageId) {
      realtimeHub.broadcastToChannel(channelId, 'MessageCreated', newMessage);
    }
  } else if (conversationId) {
    // Broadcast to conversation group
    realtimeHub.broadcastToConversation(conversationId, eventName, newMessage);
    if (parentMessageId) {
      realtimeHub.broadcastToConversation(conversationId, 'MessageCreated', newMessage);
    }
    // Also deliver directly to each conversation member's universal user group
    const conv = db.conversations.find(c => c.id === conversationId);
    if (conv && conv.memberIds) {
      for (const memberId of conv.memberIds) {
        realtimeHub.sendToUser(memberId, eventName, newMessage);
        if (parentMessageId) {
          realtimeHub.sendToUser(memberId, 'MessageCreated', newMessage);
        }
      }
    }
  }

  res.status(201).json({ success: true, data: newMessage });
});

// 7. Edit message with version audit trail (Section 44)
messagesRouter.put('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado o eliminado', code: 'NOT_FOUND' });
  }

  const isAuthor = msg.senderId === user.id;
  const isOwnerOrAdmin = req.member?.role === 'Owner' || req.member?.role === 'Admin';
  if (!isAuthor && !isOwnerOrAdmin) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para editar este mensaje', code: 'FORBIDDEN' });
  }

  const previousContent = msg.content;
  const cleanContent = sanitizeText(content || '');

  // Record audit history
  const editRecord: MessageEditHistory = {
    id: `edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    messageId: msg.id,
    previousContent,
    editedBy: user.id,
    editedAt: new Date().toISOString()
  };
  db.messageEdits.unshift(editRecord);

  msg.content = cleanContent;
  msg.isEdited = true;
  msg.editedAt = new Date().toISOString();
  msg.updatedAt = new Date().toISOString();

  await db.persistMessageUpdate(msg);

  db.enqueueOutbox('MessageUpdated', { message: msg, editRecord });

  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  realtimeHub.broadcastToGroup(targetGroup, 'MessageUpdated', msg);
  realtimeHub.broadcastToWorkspace(req.workspace!.id, 'MessageUpdated', msg);

  res.json({ success: true, data: msg });
});

// 8. Soft delete message (Section 45)
messagesRouter.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  const isAuthor = msg.senderId === user.id;
  const canDelete = isAuthor || req.member?.role === 'Owner' || req.member?.role === 'Admin' || req.permissions?.includes('messages.delete');
  if (!canDelete) {
    return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este mensaje', code: 'FORBIDDEN' });
  }

  msg.isDeleted = true;
  msg.deletedAt = new Date().toISOString();
  msg.content = 'Este mensaje fue eliminado.';
  msg.attachments = [];
  msg.updatedAt = new Date().toISOString();

  await db.persistMessageSoftDelete(id);

  // If this message was pinned, unpin it
  if (msg.isPinned) {
    msg.isPinned = false;
    const pinIdx = db.pinnedMessages.findIndex(p => p.messageId === id);
    if (pinIdx !== -1) db.pinnedMessages.splice(pinIdx, 1);
  }

  db.enqueueOutbox('MessageDeleted', { messageId: id, channelId: msg.channelId, conversationId: msg.conversationId });

  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  realtimeHub.broadcastToGroup(targetGroup, 'MessageDeleted', { messageId: id, channelId: msg.channelId, conversationId: msg.conversationId });

  res.json({ success: true, message: 'Mensaje eliminado' });
});

// 9. Add or Toggle Reaction (Section 46-47)
messagesRouter.post('/:id/reactions', authenticate, requirePermission('reactions.add'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { emoji } = req.body;
  const user = req.user!;
  const tenantId = user.tenantId;

  if (!emoji) {
    return res.status(400).json({ success: false, message: 'Emoji requerido' });
  }

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  if (!msg.reactions) msg.reactions = [];

  const existingIdx = msg.reactions.findIndex(r => r.messageId === id && r.userId === user.id && r.emoji === emoji);

  let action: 'added' | 'removed' = 'added';
  let createdReaction: MessageReaction | null = null;
  if (existingIdx !== -1) {
    // Toggle off
    msg.reactions.splice(existingIdx, 1);
    action = 'removed';
    await db.removeReaction(id, user.id, emoji);
  } else {
    // Add reaction
    const newReaction: MessageReaction = {
      id: `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      messageId: id,
      userId: user.id,
      userName: user.displayName || user.firstName,
      emoji,
      createdAt: new Date().toISOString()
    };
    createdReaction = newReaction;
    msg.reactions.push(newReaction);
    await db.persistReaction(newReaction);
  }

  msg.updatedAt = new Date().toISOString();

  const eventName = action === 'added' ? 'ReactionAdded' : 'ReactionRemoved';
  const altEventName = action === 'added' ? 'MessageReactionAdded' : 'MessageReactionRemoved';
  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  
  const rxPayload = { messageId: id, emoji, userId: user.id, reaction: createdReaction, reactions: msg.reactions };
  realtimeHub.broadcastToGroup(targetGroup, eventName, rxPayload);
  realtimeHub.broadcastToGroup(targetGroup, altEventName, rxPayload);

  if (msg.conversationId) {
    const conv = db.conversations.find(c => c.id === msg.conversationId);
    if (conv && conv.memberIds) {
      for (const memberId of conv.memberIds) {
        realtimeHub.sendToUser(memberId, eventName, rxPayload);
        realtimeHub.sendToUser(memberId, altEventName, rxPayload);
      }
    }
  }

  res.json({
    success: true,
    action,
    data: createdReaction ? { ...createdReaction, reactions: msg.reactions } : { emoji, reactions: msg.reactions },
    reaction: createdReaction,
    reactions: msg.reactions
  });
});

// 10. Pin / Unpin message (Section 52-54)
messagesRouter.post('/:id/pin', authenticate, requirePermission('messages.pin'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  const channelId = msg.channelId;
  if (!channelId) {
    return res.status(400).json({ success: false, message: 'Solo se pueden anclar mensajes en canales' });
  }

  // Maximum pins limit per channel (e.g. 50)
  const channelPins = db.pinnedMessages.filter(p => p.channelId === channelId);
  if (channelPins.length >= 50 && !msg.isPinned) {
    return res.status(400).json({ success: false, message: 'Límite de mensajes anclados alcanzado (50)' });
  }

  msg.isPinned = !msg.isPinned;
  msg.updatedAt = new Date().toISOString();

  if (msg.isPinned) {
    const pin: PinnedMessage = {
      id: `pin-${Date.now()}`,
      messageId: id,
      channelId,
      pinnedBy: user.id,
      pinnedAt: new Date().toISOString()
    };
    db.pinnedMessages.push(pin);
    realtimeHub.broadcastToChannel(channelId, 'MessagePinned', { messageId: id, isPinned: true, pin });
  } else {
    const idx = db.pinnedMessages.findIndex(p => p.messageId === id);
    if (idx !== -1) db.pinnedMessages.splice(idx, 1);
    realtimeHub.broadcastToChannel(channelId, 'MessageUnpinned', { messageId: id, isPinned: false });
  }

  res.json({ success: true, isPinned: msg.isPinned, data: msg });
});

// 11. Save / Bookmark Message (Section 55-57)
messagesRouter.post('/:id/save', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { note } = req.body;
  const userId = req.user!.id;

  const msg = db.messages.find(m => m.id === id && m.tenantId === req.user!.tenantId && !m.isDeleted);
  if (!msg) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  const existingIdx = db.savedMessages.findIndex(s => s.messageId === id && s.userId === userId);
  if (existingIdx !== -1) {
    // Toggle off: unsave
    db.savedMessages.splice(existingIdx, 1);
    return res.json({ success: true, isSaved: false, message: 'Mensaje removido de guardados' });
  }

  const saved: SavedMessage = {
    id: `saved-${Date.now()}-${userId}`,
    userId,
    messageId: id,
    note: note ? sanitizeText(note) : undefined,
    createdAt: new Date().toISOString()
  };
  db.savedMessages.push(saved);

  res.json({ success: true, isSaved: true, data: saved });
});

// Delete saved message
messagesRouter.delete('/:id/save', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const idx = db.savedMessages.findIndex(s => s.messageId === id && s.userId === userId);
  if (idx !== -1) {
    db.savedMessages.splice(idx, 1);
  }

  res.json({ success: true, isSaved: false });
});

// 12. Typing indicator (Section 66-68)
messagesRouter.post('/typing', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { channelId, conversationId, isTyping } = req.body;
  const user = req.user!;
  const targetId = channelId || conversationId;

  if (targetId) {
    realtimeHub.handleTyping(
      user.id,
      user.displayName || user.firstName,
      targetId,
      !!channelId,
      !!isTyping,
      user.tenantId
    );
  }

  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// FASE 6: IN-CALL CHAT & MESSAGING — NEW ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// 13. Mark message as delivered (per-user delivery receipt)
messagesRouter.post('/:id/delivered', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  await db.persistMessageDelivered(id, user.id);

  // Notify the original sender and all conversation members via realtime
  const deliveredPayload = { messageId: id, userId: user.id, deliveredAt: new Date().toISOString() };
  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  realtimeHub.broadcastToGroup(targetGroup, 'MessageDelivered', deliveredPayload);
  if (msg.senderId !== user.id) {
    realtimeHub.sendToUser(msg.senderId, 'MessageDelivered', deliveredPayload);
  }

  res.json({ success: true, data: deliveredPayload });
});

// 14. Mark message as read (per-user read receipt)
messagesRouter.post('/:id/read', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  await db.persistMessageRead(id, user.id);

  // Notify the original sender that the message was read
  const readPayload = { messageId: id, userId: user.id, readAt: new Date().toISOString() };
  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  realtimeHub.broadcastToGroup(targetGroup, 'MessageRead', readPayload);
  if (msg.senderId !== user.id) {
    realtimeHub.sendToUser(msg.senderId, 'MessageRead', readPayload);
  }

  res.json({ success: true, data: readPayload });
});

// 15. Remove a specific reaction from a message (idempotent)
messagesRouter.delete('/:id/reactions/:reaction', authenticate, requirePermission('reactions.remove'), async (req: AuthenticatedRequest, res: Response) => {
  const { id, reaction: emoji } = req.params;
  const user = req.user!;
  const tenantId = user.tenantId;

  const msg = db.messages.find(m => m.id === id && m.tenantId === tenantId);
  if (!msg || msg.isDeleted) {
    return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
  }

  if (!msg.reactions) msg.reactions = [];
  const existingIdx = msg.reactions.findIndex(r => r.messageId === id && r.userId === user.id && r.emoji === emoji);

  if (existingIdx !== -1) {
    msg.reactions.splice(existingIdx, 1);
    await db.removeReaction(id, user.id, emoji);
  }
  // Idempotent: if reaction didn't exist, still return 200

  const rxPayload = { messageId: id, emoji, userId: user.id, reactions: msg.reactions };
  const targetGroup = msg.channelId ? `channel:${msg.channelId}` : `conversation:${msg.conversationId}`;
  realtimeHub.broadcastToGroup(targetGroup, 'ReactionRemoved', rxPayload);
  realtimeHub.broadcastToGroup(targetGroup, 'MessageReactionRemoved', rxPayload);

  if (msg.conversationId) {
    const conv = db.conversations.find(c => c.id === msg.conversationId);
    if (conv?.memberIds) {
      for (const memberId of conv.memberIds) {
        realtimeHub.sendToUser(memberId, 'ReactionRemoved', rxPayload);
      }
    }
  }

  res.json({ success: true, data: msg.reactions });
});
