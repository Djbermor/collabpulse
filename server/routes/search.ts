import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, AuthenticatedRequest } from '../middleware';

export const searchRouter = Router();

// Global tenant search
searchRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user!.tenantId;
  const workspaceId = req.workspace!.id;
  const q = ((req.query.q as string) || '').trim();

  if (!q) {
    return res.json({
      success: true,
      data: {
        messages: [],
        channels: [],
        tasks: [],
        files: [],
        users: []
      }
    });
  }

  let cleanQuery = q;
  let filterFrom: string | null = null;
  let filterIn: string | null = null;
  let filterHasFile = false;

  const fromMatch = q.match(/from:([a-zA-Z0-9_-]+)/i);
  if (fromMatch) {
    filterFrom = fromMatch[1].toLowerCase();
    cleanQuery = cleanQuery.replace(fromMatch[0], '').trim();
  }

  const inMatch = q.match(/in:([a-zA-Z0-9_-]+)/i);
  if (inMatch) {
    filterIn = inMatch[1].toLowerCase();
    cleanQuery = cleanQuery.replace(inMatch[0], '').trim();
  }

  const hasMatch = q.match(/has:(file|image)/i);
  if (hasMatch) {
    filterHasFile = true;
    cleanQuery = cleanQuery.replace(hasMatch[0], '').trim();
  }

  const normalizeStr = (str: string = '') =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const term = normalizeStr(cleanQuery);

  // Search messages in tenant & accessible channels
  const matchedMessages = db.messages
    .filter(m => m.tenantId === tenantId && !m.isDeleted)
    .filter(m => {
      if (filterFrom && !normalizeStr(m.senderName).includes(filterFrom)) return false;
      if (filterHasFile && (!m.attachments || m.attachments.length === 0)) return false;
      if (filterIn) {
        const channel = db.channels.find(c => c.id === m.channelId);
        if (!channel || !normalizeStr(channel.name).includes(filterIn)) return false;
      }
      if (term) {
        return normalizeStr(m.content).includes(term);
      }
      return true;
    })
    .slice(0, 15);

  // Search channels in workspace
  const matchedChannels = db.channels
    .filter(c => c.workspaceId === workspaceId && c.tenantId === tenantId && !c.isArchived)
    .filter(c => normalizeStr(c.name).includes(term) || normalizeStr(c.description).includes(term))
    .slice(0, 6);

  // Search tasks in workspace
  const matchedTasks = db.tasks
    .filter(t => t.workspaceId === workspaceId && t.tenantId === tenantId)
    .filter(t => normalizeStr(t.title).includes(term) || normalizeStr(t.description).includes(term))
    .slice(0, 6);

  // Search files in workspace
  const matchedFiles = db.files
    .filter(f => f.workspaceId === workspaceId && f.tenantId === tenantId)
    .filter(f => normalizeStr(f.name).includes(term))
    .slice(0, 6);

  // Search active tenant users
  const matchedUsers = db.users
    .filter(u => u.tenantId === tenantId && u.accountStatus === 'Active')
    .filter(u => normalizeStr(`${u.firstName} ${u.lastName}`).includes(term) || normalizeStr(u.email).includes(term) || (u.jobTitle && normalizeStr(u.jobTitle).includes(term)))
    .slice(0, 6);

  res.json({
    success: true,
    data: {
      query: q,
      parsedFilters: { from: filterFrom, in: filterIn, hasFile: filterHasFile },
      messages: matchedMessages,
      channels: matchedChannels,
      tasks: matchedTasks,
      files: matchedFiles,
      users: matchedUsers
    }
  });

});
