import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';
import { Conversation } from '../../src/types';

export const conversationsRouter = Router();

// List direct conversations for authenticated user across organizations
conversationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;

  const userConversations = db.conversations
    .filter(c => c.memberIds && c.memberIds.includes(userId))
    .map(c => {
      let displayName = c.name;
      let displayAvatar = c.avatarUrl;
      let otherUser = null;

      if (!c.isGroup) {
        const otherId = c.memberIds.find(id => id !== userId);
        otherUser = db.users.find(u => u.id === otherId);
        if (otherUser) {
          displayName = otherUser.displayName || `${otherUser.firstName} ${otherUser.lastName}`.trim() || otherUser.userName;
          displayAvatar = otherUser.avatarUrl;
        }
      }

      return {
        ...c,
        displayName: displayName || 'Conversación',
        displayAvatar: displayAvatar || '',
        otherUser: otherUser ? {
          id: otherUser.id,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl,
          jobTitle: otherUser.jobTitle,
          status: otherUser.status,
          customStatus: otherUser.customStatus,
          lastSeenAt: otherUser.lastSeenAt
        } : null
      };
    });

  // Sort by latest message date descending
  userConversations.sort((a, b) => {
    const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdAt).getTime();
    const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdAt).getTime();
    return tB - tA;
  });

  res.json({ success: true, data: userConversations });
});

// Create or get 1:1 or group conversation (Supports cross-organization collaborators)
conversationsRouter.post('/', authenticate, requirePermission('dms.create'), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;
  const workspaceId = req.workspace?.id || (req.user as any)?.workspaceId || db.workspaces[0]?.id || '';
  const { targetUserId, memberIds, isGroup, type, name } = req.body;
  const isDirect = !isGroup && type !== 'group';
  const resolvedTargetUserId = targetUserId || (Array.isArray(memberIds) ? memberIds.find((id: string) => id !== userId) : undefined);

  if (isDirect && resolvedTargetUserId) {
    if (resolvedTargetUserId === userId) {
      return res.status(400).json({ success: false, message: 'No puedes iniciar un chat directo contigo mismo', code: 'INVALID_TARGET' });
    }

    // Cross-organization user lookup: target must be an active collaborator anywhere in Nexora
    const targetUser = db.users.find(u => u.id === resolvedTargetUserId && ((u.accountStatus || '').toUpperCase() === 'ACTIVE' || u.accountStatus === 'Active'));
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuario destinatario no encontrado o inactivo', code: 'USER_NOT_FOUND' });
    }

    // Check if 1:1 already exists (irrespective of tenantId)
    const existing = db.conversations.find(c =>
      !c.isGroup &&
      c.memberIds.length === 2 &&
      c.memberIds.includes(userId) &&
      c.memberIds.includes(resolvedTargetUserId)
    );

    if (existing) {
      return res.json({
        success: true,
        data: {
          ...existing,
          displayName: targetUser.displayName || `${targetUser.firstName} ${targetUser.lastName}`,
          displayAvatar: targetUser.avatarUrl || '',
          otherUser: {
            id: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            displayName: targetUser.displayName,
            avatarUrl: targetUser.avatarUrl,
            jobTitle: targetUser.jobTitle,
            status: targetUser.status
          }
        },
        created: false
      });
    }

    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      tenantId,
      workspaceId,
      isGroup: false,
      memberIds: [userId, resolvedTargetUserId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unreadCount: 0
    };
    db.conversations.push(newConv);
    await db.persistConversation(newConv);

    db.enqueueOutbox('ConversationCreated', { conversation: newConv });
    realtimeHub.sendToUser(resolvedTargetUserId, 'ConversationCreated', newConv);
    realtimeHub.sendToUser(userId, 'ConversationCreated', newConv);

    return res.status(201).json({
      success: true,
      data: {
        ...newConv,
        displayName: targetUser.displayName || `${targetUser.firstName} ${targetUser.lastName}`,
        displayAvatar: targetUser.avatarUrl || '',
        otherUser: {
          id: targetUser.id,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName,
          displayName: targetUser.displayName,
          avatarUrl: targetUser.avatarUrl,
          jobTitle: targetUser.jobTitle,
          status: targetUser.status
        }
      },
      created: true
    });
  }

  // Group conversation
  const allMembers = Array.from(new Set([userId, ...(memberIds || [])]));
  if (allMembers.length < 2) {
    return res.status(400).json({ success: false, message: 'Un grupo requiere al menos 2 miembros' });
  }

  const newGroup: Conversation = {
    id: `conv-grp-${Date.now()}`,
    tenantId,
    workspaceId,
    isGroup: true,
    name: sanitizeText(name || 'Nuevo Grupo'),
    avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80',
    memberIds: allMembers,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unreadCount: 0
  };

  db.conversations.push(newGroup);
  await db.persistConversation(newGroup);

  db.enqueueOutbox('ConversationCreated', { conversation: newGroup });
  allMembers.forEach(mId => {
    if (mId !== userId) {
      realtimeHub.sendToUser(mId, 'ConversationCreated', newGroup);
    }
  });

  res.status(201).json({ success: true, data: newGroup, created: true });
});

