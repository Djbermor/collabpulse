import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, AuthenticatedRequest } from '../middleware';
import { pool } from '../../src/db/index';
import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';

export const groupCallsRouter = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const MAX_GROUP_PARTICIPANTS = parseInt(process.env.MAX_GROUP_PARTICIPANTS || '25', 10);

const webhookReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

/**
 * POST /api/v1/group-calls
 * Create a new group call room with host role.
 */
groupCallsRouter.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace?.id || (req.user as any).workspaceId || (req.headers['x-workspace-id'] as string) || '00000000-0000-0000-0000-000000000001';

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      message: 'Workspace requerido',
      code: 'WORKSPACE_REQUIRED'
    });
  }

  const { title = 'Conferencia Grupal', mediaType = 'video', customRoomId, maxParticipants = MAX_GROUP_PARTICIPANTS, channelId } = req.body;
  const callId = `grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const roomId = customRoomId || `room-grp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const participantLimit = Math.min(Math.max(2, maxParticipants), MAX_GROUP_PARTICIPANTS);

  try {
    const callRes = await pool.query(
      `INSERT INTO group_calls (id, tenant_id, workspace_id, room_id, title, creator_id, media_type, status, started_at, max_participants, channel_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), $8, $9)
       RETURNING *`,
      [callId, tenantId, workspaceId, roomId, title, userId, mediaType, participantLimit, channelId || null]
    );

    const participantId = `gp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await pool.query(
      `INSERT INTO group_call_participants (id, group_call_id, user_id, role, status, audio_enabled, video_enabled, joined_at)
       VALUES ($1, $2, $3, 'host', 'joined', true, $4, NOW())`,
      [participantId, callId, userId, mediaType === 'video']
    );

    const eventId = `gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, 'created', $3, $4)`,
      [eventId, callId, userId, JSON.stringify({ title, roomId, mediaType, channelId })]
    );

    const groupCall = callRes.rows[0];

    // FASE 6: Auto-create a conversation for in-call chat
    let callConversationId: string | undefined;
    try {
      const { id: gcConvId, isNew: gcConvIsNew } = await db.findOrCreateCallConversation({
        callId,
        tenantId,
        workspaceId,
        memberIds: [userId],
        title,
        type: 'group'
      });
      callConversationId = gcConvId;
      if (gcConvIsNew) {
        await db.persistSystemMessage({
          conversationId: gcConvId,
          tenantId,
          workspaceId,
          content: `📞 Conferencia "${title}" iniciada`
        });
      }
    } catch (convErr: any) {
      console.warn('[GroupCalls] Failed to create conversation for call:', convErr.message);
    }

    // Generate host token
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || userId,
      ttl: '15m'
    });
    at.addGrant({
      room: groupCall.room_id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });
    const liveKitToken = await at.toJwt();

    // Broadcast GroupCallCreated via enterprise SSE channel
    realtimeHub.broadcastToWorkspace(workspaceId, 'GroupCallCreated', {
      id: groupCall.id,
      roomId: groupCall.room_id,
      title: groupCall.title,
      creatorId: groupCall.creator_id,
      mediaType: groupCall.media_type,
      maxParticipants: groupCall.max_participants,
      tenantId,
      workspaceId,
      channelId: groupCall.channel_id,
      callConversationId, // FASE 6
      startedAt: groupCall.started_at
    });

    return res.status(201).json({
      success: true,
      data: {
        ...groupCall,
        currentUserRole: 'host',
        serverUrl: LIVEKIT_URL,
        token: liveKitToken,
        liveKitToken,
        callConversationId // FASE 6
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error creating group call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/invite
 * Invite one or more participants within the same tenant.
 */
groupCallsRouter.post('/:id/invite', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ success: false, message: 'userIds array is required' });
  }

  try {
    const callRes = await pool.query(
      `SELECT * FROM group_calls WHERE id = $1`,
      [id]
    );

    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Llamada grupal no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    if (call.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    if (call.status !== 'active') {
      return res.status(400).json({ success: false, message: 'La llamada ya no está activa', code: 'CALL_NOT_ACTIVE' });
    }

    // Verify caller is a member
    const memberRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2 AND status = 'joined'`,
      [id, userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Solo participantes activos pueden invitar', code: 'NOT_A_PARTICIPANT' });
    }

    const invited: string[] = [];

    for (const targetId of userIds) {
      // Tenant check on target user
      const userRes = await pool.query('SELECT id, tenant_id FROM users WHERE id = $1', [targetId]);
      if (userRes.rows.length === 0 || userRes.rows[0].tenant_id !== tenantId) {
        continue; // Skip cross-tenant or non-existent users
      }

      const pId = `gp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
        `INSERT INTO group_call_participants (id, group_call_id, user_id, role, status, joined_at)
         VALUES ($1, $2, $3, 'participant', 'invited', NULL)
         ON CONFLICT (id) DO NOTHING`,
        [pId, id, targetId]
      );

      invited.push(targetId);

      // Record event
      await pool.query(
        `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
         VALUES ($1, $2, 'invited', $3, $4)`,
        [`gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, id, targetId, JSON.stringify({ invitedBy: userId })]
      );

      // Notify invited user via SSE
      realtimeHub.sendToUser(targetId, 'ParticipantInvited', {
        groupCallId: id,
        roomId: call.room_id,
        title: call.title,
        invitedBy: userId
      });
    }

    return res.json({
      success: true,
      data: {
        groupCallId: id,
        invitedCount: invited.length,
        invitedUserIds: invited
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error inviting participants:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/join
 * Join an active group call, enforcing MAX_GROUP_PARTICIPANTS.
 */
groupCallsRouter.post('/:id/join', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1 OR room_id = $1', [id]);
    if (callRes.rows.length === 0 || callRes.rows[0].tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Llamada grupal no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    const callId = call.id;

    if (call.status !== 'active') {
      return res.status(410).json({ success: false, message: 'La llamada ha finalizado', code: 'CALL_ENDED' });
    }

    // Capacity Check
    const activePartsRes = await pool.query(
      `SELECT COUNT(*) FROM group_call_participants WHERE group_call_id = $1 AND status = 'joined'`,
      [callId]
    );
    const activeCount = parseInt(activePartsRes.rows[0].count, 10);

    // If user is not already joined and activeCount >= max_participants
    const existingPart = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    const isAlreadyJoined = existingPart.rows.length > 0 && existingPart.rows[0].status === 'joined';

    if (!isAlreadyJoined && activeCount >= call.max_participants) {
      return res.status(409).json({
        success: false,
        message: `Capacidad máxima alcanzada (${call.max_participants} participantes)`,
        code: 'ROOM_FULL'
      });
    }

    let role = 'participant';
    if (call.creator_id === userId) {
      role = 'host';
    }

    if (existingPart.rows.length > 0) {
      await pool.query(
        `UPDATE group_call_participants
         SET status = 'joined', connection_state = 'connected', joined_at = NOW(), left_at = NULL
         WHERE id = $1`,
        [existingPart.rows[0].id]
      );
    } else {
      const pId = `gp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await pool.query(
        `INSERT INTO group_call_participants (id, group_call_id, user_id, role, status, connection_state, joined_at)
         VALUES ($1, $2, $3, $4, 'joined', 'connected', NOW())`,
        [pId, callId, userId, role]
      );
    }

    // Record joined event
    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, 'joined', $3, '{}')`,
      [`gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, callId, userId]
    );

    // Broadcast ParticipantJoined
    const pName = `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || (req.user as any).userName || (req.user as any).username;
    realtimeHub.broadcastToWorkspace(call.workspace_id, 'ParticipantJoined', {
      groupCallId: id,
      roomId: call.room_id,
      userId,
      userName: pName,
      role
    });

    // FASE 6: Add this user to the call conversation for in-call chat
    let callConversationId: string | undefined;
    try {
      const convRes = await pool.query(
        `SELECT id FROM conversations WHERE call_id = $1 LIMIT 1`,
        [id]
      );
      if (convRes.rows.length > 0) {
        callConversationId = convRes.rows[0].id;
        await db.addMemberToCallConversation(callConversationId!, userId, call.workspace_id);
        await db.persistSystemMessage({
          conversationId: callConversationId!,
          tenantId,
          workspaceId: call.workspace_id,
          content: `👤 ${pName} se unió a la llamada`
        });
        // Broadcast system message to all conversation members
        realtimeHub.broadcastToConversation(callConversationId!, 'SystemMessageCreated', {
          conversationId: callConversationId,
          content: `👤 ${pName} se unió a la llamada`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (convErr: any) {
      console.warn('[GroupCalls] Failed to update conversation on join:', convErr.message);
    }

    return res.json({
      success: true,
      data: {
        groupCallId: id,
        roomId: call.room_id,
        role,
        status: 'joined',
        serverUrl: LIVEKIT_URL,
        callConversationId // FASE 6
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error joining group call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/leave
 * Cleanly leave a group call.
 */
groupCallsRouter.post('/:id/leave', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1 OR room_id = $1', [id]);
    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    const callId = call.id;

    if (call.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    const partRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    if (partRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No eres participante de esta llamada' });
    }

    const participant = partRes.rows[0];

    await pool.query(
      `UPDATE group_call_participants
       SET status = 'left', connection_state = 'disconnected', left_at = NOW()
       WHERE id = $1`,
      [participant.id]
    );

    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, 'left', $3, '{}')`,
      [`gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, callId, userId]
    );

    // Check remaining participants
    const remainingRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND status = 'joined'`,
      [callId]
    );

    let callEnded = false;
    let hostTransferredTo: string | undefined;

    if (remainingRes.rows.length === 0) {
      // No one left, close call
      callEnded = true;
      await pool.query(
        `UPDATE group_calls
         SET status = 'ended', ended_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
         WHERE id = $1`,
        [callId]
      );
    } else if (participant.role === 'host') {
      // Transfer host to first senior participant
      const nextHost = remainingRes.rows[0];
      hostTransferredTo = nextHost.user_id;
      await pool.query(
        `UPDATE group_call_participants SET role = 'host' WHERE id = $1`,
        [nextHost.id]
      );

      realtimeHub.broadcastToWorkspace(call.workspace_id, 'HostChanged', {
        groupCallId: callId,
        newHostUserId: nextHost.user_id
      });
    }

    realtimeHub.broadcastToWorkspace(call.workspace_id, 'ParticipantLeft', {
      groupCallId: callId,
      userId
    });

    return res.json({
      success: true,
      message: 'Has abandonado la llamada grupal',
      hostTransferredTo,
      callEnded
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error leaving group call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/end
 * End call for all participants (Host only).
 */
groupCallsRouter.post('/:id/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1 OR room_id = $1', [id]);
    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    const callId = call.id;

    if (call.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    // Role check: Only host can end for everyone
    const partRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    const isHost = (partRes.rows.length > 0 && partRes.rows[0].role === 'host') || call.creator_id === userId;
    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Solo el anfitrión puede finalizar la llamada para todos',
        code: 'HOST_ONLY'
      });
    }

    await pool.query(
      `UPDATE group_calls
       SET status = 'ended', ended_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
       WHERE id = $1`,
      [id]
    );

    await pool.query(
      `UPDATE group_call_participants
       SET status = 'left', connection_state = 'disconnected', left_at = NOW()
       WHERE group_call_id = $1 AND status = 'joined'`,
      [id]
    );

    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, 'ended', $3, '{}')`,
      [`gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, id, userId]
    );

    // Notify all participants
    realtimeHub.broadcastToWorkspace(call.workspace_id, 'GroupCallEnded', {
      groupCallId: id,
      endedBy: userId
    });

    return res.json({ success: true, message: 'Conferencia grupal finalizada exitosamente' });
  } catch (err: any) {
    console.error('[GroupCalls] Error ending group call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/token
 * Generate an authenticated ephemeral LiveKit AccessToken (15m TTL).
 */
groupCallsRouter.post('/:id/token', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace?.id || (req.user as any).workspaceId || (req.headers['x-workspace-id'] as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1 OR room_id = $1', [id]);
    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    const callId = call.id;

    if (call.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    if (call.status !== 'active') {
      return res.status(410).json({ success: false, message: 'La llamada ha finalizado', code: 'CALL_ENDED' });
    }

    // Verify membership
    const partRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2`,
      [callId, userId]
    );

    if (partRes.rows.length === 0 || partRes.rows[0].status === 'left') {
      return res.status(403).json({
        success: false,
        message: 'No eres miembro activo de esta conferencia',
        code: 'NOT_A_PARTICIPANT'
      });
    }

    const participant = partRes.rows[0];
    const isHost = participant.role === 'host';
    const userName = `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || (req.user as any).userName || (req.user as any).username;

    // 15 minutes TTL
    const expiresInSeconds = 900;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: userName,
      ttl: `${expiresInSeconds}s`,
      metadata: JSON.stringify({
        userId,
        tenantId,
        workspaceId,
        role: participant.role
      })
    });

    at.addGrant({
      roomJoin: true,
      room: call.room_id,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost
    });

    const token = await at.toJwt();

    return res.json({
      success: true,
      data: {
        token,
        serverUrl: LIVEKIT_URL,
        roomId: call.room_id,
        groupCallId: id,
        expiresIn: expiresInSeconds
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error generating SFU token:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/token/refresh
 * Refresh an expiring LiveKit AccessToken with strict re-validation.
 */
groupCallsRouter.post('/:id/token/refresh', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace?.id || (req.user as any).workspaceId || (req.headers['x-workspace-id'] as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1', [id]);
    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada', code: 'CALL_NOT_FOUND' });
    }

    const call = callRes.rows[0];
    if (call.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant mismatch', code: 'TENANT_MISMATCH' });
    }

    if (call.status !== 'active') {
      return res.status(410).json({ success: false, message: 'La llamada ya finalizó', code: 'CALL_ENDED' });
    }

    const partRes = await pool.query(
      `SELECT * FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2 AND status != 'left'`,
      [id, userId]
    );

    if (partRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Participante no activo', code: 'NOT_ACTIVE' });
    }

    const participant = partRes.rows[0];
    const isHost = participant.role === 'host';
    const userName = `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || (req.user as any).userName || (req.user as any).username;

    const expiresInSeconds = 900;
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      name: userName,
      ttl: `${expiresInSeconds}s`,
      metadata: JSON.stringify({ userId, tenantId, workspaceId, role: participant.role })
    });

    at.addGrant({
      roomJoin: true,
      room: call.room_id,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isHost
    });

    const token = await at.toJwt();

    return res.json({
      success: true,
      data: {
        token,
        serverUrl: LIVEKIT_URL,
        roomId: call.room_id,
        groupCallId: id,
        expiresIn: expiresInSeconds
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error refreshing token:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/mute
 * Sync business state for microphone mute/unmute.
 */
groupCallsRouter.post('/:id/mute', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const { audioEnabled, targetUserId } = req.body;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1', [id]);
    if (callRes.rows.length === 0 || callRes.rows[0].tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada' });
    }

    const effectiveUserId = targetUserId || userId;

    // If muting another user, check if requester is host
    if (effectiveUserId !== userId) {
      const requesterRes = await pool.query(
        `SELECT role FROM group_call_participants WHERE group_call_id = $1 AND user_id = $2`,
        [id, userId]
      );
      if (requesterRes.rows.length === 0 || requesterRes.rows[0].role !== 'host') {
        return res.status(403).json({ success: false, message: 'Solo el anfitrión puede silenciar a otros', code: 'HOST_ONLY' });
      }
    }

    await pool.query(
      `UPDATE group_call_participants SET audio_enabled = $1 WHERE group_call_id = $2 AND user_id = $3`,
      [!!audioEnabled, id, effectiveUserId]
    );

    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        `gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        id,
        audioEnabled ? 'unmuted' : 'muted',
        effectiveUserId,
        JSON.stringify({ triggeredBy: userId })
      ]
    );

    realtimeHub.broadcastToWorkspace(
      callRes.rows[0].workspace_id,
      audioEnabled ? 'ParticipantUnmuted' : 'ParticipantMuted',
      { groupCallId: id, userId: effectiveUserId }
    );

    return res.json({ success: true, audioEnabled: !!audioEnabled });
  } catch (err: any) {
    console.error('[GroupCalls] Error toggling mute:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/:id/video
 * Sync business state for camera on/off.
 */
groupCallsRouter.post('/:id/video', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const { videoEnabled } = req.body;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1', [id]);
    if (callRes.rows.length === 0 || callRes.rows[0].tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada' });
    }

    await pool.query(
      `UPDATE group_call_participants SET video_enabled = $1 WHERE group_call_id = $2 AND user_id = $3`,
      [!!videoEnabled, id, userId]
    );

    await pool.query(
      `INSERT INTO group_call_events (id, group_call_id, event_type, user_id, metadata)
       VALUES ($1, $2, $3, $4, '{}')`,
      [
        `gce-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        id,
        videoEnabled ? 'video_enabled' : 'video_disabled',
        userId
      ]
    );

    realtimeHub.broadcastToWorkspace(
      callRes.rows[0].workspace_id,
      videoEnabled ? 'ParticipantVideoEnabled' : 'ParticipantVideoDisabled',
      { groupCallId: id, userId }
    );

    return res.json({ success: true, videoEnabled: !!videoEnabled });
  } catch (err: any) {
    console.error('[GroupCalls] Error toggling video:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/group-calls/channel/:channelId
 * Retrieve active group call for a channel.
 */
groupCallsRouter.get('/channel/:channelId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { channelId } = req.params;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query(
      `SELECT * FROM group_calls WHERE channel_id = $1 AND tenant_id = $2 AND status = 'active' ORDER BY started_at DESC LIMIT 1`,
      [channelId, tenantId]
    );
    if (callRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No hay llamada activa para este canal' });
    }

    const call = callRes.rows[0];
    const partsRes = await pool.query(
      `SELECT gp.*, u.user_name AS username, u.first_name, u.last_name, u.avatar_url
       FROM group_call_participants gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.group_call_id = $1
       ORDER BY gp.joined_at ASC`,
      [call.id]
    );

    return res.json({
      success: true,
      data: {
        ...call,
        participants: partsRes.rows
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error getting channel call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/group-calls/active
 * Retrieve active group calls for workspace.
 */
groupCallsRouter.get('/active', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query(
      `SELECT * FROM group_calls WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC`,
      [tenantId]
    );

    return res.json({
      success: true,
      data: callRes.rows
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error getting active calls:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/group-calls/:id
 * Retrieve group call status and metadata.
 */
groupCallsRouter.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE (id = $1 OR room_id = $1)', [id]);
    if (callRes.rows.length === 0 || callRes.rows[0].tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada' });
    }

    const call = callRes.rows[0];
    const callId = call.id;

    const partsRes = await pool.query(
      `SELECT gp.*, u.user_name AS username, u.first_name, u.last_name, u.avatar_url
       FROM group_call_participants gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.group_call_id = $1
       ORDER BY gp.joined_at ASC`,
      [callId]
    );

    return res.json({
      success: true,
      data: {
        ...call,
        participants: partsRes.rows
      }
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error getting group call:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/group-calls/:id/participants
 * List active participants.
 */
groupCallsRouter.get('/:id/participants', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const tenantId = req.user!.tenantId;

  try {
    const callRes = await pool.query('SELECT * FROM group_calls WHERE id = $1', [id]);
    if (callRes.rows.length === 0 || callRes.rows[0].tenant_id !== tenantId) {
      return res.status(404).json({ success: false, message: 'Llamada no encontrada' });
    }

    const partsRes = await pool.query(
      `SELECT gp.*, u.user_name AS username, u.first_name, u.last_name, u.avatar_url
       FROM group_call_participants gp
       JOIN users u ON gp.user_id = u.id
       WHERE gp.group_call_id = $1
       ORDER BY gp.joined_at ASC`,
      [id]
    );

    return res.json({
      success: true,
      data: partsRes.rows
    });
  } catch (err: any) {
    console.error('[GroupCalls] Error listing participants:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/group-calls/webhooks/livekit
 * Authenticated LiveKit webhook receiver for SFU event reconciliation.
 */
groupCallsRouter.post('/webhooks/livekit', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send('Missing Authorization header');
    }

    // WebhookReceiver validates the signature
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const event = await webhookReceiver.receive(bodyStr, authHeader);

    const roomName = event.room?.name;
    const participantIdentity = event.participant?.identity;

    if (roomName) {
      if (event.event === 'participant_left' && participantIdentity) {
        // Reconcile participant leaving in PostgreSQL
        await pool.query(
          `UPDATE group_call_participants gp
           SET status = 'left', connection_state = 'disconnected', left_at = NOW()
           FROM group_calls gc
           WHERE gp.group_call_id = gc.id AND gc.room_id = $1 AND gp.user_id = $2`,
          [roomName, participantIdentity]
        );
      } else if (event.event === 'room_finished') {
        // Reconcile room finish
        await pool.query(
          `UPDATE group_calls
           SET status = 'ended', ended_at = NOW(), duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))
           WHERE room_id = $1 AND status = 'active'`,
          [roomName]
        );
      }
    }

    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('[GroupCalls Webhook] Validation failed:', err.message);
    return res.status(401).send('Invalid webhook event or signature');
  }
});
