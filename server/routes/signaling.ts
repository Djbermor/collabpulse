import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, AuthenticatedRequest } from '../middleware';

export const signalingRouter = Router();

/**
 * POST /api/v1/realtime/signal
 * Dispatches WebRTC signaling messages (offers, answers, ICE candidates, call states)
 */
signalingRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const senderId = req.user!.id;
  const { targetUserId, roomId, signalType, data } = req.body;

  if (!signalType) {
    return res.status(400).json({ success: false, message: 'signalType es requerido' });
  }

  const sender = db.users.find(u => u.id === senderId);
  const senderName = sender ? sender.displayName : (req.user!.email || 'Usuario');
  const senderAvatar = sender?.avatarUrl || '';

  const signalPayload = {
    senderId,
    senderName,
    senderAvatar,
    signalType,
    data,
    roomId,
    timestamp: new Date().toISOString()
  };

  if (targetUserId) {
    // 1:1 direct signaling
    realtimeHub.sendToUser(targetUserId, 'WebRTCSignal', signalPayload);
  } else if (roomId) {
    // Room broadcast
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'WebRTCSignal', signalPayload);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Debe especificar targetUserId o roomId'
    });
  }

  return res.json({ success: true, message: 'Señal transmitida exitosamente' });
});

/**
 * POST /api/v1/realtime/call/invite
 * Sends an incoming call ring notification to target user(s), conversation, or channel
 */
signalingRouter.post('/call/invite', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const callerId = req.user!.id;
  const { targetUserId, conversationId, channelId, roomId: customRoomId, isVideo = true, title } = req.body;

  const caller = db.users.find(u => u.id === callerId);
  const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const roomId = customRoomId || `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const invitePayload = {
    callId,
    roomId,
    conversationId,
    channelId,
    title: title || (isVideo ? 'Videollamada' : 'Llamada de voz'),
    isVideo: !!isVideo,
    callType: isVideo ? 'video' : 'audio',
    caller: {
      id: callerId,
      displayName: caller ? caller.displayName : 'Colaborador',
      avatarUrl: caller?.avatarUrl || '',
      jobTitle: caller?.jobTitle || ''
    },
    timestamp: new Date().toISOString()
  };

  // Register meeting in db if not exists
  let meeting = db.meetings.find(m => m.id === roomId || m.meetingCode === roomId);
  if (!meeting) {
    meeting = {
      id: roomId,
      tenantId: req.user!.tenantId,
      workspaceId: req.workspace?.id || 'ws-default',
      title: invitePayload.title,
      meetingCode: roomId,
      isLive: true,
      hostId: callerId,
      createdAt: new Date().toISOString(),
      participants: [{
        userId: callerId,
        userName: caller ? caller.displayName : 'Colaborador',
        userAvatar: caller?.avatarUrl || '',
        isAudioMuted: false,
        isVideoOff: !isVideo,
        isScreenSharing: false,
        joinedAt: new Date().toISOString()
      }]
    };
    db.meetings.push(meeting);
    await db.persistMeeting(meeting);
  } else {
    meeting.isLive = true;
    if (!meeting.participants.some(p => p.userId === callerId)) {
      meeting.participants.push({
        userId: callerId,
        userName: caller ? caller.displayName : 'Colaborador',
        userAvatar: caller?.avatarUrl || '',
        isAudioMuted: false,
        isVideoOff: !isVideo,
        isScreenSharing: false,
        joinedAt: new Date().toISOString()
      });
    }
  }

  if (targetUserId) {
    // 1:1 Direct call
    realtimeHub.sendToUser(targetUserId, 'IncomingCall', invitePayload);
  } else if (conversationId) {
    // Direct or Group Conversation call
    const conv = db.conversations.find(c => c.id === conversationId);
    if (conv && conv.memberIds) {
      for (const memberId of conv.memberIds) {
        if (memberId !== callerId) {
          realtimeHub.sendToUser(memberId, 'IncomingCall', invitePayload);
        }
      }
    }
  } else if (channelId) {
    // Channel call
    const members = db.channelMembers.filter(m => m.channelId === channelId);
    for (const m of members) {
      if (m.userId !== callerId) {
        realtimeHub.sendToUser(m.userId, 'IncomingCall', invitePayload);
      }
    }
    realtimeHub.broadcastToGroup(`channel:${channelId}`, 'IncomingCall', invitePayload);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Debe especificar targetUserId, conversationId o channelId'
    });
  }

  return res.json({ success: true, data: { callId, roomId, isVideo } });
});

/**
 * POST /api/v1/realtime/call/cancel
 * Caller cancels the call before callee answers (or timeout)
 */
signalingRouter.post('/call/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const callerId = req.user!.id;
  const { callId, targetUserId, conversationId, channelId, roomId } = req.body;

  const cancelPayload = {
    callId,
    roomId,
    callerId,
    reason: 'cancelled',
    timestamp: new Date().toISOString()
  };

  if (targetUserId) {
    realtimeHub.sendToUser(targetUserId, 'CallCancelled', cancelPayload);
  }
  if (conversationId) {
    const conv = db.conversations.find(c => c.id === conversationId);
    if (conv && conv.memberIds) {
      for (const memberId of conv.memberIds) {
        if (memberId !== callerId) {
          realtimeHub.sendToUser(memberId, 'CallCancelled', cancelPayload);
        }
      }
    }
  }
  if (channelId) {
    realtimeHub.broadcastToGroup(`channel:${channelId}`, 'CallCancelled', cancelPayload);
  }
  if (roomId) {
    realtimeHub.broadcastToGroup(`meeting:${roomId}`, 'CallCancelled', cancelPayload);
    // End meeting if empty
    const meeting = db.meetings.find(m => m.id === roomId || m.meetingCode === roomId);
    if (meeting) {
      meeting.isLive = false;
      meeting.participants = [];
      await db.persistMeeting(meeting);
    }
  }

  return res.json({ success: true, message: 'Llamada cancelada exitosamente' });
});

/**
 * POST /api/v1/realtime/call/response
 * Callee responds to an incoming call (accepted or rejected)
 */
signalingRouter.post('/call/response', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const calleeId = req.user!.id;
  const { callerId, callId, roomId, accepted, reason } = req.body;

  if (!callerId || !callId) {
    return res.status(400).json({ success: false, message: 'callerId y callId son requeridos' });
  }

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
    timestamp: new Date().toISOString()
  };

  realtimeHub.sendToUser(callerId, 'CallResponse', responsePayload);

  return res.json({ success: true, message: 'Respuesta de llamada enviada' });
});

/**
 * POST /api/v1/realtime/call/end
 * Ends the call, notifies all peers, closes media tracks, and terminates meeting
 */
signalingRouter.post('/call/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { roomId, targetUserId, callId } = req.body;

  const endPayload = {
    callId,
    roomId,
    endedBy: userId,
    timestamp: new Date().toISOString()
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

    // Mark meeting inactive and persist
    const meeting = db.meetings.find(m => m.id === roomId || m.meetingCode === roomId);
    if (meeting) {
      meeting.isLive = false;
      meeting.participants = [];
      await db.persistMeeting(meeting);
    }
  }

  return res.json({ success: true, message: 'Llamada finalizada correctamente' });
});