// Mark conversation read
conversationsRouter.post('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const conv = db.conversations.find(c => c.id === id && c.memberIds.includes(userId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  conv.unreadCount = 0;
  realtimeHub.sendToUser(userId, 'ReadStateUpdated', {
    conversationId: id,
    unreadCount: 0
  });

  res.json({ success: true });
});

// Add member to group conversation
conversationsRouter.post('/:id/members', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const callerId = req.user!.id;
  const workspaceId = req.workspace?.id || db.workspaces[0]?.id || '';
  const { userId: newUserId, userIds } = req.body;

  const conv = db.conversations.find(c => c.id === id && c.memberIds.includes(callerId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  const toAdd = Array.from(new Set(userIds || (newUserId ? [newUserId] : []))).filter(
    uid => typeof uid === 'string' && !conv.memberIds.includes(uid)
  ) as string[];

  if (toAdd.length === 0) {
    return res.status(400).json({ success: false, message: 'No se especificaron usuarios válidos o ya son miembros' });
  }

  // If was a 1:1, escalate to group
  if (!conv.isGroup) {
    conv.isGroup = true;
    conv.name = conv.name || 'Grupo';
    await db.updateConversation(conv.id, { name: conv.name });
  }

  for (const mId of toAdd) {
    conv.memberIds.push(mId);
    await db.persistConversationMember(conv.id, mId, workspaceId);
  }

  db.enqueueOutbox('ConversationUpdated', { conversation: conv });
  conv.memberIds.forEach(mId => {
    realtimeHub.sendToUser(mId, 'ConversationUpdated', conv);
  });

  res.json({ success: true, data: conv });
});

// Remove member from group conversation
conversationsRouter.delete('/:id/members/:userId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id, userId: targetUserId } = req.params;
  const tenantId = req.user!.tenantId;
  const callerId = req.user!.id;

  const conv = db.conversations.find(c => c.id === id && c.memberIds.includes(callerId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  if (!conv.isGroup) {
    return res.status(400).json({ success: false, message: 'No se pueden remover miembros de una conversación 1:1 directa' });
  }

  if (!conv.memberIds.includes(targetUserId)) {
    return res.status(400).json({ success: false, message: 'El usuario no pertenece al grupo' });
  }

  conv.memberIds = conv.memberIds.filter(m => m !== targetUserId);
  await db.removeConversationMember(conv.id, targetUserId);

  realtimeHub.sendToUser(targetUserId, 'ConversationRemoved', { conversationId: id });
  conv.memberIds.forEach(mId => {
    realtimeHub.sendToUser(mId, 'ConversationUpdated', conv);
  });

  res.json({ success: true, message: 'Miembro removido exitosamente', data: conv });
});

// Leave group conversation
conversationsRouter.post('/:id/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const callerId = req.user!.id;

  const conv = db.conversations.find(c => c.id === id && c.memberIds.includes(callerId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  conv.memberIds = conv.memberIds.filter(m => m !== callerId);
  await db.removeConversationMember(conv.id, callerId);

  if (conv.memberIds.length === 0) {
    await db.deleteConversation(conv.id);
  } else {
    conv.memberIds.forEach(mId => {
      realtimeHub.sendToUser(mId, 'ConversationUpdated', conv);
    });
  }

  realtimeHub.sendToUser(callerId, 'ConversationRemoved', { conversationId: id });
  res.json({ success: true, message: 'Has salido de la conversación' });
});

// Rename group conversation
conversationsRouter.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const callerId = req.user!.id;
  const { name } = req.body;

  const conv = db.conversations.find(c => c.id === id && c.memberIds.includes(callerId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  if (name !== undefined) {
    conv.name = sanitizeText(name);
    conv.updatedAt = new Date().toISOString();
    await db.updateConversation(conv.id, { name: conv.name });
  }

  conv.memberIds.forEach(mId => {
    realtimeHub.sendToUser(mId, 'ConversationUpdated', conv);
  });

  res.json({ success: true, data: conv });
});

// Hide conversation for caller
conversationsRouter.post('/:id/hide', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const callerId = req.user!.id;

  realtimeHub.sendToUser(callerId, 'ConversationRemoved', { conversationId: id });
  res.json({ success: true, message: 'Conversación oculta' });
});

// Delete conversation completely
conversationsRouter.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const callerId = req.user!.id;

  const conv = db.conversations.find(c => c.id === id && c.tenantId === tenantId && c.memberIds.includes(callerId));
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }

  const memberIds = [...conv.memberIds];
  await db.deleteConversation(conv.id);

  memberIds.forEach(mId => {
    realtimeHub.sendToUser(mId, 'ConversationRemoved', { conversationId: id });
  });

  res.json({ success: true, message: 'Conversación eliminada definitivamente' });
});

