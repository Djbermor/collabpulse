import { Router, Response } from 'express';
import { db } from '../db';
import { realtimeHub } from '../realtime';
import { authenticate, requirePermission, AuthenticatedRequest } from '../middleware';
import { sanitizeText } from '../security';

export const tasksRouter = Router();

// List tasks for workspace
tasksRouter.get('/', authenticate, requirePermission('tasks.read'), (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.workspace!.id;
  const tenantId = req.user!.tenantId;
  const { status, priority, assignedTo } = req.query;

  let tasks = db.tasks.filter(t => t.workspaceId === workspaceId && t.tenantId === tenantId);

  if (status) tasks = tasks.filter(t => t.status === status);
  if (priority) tasks = tasks.filter(t => t.priority === priority);
  if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);

  res.json({ success: true, data: tasks });
});

// Create task
tasksRouter.post('/', authenticate, requirePermission('tasks.create'), async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const tenantId = user.tenantId;
  const workspaceId = req.workspace!.id;
  const { title, description, priority = 'Medium', assignedTo, dueDate } = req.body;

  if (!title || title.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'El título de la tarea es requerido', code: 'INVALID_TITLE' });
  }

  const assignedUser = assignedTo ? db.users.find(u => u.id === assignedTo && u.tenantId === tenantId) : undefined;

  const newTask = {
    id: `task-${Date.now()}`,
    tenantId,
    workspaceId,
    title: sanitizeText(title),
    description: sanitizeText(description || ''),
    status: 'Pending' as const,
    priority: priority as any,
    assignedTo: assignedTo || undefined,
    assignedUserName: assignedUser ? assignedUser.displayName || `${assignedUser.firstName} ${assignedUser.lastName}` : undefined,
    assignedUserAvatar: assignedUser?.avatarUrl,
    createdBy: user.id,
    dueDate: dueDate || undefined,
    commentsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tasks.unshift(newTask);
  await db.persistTask(newTask);

  if (assignedTo && assignedTo !== user.id) {
    const notif = {
      id: `notif-${Date.now()}`,
      tenantId,
      userId: assignedTo,
      type: 'TaskAssigned' as const,
      title: 'Nueva tarea asignada',
      message: `${user.displayName || user.firstName} te ha asignado la tarea: "${newTask.title}"`,
      linkUrl: '/tasks',
      isRead: false,
      createdAt: new Date().toISOString()
    };
    db.notifications.unshift(notif);
    realtimeHub.sendToUser(assignedTo, 'NotificationReceived', notif);
  }

  realtimeHub.broadcastToTenant(tenantId, 'TaskCreated', newTask);

  res.status(201).json({ success: true, data: newTask });
});

const updateTaskHandler = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const workspaceId = req.workspace!.id;
  const { title, description, status, priority, assignedTo, dueDate } = req.body;

  const task = db.tasks.find(t => t.id === id && t.workspaceId === workspaceId);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Tarea no encontrada en este workspace' });
  }

  if (title !== undefined) task.title = sanitizeText(title);
  if (description !== undefined) task.description = sanitizeText(description);
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate;

  if (assignedTo !== undefined) {
    task.assignedTo = assignedTo;
    const assignedUser = db.users.find(u => u.id === assignedTo);
    task.assignedUserName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : undefined;
    task.assignedUserAvatar = assignedUser?.avatarUrl;
  }

  task.updatedAt = new Date().toISOString();
  await db.persistTaskUpdate(id, task);

  realtimeHub.broadcastToTenant(req.user!.tenantId, 'TaskUpdated', task);

  res.json({ success: true, data: task });
};

tasksRouter.put('/:id', authenticate, requirePermission('tasks.update'), updateTaskHandler);
tasksRouter.patch('/:id', authenticate, requirePermission('tasks.update'), updateTaskHandler);

// Delete task
tasksRouter.delete('/:id', authenticate, requirePermission('tasks.delete'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const workspaceId = req.workspace!.id;

  const idx = db.tasks.findIndex(t => t.id === id && t.workspaceId === workspaceId);
  if (idx < 0) return res.status(404).json({ success: false, message: 'Tarea no encontrada' });

  db.tasks.splice(idx, 1);
  await db.deleteTask(id);
  realtimeHub.broadcastToTenant(req.user!.tenantId, 'TaskDeleted', { taskId: id });

  res.json({ success: true, message: 'Tarea eliminada' });
});

// Get task comments
tasksRouter.get('/:id/comments', authenticate, requirePermission('tasks.read'), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const comments = db.taskComments.filter(c => c.taskId === id);
  res.json({ success: true, data: comments });
});

// Add comment to task
tasksRouter.post('/:id/comments', authenticate, requirePermission('tasks.update'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;
  const user = req.user!;

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'El contenido del comentario es requerido' });
  }

  const task = db.tasks.find(t => t.id === id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Tarea no encontrada' });
  }

  const newComment = {
    id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    taskId: id,
    userId: user.id,
    userName: user.displayName || `${user.firstName} ${user.lastName}`,
    userAvatar: user.avatarUrl || '',
    content: sanitizeText(content.trim()),
    createdAt: new Date().toISOString()
  };

  db.taskComments.push(newComment);
  task.commentsCount = (task.commentsCount || 0) + 1;
  await db.persistTaskComment(newComment);

  realtimeHub.broadcastToTenant(user.tenantId, 'TaskCommentAdded', { taskId: id, comment: newComment });

  res.status(201).json({ success: true, data: newComment });
});

// Delete comment from task
tasksRouter.delete('/:id/comments/:commentId', authenticate, requirePermission('tasks.update'), async (req: AuthenticatedRequest, res: Response) => {
  const { id, commentId } = req.params;
  const user = req.user!;

  const idx = db.taskComments.findIndex(c => c.id === commentId && c.taskId === id);
  if (idx < 0) {
    return res.status(404).json({ success: false, message: 'Comentario no encontrado' });
  }

  const comment = db.taskComments[idx];
  const isAuthor = comment.userId === user.id;
  const isPrivileged = req.member?.role === 'Owner' || req.member?.role === 'Admin';
  if (!isAuthor && !isPrivileged) {
    return res.status(403).json({ success: false, message: 'No tiene permiso para eliminar este comentario' });
  }

  db.taskComments.splice(idx, 1);
  const task = db.tasks.find(t => t.id === id);
  if (task && task.commentsCount > 0) {
    task.commentsCount -= 1;
  }
  await db.deleteTaskComment(commentId);

  realtimeHub.broadcastToTenant(user.tenantId, 'TaskCommentDeleted', { taskId: id, commentId });

  res.json({ success: true, message: 'Comentario eliminado' });
});
