import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware';

export const notificationsRouter = Router();

// List notifications for authenticated user
notificationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  const notifications = db.notifications.filter(n => n.tenantId === tenantId && n.userId === userId);
  res.json({ success: true, data: notifications });
});

// Mark single notification read
notificationsRouter.post('/:id/read', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;
  const { id } = req.params;

  const notif = db.notifications.find(n => n.id === id && n.tenantId === tenantId && n.userId === userId);
  if (notif) {
    notif.isRead = true;
    await db.markNotificationRead(id);
  }

  res.json({ success: true, data: notif });
});

// Mark all read
notificationsRouter.post('/read-all', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const userId = req.user!.id;

  db.notifications.filter(n => n.tenantId === tenantId && n.userId === userId).forEach(n => {
    n.isRead = true;
  });
  await db.markAllNotificationsRead(tenantId, userId);

  res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
});

