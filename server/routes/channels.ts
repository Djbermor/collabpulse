import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';
import { Channel, ChannelMember } from '../../src/types';

export const channelsRouter = Router();

// Normalization helper (Section 14)
function normalizeChannelName(raw: string): string {
  return sanitizeText(raw)
    .toLowerCase()
    .trim()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// List channels accessible to user in active workspace (Sections 18-19)
channelsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  const channels = db.channels
    .filter(c => c.workspaceId === workspaceId && c.tenantId === tenantId && !c.deletedAt)
    .filter(c => {
      if (!c.isPrivate) return true;
      // Private channel: only explicit members can see, search, read
      return db.channelMembers.some(m => m.channelId === c.id && m.userId === userId);
    })
    .map(c => {
      const membership = db.channelMembers.find(m => m.channelId === c.id && m.userId === userId);
      const isMember = !!membership;
      return {
        ...c,
        isMember,
        isMuted: membership?.isMuted || false,
        notificationLevel: membership?.notificationLevel || 'all',
        lastReadMessageId: membership?.lastReadMessageId
      };
    });

  res.json({ success: true, data: channels });
});

// Create channel with normalization and UNIQUE(workspace_id, normalized_name) (Sections 14-17)
channelsRouter.post('/', authenticate, requirePermission('channels.create'), async (req: AuthenticatedRequest, res: Response) => {
  const { name, description, topic, type, isPrivate } = req.body;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;
  const userId = req.user!.id;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'El nombre del canal es requerido', code: 'INVALID_NAME' });
  }

  const cleanName = normalizeChannelName(name);
  if (!cleanName) {
    return res.status(400).json({ success: false, message: 'Nombre de canal no válido después de normalización', code: 'INVALID_NAME' });
  }

  // Section 15: UNIQUE(workspace_id, normalized_name)
  const existing = db.channels.find(c =>
    c.workspaceId === workspaceId &&
    (c.normalizedName === cleanName || c.name === cleanName) &&
    !c.deletedAt
  );
  if (existing) {
    return res.status(400).json({ success: false, message: `Ya existe el canal #${cleanName} en este workspace`, code: 'CHANNEL_EXISTS' });
  }

  const channelType: 'public' | 'private' = (type === 'private' || isPrivate === true) ? 'private' : 'public';
  const isPrivateChannel = channelType === 'private';

  const newChannel: Channel = {
    id: `ch-${Date.now()}`,
    tenantId,
    workspaceId,
    name: cleanName,
    normalizedName: cleanName,
    description: sanitizeText(description || ''),
    topic: sanitizeText(topic || ''),
    type: channelType,
    isPrivate: isPrivateChannel,
    isArchived: false,
    isPinned: false,
    isMuted: false,
    notificationLevel: 'all',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    membersCount: 1,
    unreadCount: 0
  };

  db.channels.push(newChannel);
  await db.persistChannel(newChannel);

  // Add creator as member
  const creatorMember: ChannelMember = {
    id: `cm-${Date.now()}-${userId}`,
    channelId: newChannel.id,
    userId,
    role: req.member?.role || 'Owner',
    joinedAt: new Date().toISOString(),
    isMuted: false,
    notificationLevel: 'all'
  };
  db.channelMembers.push(creatorMember);

  // If public channel, add active workspace members
  if (!isPrivateChannel) {
    const wsMembers = db.workspaceMembers.filter(m => m.workspaceId === workspaceId && m.status === 'Active' && m.userId !== userId);
    wsMembers.forEach(wm => {
      db.channelMembers.push({
        id: `cm-${Date.now()}-${wm.userId}`,
        channelId: newChannel.id,
        userId: wm.userId,
        role: wm.role,
        joinedAt: new Date().toISOString(),
        isMuted: false,
        notificationLevel: 'all'
      });
    });
    newChannel.membersCount = db.channelMembers.filter(m => m.channelId === newChannel.id).length;
  }

  // Section 93 Outbox event
  db.enqueueOutbox('ChannelCreated', { channel: newChannel, creatorId: userId });

  db.logAudit(
    tenantId,
    userId,
    req.user!.displayName,
    'CHANNEL_CREATED',
    'Channel',
    newChannel.id,
    req.ip,
    { name: cleanName, type: channelType, isPrivate: isPrivateChannel },
    workspaceId
  );

  realtimeHub.broadcastToWorkspace(workspaceId, 'ChannelCreated', newChannel);

  res.status(201).json({ success: true, data: newChannel });
});

