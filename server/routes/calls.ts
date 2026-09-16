import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, AuthenticatedRequest } from '../middleware';
import { pool } from '../../src/db/index';
import { signJwt, verifyJwt, JWT_SECRET } from '../security';
import { CallSession, CallParticipant, CallHistoryRecord } from '../../src/types';

export const callsRouter = Router();

// Multi-tab claim registry: callId -> { tabId: string, claimedAt: number }
const activeCallClaims = new Map<string, { tabId: string; claimedAt: number }>();

// 30-second outgoing timeout registry: callId -> NodeJS.Timeout
const outgoingCallTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * GET /api/v1/calls/ice-servers
 * Returns authorized STUN/TURN configuration.
 * Abstraction ready for STUN + TURN UDP/TCP/TLS without hardcoding credentials in frontend.
 */
callsRouter.get('/ice-servers', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const defaultStunServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ];

  const turnUrls = process.env.TURN_SERVER_URLS ? process.env.TURN_SERVER_URLS.split(',').map(s => s.trim()) : [];
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  const iceServers = [...defaultStunServers];

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential
    } as any);
  }

  return res.json({
    success: true,
    data: {
      iceServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  });
});

/**
 * POST /api/v1/calls/session-token
 * Generates an ephemeral cryptographic token for a call session.
 */
callsRouter.post('/session-token', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const { callId, roomId } = req.body;
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  if (!callId || !roomId) {
    return res.status(400).json({ success: false, message: 'callId y roomId son requeridos' });
  }

  const expiresIn = 7200; // 2 hours
  const token = signJwt(
    {
      sub: userId,
      tenantId,
      callId,
      roomId,
      permissions: ['call.signal', 'call.media']
    },
    JWT_SECRET,
    expiresIn
  );

  return res.json({
    success: true,
    data: {
      token,
      expiresIn,
      callId,
      roomId,
      userId,
      tenantId
    }
  });
});

/**
 * POST /api/v1/calls/invite
 * Strict multi-tenant incoming call invitation with PostgreSQL persistence and 30s timeout.
 */
