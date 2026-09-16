import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';

export const calendarRouter = Router();

// List events for active workspace
calendarRouter.get(['/', '/events'], authenticate, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const tenantId = req.user!.tenantId;
  const events = db.calendarEvents.filter(e => e.workspaceId === workspaceId && e.tenantId === tenantId);
  res.json({ success: true, data: events });
});

// Create event
calendarRouter.post(['/', '/events'], authenticate, requirePermission('calendar.manage'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { title, description, startAt, endAt, startDate, endDate, location, attendees = [] } = req.body;

  const actualStart = startAt || startDate;
  const actualEnd = endAt || endDate;

  if (!title || !actualStart || !actualEnd) {
    return res.status(400).json({ success: false, message: 'Título, fecha de inicio y fecha de término son requeridos' });
  }

  const newEvent = {
    id: `evt-${Date.now()}`,
    tenantId,
    workspaceId,
    title: sanitizeText(title),
    description: sanitizeText(description || ''),
    startAt: actualStart,
    endAt: actualEnd,
    location: sanitizeText(location || ''),
    createdBy: user.id,
    attendees: Array.isArray(attendees) ? attendees : [user.id],
    createdAt: new Date().toISOString()
  };

  db.calendarEvents.push(newEvent);
  await db.persistCalendarEvent(newEvent);

  db.logAudit(
    tenantId,
    user.id,
    user.displayName,
    'CALENDAR_EVENT_CREATED',
    'CalendarEvent',
    newEvent.id,
    req.ip,
    { title: newEvent.title },
    workspaceId
  );

  res.status(201).json({ success: true, data: newEvent });
});

// Update event
const updateCalendarEventHandler = async (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const { id } = req.params;
  const { title, description, startAt, endAt, startDate, endDate, location } = req.body;

  const event = db.calendarEvents.find(e => e.id === id && e.workspaceId === workspaceId);
  if (!event) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

  if (title !== undefined) event.title = sanitizeText(title);
  if (description !== undefined) event.description = sanitizeText(description);
  if (location !== undefined) event.location = sanitizeText(location);
  if (startAt || startDate) event.startAt = startAt || startDate;
  if (endAt || endDate) event.endAt = endAt || endDate;

  await db.persistCalendarEventUpdate(id, event);

  res.json({ success: true, data: event });
};

calendarRouter.put(['/:id', '/events/:id'], authenticate, requirePermission('calendar.manage'), updateCalendarEventHandler);
calendarRouter.patch(['/:id', '/events/:id'], authenticate, requirePermission('calendar.manage'), updateCalendarEventHandler);

// Delete event
calendarRouter.delete(['/:id', '/events/:id'], authenticate, requirePermission('calendar.manage'), async (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const { id } = req.params;

  const idx = db.calendarEvents.findIndex(e => e.id === id && e.workspaceId === workspaceId);
  if (idx < 0) return res.status(404).json({ success: false, message: 'Evento no encontrado' });

  db.calendarEvents.splice(idx, 1);
  await db.deleteCalendarEvent(id);
  res.json({ success: true, message: 'Evento eliminado' });
});