// Update channel details
channelsRouter.put('/:id', authenticate, requirePermission('channels.update'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { description, topic, isPinned, isMuted } = req.body;
  const workspaceId = req.workspace!.id;

  const channel = db.channels.find(c => c.id === id && c.workspaceId === workspaceId && !c.deletedAt);
  if (!channel) {
    return res.status(404).json({ success: false, message: 'Canal no encontrado en este workspace', code: 'NOT_FOUND' });
  }

  if (description !== undefined) channel.description = sanitizeText(description);
  if (topic !== undefined) channel.topic = sanitizeText(topic);
  if (isPinned !== undefined) channel.isPinned = isPinned;
  if (isMuted !== undefined) channel.isMuted = isMuted;
  channel.updatedAt = new Date().toISOString();

  await db.persistChannelUpdate(id, channel);

  realtimeHub.broadcastToWorkspace(workspaceId, 'ChannelUpdated', channel);

  res.json({ success: true, data: channel });
});

// Section 22: Archive channel (rejects new messages unless admin)
channelsRouter.post('/:id/archive', authenticate, requirePermission('channels.archive'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id && !c.deletedAt);
  if (!channel) return res.status(404).json({ success: false, message: 'Canal no encontrado' });

  channel.isArchived = true;
  channel.archivedAt = new Date().toISOString();
  channel.updatedAt = new Date().toISOString();

  await db.persistChannelUpdate(id, { isArchived: true });

  db.enqueueOutbox('ChannelArchived', { channelId: id, archivedAt: channel.archivedAt });

  db.logAudit(
    req.user!.tenantId,
    req.user!.id,
    req.user!.displayName,
    'CHANNEL_ARCHIVED',
    'Channel',
    id,
    req.ip,
    { name: channel.name },
    req.workspace!.id
  );

  realtimeHub.broadcastToWorkspace(req.workspace!.id, 'ChannelArchived', { channelId: id, archivedAt: channel.archivedAt });

  res.json({ success: true, message: 'Canal archivado correctamente', data: channel });
});

// Section 23: Soft Delete Channel
channelsRouter.delete('/:id', authenticate, requirePermission('channels.delete'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id);
  if (!channel) return res.status(404).json({ success: false, message: 'Canal no encontrado' });

  channel.deletedAt = new Date().toISOString();
  channel.updatedAt = new Date().toISOString();

  await db.persistChannelSoftDelete(id);

  realtimeHub.broadcastToWorkspace(req.workspace!.id, 'ChannelDeleted', { channelId: id });

  res.json({ success: true, message: 'Canal eliminado' });
});

// Section 10 & 21: Get channel members
channelsRouter.get('/:id/members', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id && !c.deletedAt);
  if (!channel) {
    return res.status(404).json({ success: false, message: 'Canal no encontrado', code: 'NOT_FOUND' });
  }

  if (channel.isPrivate) {
    const isMember = db.channelMembers.some(m => m.channelId === id && m.userId === req.user!.id);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'No tiene acceso a este canal privado', code: 'FORBIDDEN' });
    }
  }

  const memberships = db.channelMembers.filter(m => m.channelId === id);
  const detailedMembers = memberships.map(m => {
    const user = db.users.find(u => u.id === m.userId);
    return {
      ...m,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        status: user.status,
        lastSeenAt: user.lastSeenAt
      } : null
    };
  });

  res.json({ success: true, data: detailedMembers });
});

// Section 21: Add member to channel
channelsRouter.post('/:id/members', authenticate, requirePermission('channels.manage_members'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { userId } = req.body;

  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id && !c.deletedAt);
  if (!channel) return res.status(404).json({ success: false, message: 'Canal no encontrado' });

  const targetUser = db.users.find(u => u.id === userId && u.tenantId === req.user!.tenantId);
  if (!targetUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

  const exists = db.channelMembers.find(m => m.channelId === id && m.userId === userId);
  if (exists) {
    return res.status(409).json({ success: false, message: 'El usuario ya es miembro de este canal' });
  }

  const newMember: ChannelMember = {
    id: `cm-${Date.now()}-${userId}`,
    channelId: id,
    userId,
    joinedAt: new Date().toISOString(),
    isMuted: false,
    notificationLevel: 'all'
  };
  db.channelMembers.push(newMember);
  channel.membersCount = db.channelMembers.filter(m => m.channelId === id).length;

  realtimeHub.broadcastToChannel(id, 'ChannelMemberAdded', { channelId: id, member: newMember, user: targetUser });

  res.status(201).json({ success: true, data: newMember });
});