callsRouter.post('/invite', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const callerId = req.user!.id;
  const callerTenantId = req.user!.tenantId;
  const { targetUserId, conversationId, channelId, roomId: customRoomId, mediaType = 'video', title } = req.body;

  if (!targetUserId && !conversationId && !channelId) {
    return res.status(400).json({
      success: false,
      message: 'Debe especificar targetUserId, conversationId o channelId'
    });
  }

  // Strict multi-tenant verification for 1:1 call
  let targetUser: any = null;
  if (targetUserId) {
    targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      try {
        const dbRes = await pool.query('SELECT id, tenant_id as "tenantId", display_name as "displayName", avatar_url as "avatarUrl" FROM users WHERE id = $1', [targetUserId]);
        if (dbRes.rows.length > 0) {
          targetUser = dbRes.rows[0];
        }
      } catch (err: any) {
        console.warn('[CallEngine] DB lookup error:', err.message);
      }
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Usuario destinatario no encontrado' });
    }

    if (targetUser.tenantId !== callerTenantId) {
      console.warn(`[CallSecurity] Multi-tenant cross-call blocked! Caller ${callerId} (tenant: ${callerTenantId}) -> Callee ${targetUserId} (tenant: ${targetUser.tenantId})`);
      return res.status(403).json({
        success: false,
        code: 'TENANT_MISMATCH',
        message: 'Acceso denegado: no se permite comunicación entre diferentes organizaciones'
      });
    }
  }

  const caller = db.users.find(u => u.id === callerId);
  const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const roomId = customRoomId || `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Create formal CallSession model
  const callSession: CallSession = {
    id: callId,
    roomId,
    tenantId: callerTenantId,
    workspaceId: req.workspace?.id || 'ws-default',
    type: '1:1',
    mediaType: (mediaType === 'audio' ? 'audio' : 'video'),
    direction: 'outbound',
    origin: conversationId ? 'conversation' : channelId ? 'channel' : 'direct',
    state: 'ringing_outgoing',
    callerId,
    calleeId: targetUserId || undefined,
    callerName: caller ? caller.displayName : (req.user!.email || 'Colaborador'),
    calleeName: targetUser ? targetUser.displayName : undefined,
    callerAvatar: caller?.avatarUrl || '',
    calleeAvatar: targetUser?.avatarUrl || '',
    conversationId: conversationId || undefined,
    channelId: channelId || undefined,
    participantIds: [callerId, ...(targetUserId ? [targetUserId] : [])],
    createdAt: now,
    ringingAt: now
  };

  // Persist call session to DB
  await db.persistCall(callSession);

  // Persist caller participant
  const callerParticipant: CallParticipant = {
    id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    callId,
    userId: callerId,
    userName: caller?.displayName,
    userAvatar: caller?.avatarUrl,
    role: 'caller',
    state: 'connected',
    joinedAt: now,
    createdAt: now
  };
  await db.persistCallParticipant(callerParticipant);

  // Persist callee participant if direct
  if (targetUserId) {
    const calleeParticipant: CallParticipant = {
      id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      callId,
      userId: targetUserId,
      userName: targetUser?.displayName,
      userAvatar: targetUser?.avatarUrl,
      role: 'callee',
      state: 'ringing',
      createdAt: now
    };
    await db.persistCallParticipant(calleeParticipant);
  }

  // Audit history
  await db.persistCallHistory({
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    callId,
    tenantId: callerTenantId,
    eventType: 'outgoing',
    userId: callerId,
    metadata: { targetUserId, mediaType, roomId },
    createdAt: now
  });

  const invitePayload = {
    callId,
    roomId,
    conversationId,
    channelId,
    title: title || (mediaType === 'video' ? 'Videollamada' : 'Llamada de voz'),
    isVideo: mediaType !== 'audio',
    callType: mediaType,
    caller: {
      id: callerId,
      displayName: caller ? caller.displayName : 'Colaborador',
      avatarUrl: caller?.avatarUrl || '',
      jobTitle: caller?.jobTitle || ''
    },
    timestamp: now
  };

  // Dispatch realtime event to callee(s)
  if (targetUserId) {
    realtimeHub.sendToUser(targetUserId, 'IncomingCall', invitePayload);
  } else if (conversationId) {
    const conv = db.conversations.find(c => c.id === conversationId);
    if (conv?.memberIds) {
      for (const mId of conv.memberIds) {
        if (mId !== callerId) realtimeHub.sendToUser(mId, 'IncomingCall', invitePayload);
      }
    }
  } else if (channelId) {
    realtimeHub.broadcastToGroup(`channel:${channelId}`, 'IncomingCall', invitePayload);
  }

  // 30-Second Outgoing Timeout: automatically expire unanswered call
  const timeoutId = setTimeout(async () => {
    try {
      const currentCall = db.getCall(callId);
      if (currentCall && (currentCall.state === 'ringing_outgoing' || currentCall.state === 'initiating')) {
        console.log(`[CallEngine] Call ${callId} timed out after 30s. Transitioning to missed/timeout.`);
        currentCall.state = 'ended';
        currentCall.endReason = 'timeout';
        currentCall.endedAt = new Date().toISOString();
        await db.persistCall(currentCall);

        await db.persistCallHistory({
          id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          callId,
          tenantId: callerTenantId,
          eventType: 'timeout',
          userId: callerId,
          metadata: { reason: 'No answer after 30 seconds' },
          createdAt: new Date().toISOString()
        });

        const cancelPayload = {
          callId,
          roomId,
          callerId,
          reason: 'timeout',
          timestamp: new Date().toISOString()
        };

        realtimeHub.sendToUser(callerId, 'CallTimeout', cancelPayload);
        if (targetUserId) {
          realtimeHub.sendToUser(targetUserId, 'CallTimeout', cancelPayload);
        }
      }
    } catch (err: any) {
      console.error('[CallEngine] Timeout handler error:', err.message);
    } finally {
      outgoingCallTimeouts.delete(callId);
    }
  }, 30000);

  outgoingCallTimeouts.set(callId, timeoutId);

  return res.json({
    success: true,
    data: {
      call: callSession,
      callId,
      roomId,
      mediaType
    }
  });
});

/**
 * POST /api/v1/calls/claim
 * Atomic multi-tab call claim. The first tab to accept gets ownership;
 * concurrent/subsequent tabs receive 409 Conflict (CALL_ALREADY_CLAIMED) and stop ringing.
 */
callsRouter.post('/claim', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { callId, tabId } = req.body;

  if (!callId || !tabId) {
    return res.status(400).json({ success: false, message: 'callId y tabId son requeridos' });
  }

  const existingClaim = activeCallClaims.get(callId);
  if (existingClaim) {
    if (existingClaim.tabId === tabId) {
      // Same tab repeating claim: idempotent success
      return res.json({
        success: true,
        code: 'CALL_CLAIMED',
        message: 'Llamada reclamada por esta pestaña',
        data: { callId, tabId }
      });
    }

    // Already claimed by a different tab
    return res.status(409).json({
      success: false,
      code: 'CALL_ALREADY_CLAIMED',
      message: 'La llamada ya fue aceptada en otra pestaña o dispositivo',
      data: { callId, claimedByTabId: existingClaim.tabId }
    });
  }

  // Claim call atomically
  activeCallClaims.set(callId, { tabId, claimedAt: Date.now() });

  // Clear 30s timeout if present
  const timer = outgoingCallTimeouts.get(callId);
  if (timer) {
    clearTimeout(timer);
    outgoingCallTimeouts.delete(callId);
  }

  // Notify all tabs of the callee user that call has been claimed so other tabs stop ringing
  realtimeHub.sendToUser(userId, 'CallClaimed', {
    callId,
    claimedByTabId: tabId,
    timestamp: new Date().toISOString()
  });

  return res.json({
    success: true,
    code: 'CALL_CLAIMED',
    message: 'Llamada reclamada exitosamente',
    data: { callId, tabId }
  });
});

/**
 * POST /api/v1/calls/response
 * Callee accepts or declines incoming call.
 */
callsRouter.post('/response', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const calleeId = req.user!.id;
  const calleeTenantId = req.user!.tenantId;
  const { callerId, callId, roomId, accepted, reason, tabId } = req.body;

  if (!callerId || !callId) {
    return res.status(400).json({ success: false, message: 'callerId y callId son requeridos' });
  }

  // If accepting, ensure tab claim is validated
  if (accepted && tabId) {
    const existingClaim = activeCallClaims.get(callId);
    if (existingClaim && existingClaim.tabId !== tabId) {
      return res.status(409).json({
        success: false,
        code: 'CALL_ALREADY_CLAIMED',
        message: 'La llamada ya fue aceptada en otra pestaña'
      });
    }
    if (!existingClaim) {
      activeCallClaims.set(callId, { tabId, claimedAt: Date.now() });
    }
  }

  // Clear 30s timeout
  const timer = outgoingCallTimeouts.get(callId);
  if (timer) {
    clearTimeout(timer);
    outgoingCallTimeouts.delete(callId);
  }

  const now = new Date().toISOString();
  const call = db.getCall(callId);
  if (call) {
    if (accepted) {
      call.state = 'connecting';
      call.connectedAt = now;
    } else {
      call.state = 'ended';
      call.endReason = reason || 'declined';
      call.endedAt = now;
    }
    await db.persistCall(call);
  }

  // Audit in call history
  await db.persistCallHistory({
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    callId,
    tenantId: calleeTenantId,
    eventType: accepted ? 'accepted' : 'declined',
    userId: calleeId,
    metadata: { reason, tabId },
    createdAt: now
  });

  const callee = db.users.find(u => u.id === calleeId);
  const responsePayload = {
    callId,
    roomId,
    accepted: !!accepted,
    reason: reason || (accepted ? 'accepted' : 'declined'),
    callee: {
      id: calleeId,
      displayName: callee ? callee.displayName : 'Colaborador',
      avatarUrl: callee?.avatarUrl || ''
    },
    timestamp: now
  };

  realtimeHub.sendToUser(callerId, 'CallResponse', responsePayload);

  return res.json({ success: true, message: 'Respuesta de llamada procesada' });
});

/**
 * POST /api/v1/calls/cancel
 * Caller cancels call before callee answers.
 */
callsRouter.post('/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const callerId = req.user!.id;
  const callerTenantId = req.user!.tenantId;
  const { callId, targetUserId, roomId } = req.body;

  // Clear 30s timeout
  if (callId) {
    const timer = outgoingCallTimeouts.get(callId);
    if (timer) {
      clearTimeout(timer);
      outgoingCallTimeouts.delete(callId);
    }
  }

  const now = new Date().toISOString();
  if (callId) {
    const call = db.getCall(callId);
    if (call) {
      call.state = 'ended';
      call.endReason = 'cancelled';
      call.endedAt = now;
      await db.persistCall(call);
    }

    await db.persistCallHistory({
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      callId,
      tenantId: callerTenantId,
      eventType: 'cancelled',
      userId: callerId,
      metadata: { reason: 'User cancelled before answer' },
      createdAt: now
    });
  }

  const cancelPayload = {
    callId,
    roomId,
    callerId,
    reason: 'cancelled',
    timestamp: now
  };

  if (targetUserId) {
    realtimeHub.sendToUser(targetUserId, 'CallCancelled', cancelPayload);
  }
  if (roomId) {
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'CallCancelled', cancelPayload);
  }

  return res.json({ success: true, message: 'Llamada cancelada exitosamente' });
});

/**
 * POST /api/v1/calls/end
 * Explicitly terminates call session, calculates duration, cleans resources, updates PostgreSQL.
 */
callsRouter.post('/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;
  const { callId, roomId, targetUserId, reason } = req.body;

  const now = new Date().toISOString();
  let durationSeconds = 0;

  if (callId) {
    const timer = outgoingCallTimeouts.get(callId);
    if (timer) {
      clearTimeout(timer);
      outgoingCallTimeouts.delete(callId);
    }
    activeCallClaims.delete(callId);

    const call = db.getCall(callId);
    if (call) {
      call.state = 'ended';
      call.endReason = reason || 'completed';
      call.endedAt = now;
      if (call.connectedAt) {
        durationSeconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(call.connectedAt).getTime()) / 1000));
      } else if (call.startedAt) {
        durationSeconds = Math.max(0, Math.round((new Date(now).getTime() - new Date(call.startedAt).getTime()) / 1000));
      }
      call.durationSeconds = durationSeconds;
      await db.persistCall(call);
    }

    await db.persistCallHistory({
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      callId,
      tenantId,
      eventType: 'completed',
      userId,
      metadata: { reason: reason || 'completed', durationSeconds },
      createdAt: now
    });
  }

  const endPayload = {
    callId,
    roomId,
    endedBy: userId,
    durationSeconds,
    timestamp: now
  };

  if (targetUserId) {
    realtimeHub.sendToUser(targetUserId, 'CallEnded', endPayload);
  }
  if (roomId) {
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'CallEnded', endPayload);
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'WebRTCSignal', {
      senderId: userId,
      signalType: 'call-ended',
      roomId
    });
  }

  return res.json({ success: true, message: 'Llamada finalizada correctamente', data: { durationSeconds } });
});

/**
 * POST /api/v1/calls/signal
 * Centralized WebRTC signaling (offers, answers, ICE candidates, ICE restarts, state sync).
 */
callsRouter.post('/signal', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.id;
  const senderTenantId = req.user!.tenantId;
  const { targetUserId, roomId, signalType, data, callId } = req.body;

  if (!signalType) {
    return res.status(400).json({ success: false, message: 'signalType es requerido' });
  }

  // Cross-tenant protection for signaling
  if (targetUserId) {
    let targetUser = db.users.find(u => u.id === targetUserId);
    if (!targetUser) {
      try {
        const dbRes = await pool.query('SELECT id, tenant_id as "tenantId" FROM users WHERE id = $1', [targetUserId]);
        if (dbRes.rows.length > 0) targetUser = dbRes.rows[0];
      } catch (err: any) {
        console.warn('[CallEngine] DB lookup error:', err.message);
      }
    }

    if (targetUser && targetUser.tenantId !== senderTenantId) {
      return res.status(403).json({
        success: false,
        code: 'TENANT_MISMATCH',
        message: 'No autorizado para enviar señales a usuarios de otra organización'
      });
    }
  }

  const sender = db.users.find(u => u.id === senderId);
  const signalPayload = {
    callId,
    senderId,
    senderName: sender ? sender.displayName : (req.user!.email || 'Usuario'),
    senderAvatar: sender?.avatarUrl || '',
    signalType,
    data,
    roomId,
    timestamp: new Date().toISOString()
  };

  if (targetUserId) {
    realtimeHub.sendToUser(targetUserId, 'WebRTCSignal', signalPayload);
  } else if (roomId) {
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'WebRTCSignal', signalPayload);
  } else {
    return res.status(400).json({ success: false, message: 'Debe especificar targetUserId o roomId' });
  }

  return res.json({ success: true, message: 'Señal transmitida exitosamente' });
});

/**
 * GET /api/v1/calls/history
 * Returns user's call history.
 */
callsRouter.get('/history', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  const userCalls = db.calls
    .filter(c => c.tenantId === tenantId && (c.callerId === userId || c.calleeId === userId || c.participantIds?.includes(userId)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 100);

  return res.json({ success: true, data: userCalls });
});
