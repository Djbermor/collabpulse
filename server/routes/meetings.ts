import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';

export const meetingsRouter = Router();

// List meetings for active workspace
meetingsRouter.get('/', authenticate, requirePermission('meetings.join'), (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const tenantId = req.user!.tenantId;
  const meetings = db.meetings.filter(m => m.workspaceId === workspaceId && m.tenantId === tenantId);
  res.json({ success: true, data: meetings });
});

// Create / Start meeting room
meetingsRouter.post('/', authenticate, requirePermission('meetings.create'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { title } = req.body;

  const meetingCode = `meet-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 5)}`;
  const newMeeting = {
    id: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId,
    workspaceId,
    title: sanitizeText(title || `Reunión de ${user.firstName}`),
    meetingCode,
    isLive: true,
    hostId: user.id,
    participants: [
      {
        userId: user.id,
        userName: user.displayName || `${user.firstName} ${user.lastName}`,
        userAvatar: user.avatarUrl,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        joinedAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString()
  };

  db.meetings.unshift(newMeeting);
  await db.persistMeeting(newMeeting);

  db.logAudit(
    tenantId,
    user.id,
    user.displayName,
    'MEETING_STARTED',
    'Meeting',
    newMeeting.id,
    req.ip,
    { meetingCode },
    workspaceId
  );

  realtimeHub.broadcastToTenant(tenantId, 'MeetingStarted', newMeeting);

  res.status(201).json({ success: true, data: newMeeting });
});

// Join meeting
meetingsRouter.post('/:id/join', authenticate, requirePermission('meetings.join'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { id } = req.params;

  const meeting = db.meetings.find(m => m.id === id && m.workspaceId === workspaceId && m.tenantId === tenantId);
  if (!meeting) return res.status(404).json({ success: false, message: 'Reunión no encontrada' });

  const existing = meeting.participants.find(p => p.userId === user.id);
  if (!existing) {
    meeting.participants.push({
      userId: user.id,
      userName: user.displayName || `${user.firstName} ${user.lastName}`,
      userAvatar: user.avatarUrl,
      isAudioMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      joinedAt: new Date().toISOString()
    });
  }

  realtimeHub.broadcastToTenant(tenantId, 'MeetingParticipantJoined', {
    meetingId: id,
    participant: meeting.participants.find(p => p.userId === user.id)
  });

  res.json({ success: true, data: meeting });
});

// Update media controls (mic, cam, screenshare)
meetingsRouter.post('/:id/media', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { id } = req.params;
  const { isAudioMuted, isVideoOff, isScreenSharing } = req.body;

  const meeting = db.meetings.find(m => m.id === id && m.workspaceId === workspaceId && m.tenantId === tenantId);
  if (!meeting) return res.status(404).json({ success: false, message: 'Reunión no encontrada' });

  const participant = meeting.participants.find(p => p.userId === user.id);
  if (participant) {
    if (isAudioMuted !== undefined) participant.isAudioMuted = isAudioMuted;
    if (isVideoOff !== undefined) participant.isVideoOff = isVideoOff;
    if (isScreenSharing !== undefined) participant.isScreenSharing = isScreenSharing;

    realtimeHub.broadcastToTenant(tenantId, 'MeetingMediaChanged', { meetingId: id, participant });
  }

  res.json({ success: true, data: meeting });
});

// Leave meeting
meetingsRouter.post('/:id/leave', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { id } = req.params;

  const meeting = db.meetings.find(m => m.id === id && m.workspaceId === workspaceId && m.tenantId === tenantId);
  if (meeting) {
    meeting.participants = meeting.participants.filter(p => p.userId !== user.id);
    if (meeting.participants.length === 0) {
      meeting.isLive = false;
    }
    realtimeHub.broadcastToTenant(tenantId, 'MeetingParticipantLeft', { meetingId: id, userId: user.id });
  }

  res.json({ success: true });
});

// End meeting
meetingsRouter.post('/:id/end', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { id } = req.params;

  const meeting = db.meetings.find(m => m.id === id && m.workspaceId === workspaceId && m.tenantId === tenantId);
  if (!meeting) return res.status(404).json({ success: false, message: 'Reunión no encontrada' });

  meeting.isLive = false;
  meeting.participants = [];
  await db.persistMeeting(meeting);

  realtimeHub.broadcastToTenant(tenantId, 'MeetingEnded', { meetingId: id });
  res.json({ success: true, message: 'Reunión finalizada', data: meeting });
});