// Section 21: Remove member from channel
channelsRouter.delete('/:id/members/:userId', authenticate, requirePermission('channels.manage_members'), (req: AuthenticatedRequest, res: Response) => {
  const { id, userId } = req.params;
  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id && !c.deletedAt);
  if (!channel) return res.status(404).json({ success: false, message: 'Canal no encontrado' });

  const idx = db.channelMembers.findIndex(m => m.channelId === id && m.userId === userId);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Miembro no encontrado en el canal' });

  db.channelMembers.splice(idx, 1);
  channel.membersCount = db.channelMembers.filter(m => m.channelId === id).length;

  realtimeHub.broadcastToChannel(id, 'ChannelMemberRemoved', { channelId: id, userId });

  res.json({ success: true, message: 'Miembro removido del canal' });
});

// Section 21: Leave channel
channelsRouter.post('/:id/leave', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const idx = db.channelMembers.findIndex(m => m.channelId === id && m.userId === userId);
  if (idx === -1) {
    return res.status(400).json({ success: false, message: 'No eres miembro de este canal' });
  }

  db.channelMembers.splice(idx, 1);
  const channel = db.channels.find(c => c.id === id);
  if (channel) {
    channel.membersCount = db.channelMembers.filter(m => m.channelId === id).length;
  }

  realtimeHub.broadcastToChannel(id, 'ChannelMemberLeft', { channelId: id, userId });

  res.json({ success: true, message: 'Has salido del canal' });
});

// Section 21 & 110: Mute/Unmute channel
channelsRouter.post('/:id/mute', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { isMuted } = req.body;

  const membership = db.channelMembers.find(m => m.channelId === id && m.userId === userId);
  if (!membership) {
    return res.status(404).json({ success: false, message: 'No eres miembro de este canal' });
  }

  membership.isMuted = isMuted !== undefined ? !!isMuted : !membership.isMuted;
  res.json({ success: true, isMuted: membership.isMuted });
});

// Section 110: Notification settings
channelsRouter.patch('/:id/notifications', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { notificationLevel } = req.body;

  if (!['all', 'mentions', 'nothing'].includes(notificationLevel)) {
    return res.status(400).json({ success: false, message: 'Nivel de notificación inválido' });
  }

  const membership = db.channelMembers.find(m => m.channelId === id && m.userId === userId);
  if (!membership) {
    return res.status(404).json({ success: false, message: 'No eres miembro de este canal' });
  }

  membership.notificationLevel = notificationLevel;
  res.json({ success: true, data: membership });
});

// Section 58-59: Mark Channel Read
channelsRouter.post('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { messageId } = req.body;
  const userId = req.user!.id;

  const membership = db.channelMembers.find(m => m.channelId === id && m.userId === userId);
  if (membership) {
    membership.lastReadMessageId = messageId || (db.messages.filter(m => m.channelId === id).pop()?.id);
  }

  realtimeHub.sendToUser(userId, 'ReadStateUpdated', {
    channelId: id,
    lastReadMessageId: membership?.lastReadMessageId,
    unreadCount: 0
  });

  res.json({ success: true, lastReadMessageId: membership?.lastReadMessageId });
});

// Section 52: Pinned messages in channel
channelsRouter.get('/:id/pins', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const channel = db.channels.find(c => c.id === id && c.workspaceId === req.workspace!.id && !c.deletedAt);
  if (!channel) return res.status(404).json({ success: false, message: 'Canal no encontrado' });

  const pins = db.pinnedMessages.filter(p => p.channelId === id).map(p => {
    const msg = db.messages.find(m => m.id === p.messageId);
    return {
      ...p,
      message: msg
    };
  });

  // Also include messages where isPinned === true
  const directlyPinned = db.messages
    .filter(m => m.channelId === id && m.isPinned && !pins.some(p => p.messageId === m.id))
    .map(m => ({
      id: `pin-${m.id}`,
      messageId: m.id,
      channelId: id,
      pinnedBy: m.senderId,
      pinnedAt: m.updatedAt || m.createdAt,
      message: m
    }));

  res.json({ success: true, data: [...pins, ...directlyPinned] });
});