// ─────────────────────────────────────────────────────────────────────────────
// FASE 6: IN-CALL CHAT & MESSAGING — NEW CONVERSATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// Get single conversation with members and metadata
conversationsRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  const conv = db.conversations.find(c => c.id === id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }
  if (!conv.memberIds.includes(userId)) {
    return res.status(403).json({ success: false, message: 'No tienes acceso a esta conversación' });
  }

  const members = conv.memberIds.map(mId => {
    const u = db.users.find(u => u.id === mId);
    return u ? {
      id: u.id,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      status: u.status,
      jobTitle: u.jobTitle
    } : { id: mId, displayName: 'Colaborador', avatarUrl: '', status: 'Offline' };
  });

  res.json({ success: true, data: { ...conv, members } });
});

// Get messages for a specific conversation (cursor-paginated)
conversationsRouter.get('/:id/messages', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;
  const { cursor, limit = 50, direction = 'before' } = req.query;

  const conv = db.conversations.find(c => c.id === id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }
  if (!conv.memberIds.includes(userId)) {
    return res.status(403).json({ success: false, message: 'No tienes acceso a esta conversación' });
  }

  let filtered = db.messages
    .filter(m => m.conversationId === id && !m.parentMessageId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  let resultMessages: typeof filtered = [];
  let hasMore = false;

  if (cursor) {
    const cursorIndex = filtered.findIndex(m => m.id === cursor);
    if (cursorIndex !== -1) {
      if (direction === 'after') {
        resultMessages = filtered.slice(cursorIndex + 1, cursorIndex + 1 + pageSize);
        hasMore = cursorIndex + 1 + pageSize < filtered.length;
      } else {
        const start = Math.max(0, cursorIndex - pageSize);
        resultMessages = filtered.slice(start, cursorIndex);
        hasMore = start > 0;
      }
    } else {
      resultMessages = filtered.slice(-pageSize);
      hasMore = filtered.length > pageSize;
    }
  } else {
    resultMessages = filtered.slice(-pageSize);
    hasMore = filtered.length > pageSize;
  }

  const nextCursor = resultMessages.length > 0 ? resultMessages[resultMessages.length - 1].id : null;
  const prevCursor = resultMessages.length > 0 ? resultMessages[0].id : null;

  res.json({
    success: true,
    data: resultMessages,
    pagination: { nextCursor, prevCursor, hasMore, total: filtered.length }
  });
});

// Send message directly in a conversation (shortcut endpoint for in-call chat)
conversationsRouter.post('/:id/messages', authenticate, requirePermission('messages.create'), async (req: AuthenticatedRequest, res: Response) => {
  const { id: conversationId } = req.params;
  const tenantId = req.user!.tenantId;
  const user = req.user!;
  const { content, attachments = [], clientMessageId, parentMessageId } = req.body;

  const conv = db.conversations.find(c => c.id === conversationId);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
  }
  if (!conv.memberIds.includes(user.id)) {
    return res.status(403).json({ success: false, message: 'No eres miembro de esta conversación' });
  }

  if (!content && (!attachments || attachments.length === 0)) {
    return res.status(400).json({ success: false, message: 'El contenido del mensaje no puede estar vacío' });
  }

  // DB-level & in-memory idempotency check
  if (clientMessageId) {
    const existingMem = db.messages.find(m => (m as any).clientMessageId === clientMessageId);
    if (existingMem) {
      return res.status(200).json({ success: true, data: existingMem, duplicate: true });
    }
    const existingId = await db.findMessageByClientId(clientMessageId, tenantId);
    if (existingId) {
      const existing = db.messages.find(m => m.id === existingId);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }
  }

  const workspaceId = req.workspace?.id || conv.workspaceId || db.workspaces[0]?.id || '';
  const cleanContent = sanitizeText(content || '');

  const newMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId,
    workspaceId,
    conversationId,
    channelId: undefined as string | undefined,
    parentMessageId: parentMessageId || undefined,
    threadRootMessageId: parentMessageId || undefined,
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
    clientMessageId: clientMessageId || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.messages.push(newMessage as any);
  await db.persistMessage(newMessage as any, clientMessageId);

  // Update conversation last-message meta
  (conv as any).lastMessage = cleanContent || 'Archivo adjunto';
  (conv as any).lastMessageAt = newMessage.createdAt;
  conv.updatedAt = new Date().toISOString();

  // Broadcast to conversation group and each member
  realtimeHub.broadcastToConversation(conversationId, 'MessageCreated', newMessage);
  for (const memberId of conv.memberIds) {
    realtimeHub.sendToUser(memberId, 'MessageCreated', newMessage);
  }
  realtimeHub.broadcastToConversation(conversationId, 'ConversationUpdated', conv);

  res.status(201).json({ success: true, data: newMessage });
});
