import { eq, and, or, desc, asc, isNull } from 'drizzle-orm';
import { db } from './index.ts';
import {
  tenants,
  users,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  channels,
  channelMembers,
  conversations,
  conversationMembers,
  messages,
  messageReactions,
  pinnedMessages,
  savedMessages,
  tasks,
  calendarEvents,
  meetings,
  files,
  auditLogs,
  userSessions,
  emailVerificationTokens,
  passwordResetTokens
} from './schema.ts';

// 1. TENANTS REPOSITORY
export async function getTenants() {
  return await db.select().from(tenants);
}

export async function getTenantById(id: string) {
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] || null;
}

export async function createTenant(data: typeof tenants.$inferInsert) {
  const result = await db.insert(tenants).values(data).returning();
  return result[0];
}

// 2. USERS REPOSITORY
export async function getUsers(tenantId?: string) {
  if (tenantId) {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  }
  return await db.select().from(users);
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByUid(uid: string) {
  const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
  return result[0] || null;
}

export async function getUserByEmailOrUsername(identifier: string) {
  const normalized = identifier.toLowerCase().trim();
  const result = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.normalizedEmail, normalized),
        eq(users.email, identifier),
        eq(users.normalizedUserName, normalized),
        eq(users.userName, identifier)
      )
    )
    .limit(1);
  return result[0] || null;
}

export async function createUser(userData: typeof users.$inferInsert) {
  const result = await db.insert(users).values(userData).returning();
  return result[0];
}

export async function updateUser(id: string, updateData: Partial<typeof users.$inferInsert>) {
  const result = await db
    .update(users)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

export async function deleteUser(id: string) {
  const result = await db
    .update(users)
    .set({ deletedAt: new Date(), isActive: false })
    .where(eq(users.id, id))
    .returning();
  return result[0];
}

export async function getOrCreateFirebaseUser(uid: string, email: string, displayName?: string, photoURL?: string) {
  const existing = await getUserByUid(uid);
  if (existing) {
    return existing;
  }

  const primaryTenant = (await db.select().from(tenants).limit(1))[0];
  const tenantId = primaryTenant ? primaryTenant.id : '';

  const cleanName = displayName || (email ? email.split('@')[0] : 'User');
  const parts = cleanName.split(' ');
  const firstName = parts[0] || 'User';
  const lastName = parts.slice(1).join(' ') || '';
  const userName = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.') || `user.${Date.now().toString(36)}`).substring(0, 50);

  const newUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    tenantId,
    uid,
    email: email || null,
    normalizedEmail: email ? email.toLowerCase() : null,
    userName,
    normalizedUserName: userName.toLowerCase(),
    firstName,
    lastName,
    displayName: cleanName,
    avatarUrl: photoURL || '',
    role: 'Member',
    accountStatus: 'Active',
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const inserted = await db.insert(users).values(newUser).returning();
  return inserted[0];
}

// 3. WORKSPACES REPOSITORY
export async function getWorkspaces(tenantId?: string) {
  if (tenantId) {
    return await db.select().from(workspaces).where(eq(workspaces.tenantId, tenantId));
  }
  return await db.select().from(workspaces);
}

export async function getWorkspaceById(id: string) {
  const result = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return result[0] || null;
}

export async function getWorkspaceBySlug(slug: string, tenantId?: string) {
  if (tenantId) {
    const result = await db.select().from(workspaces).where(and(eq(workspaces.slug, slug), eq(workspaces.tenantId, tenantId))).limit(1);
    return result[0] || null;
  }
  const result = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return result[0] || null;
}

export async function createWorkspace(workspaceData: typeof workspaces.$inferInsert) {
  const result = await db.insert(workspaces).values(workspaceData).returning();
  return result[0];
}

export async function updateWorkspace(id: string, updateData: Partial<typeof workspaces.$inferInsert>) {
  const result = await db
    .update(workspaces)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(workspaces.id, id))
    .returning();
  return result[0];
}

// 4. WORKSPACE MEMBERS REPOSITORY
export async function getWorkspaceMembers(workspaceId: string) {
  return await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function getWorkspaceMember(workspaceId: string, userId: string) {
  const result = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return result[0] || null;
}

export async function addWorkspaceMember(memberData: typeof workspaceMembers.$inferInsert) {
  const result = await db.insert(workspaceMembers).values(memberData).returning();
  return result[0];
}

export async function updateWorkspaceMemberRole(id: string, role: string) {
  const result = await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, id)).returning();
  return result[0];
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  return await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

// 5. CHANNELS REPOSITORY
export async function getChannels(workspaceId: string) {
  return await db.select().from(channels).where(eq(channels.workspaceId, workspaceId));
}

export async function getChannelById(id: string) {
  const result = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  return result[0] || null;
}

export async function createChannel(channelData: typeof channels.$inferInsert) {
  const result = await db.insert(channels).values(channelData).returning();
  return result[0];
}

export async function updateChannel(id: string, updateData: Partial<typeof channels.$inferInsert>) {
  const result = await db
    .update(channels)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(channels.id, id))
    .returning();
  return result[0];
}

export async function archiveChannel(id: string) {
  const result = await db
    .update(channels)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(channels.id, id))
    .returning();
  return result[0];
}

// 6. CHANNEL MEMBERS REPOSITORY
export async function getChannelMembers(channelId: string) {
  return await db.select().from(channelMembers).where(eq(channelMembers.channelId, channelId));
}

export async function isChannelMember(channelId: string, userId: string) {
  const result = await db
    .select()
    .from(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function addChannelMember(memberData: typeof channelMembers.$inferInsert) {
  const result = await db.insert(channelMembers).values(memberData).returning();
  return result[0];
}

export async function removeChannelMember(channelId: string, userId: string) {
  return await db
    .delete(channelMembers)
    .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
}

// 7. CONVERSATIONS REPOSITORY
export async function getConversations(workspaceId: string) {
  return await db.select().from(conversations).where(eq(conversations.workspaceId, workspaceId));
}

export async function getConversationById(id: string) {
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0] || null;
}

export async function createConversation(convData: typeof conversations.$inferInsert) {
  const result = await db.insert(conversations).values(convData).returning();
  return result[0];
}

export async function getConversationMembers(conversationId: string) {
  return await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId));
}

export async function addConversationMember(memberData: typeof conversationMembers.$inferInsert) {
  const result = await db.insert(conversationMembers).values(memberData).returning();
  return result[0];
}

// 8. MESSAGES REPOSITORY
export async function getMessages(options: { workspaceId: string; channelId?: string; conversationId?: string; parentMessageId?: string | null }) {
  const conditions = [eq(messages.workspaceId, options.workspaceId), isNull(messages.deletedAt)];

  if (options.channelId) {
    conditions.push(eq(messages.channelId, options.channelId));
  }
  if (options.conversationId) {
    conditions.push(eq(messages.conversationId, options.conversationId));
  }
  if (options.parentMessageId !== undefined) {
    if (options.parentMessageId === null) {
      conditions.push(isNull(messages.parentMessageId));
    } else {
      conditions.push(eq(messages.parentMessageId, options.parentMessageId));
    }
  }

  return await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(asc(messages.createdAt));
}

export async function getMessageById(id: string) {
  const result = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  return result[0] || null;
}

export async function createMessage(messageData: typeof messages.$inferInsert) {
  const result = await db.insert(messages).values(messageData).returning();
  return result[0];
}

export async function updateMessage(id: string, updateData: Partial<typeof messages.$inferInsert>) {
  const result = await db
    .update(messages)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(messages.id, id))
    .returning();
  return result[0];
}

export async function deleteMessage(id: string) {
  const result = await db
    .update(messages)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(messages.id, id))
    .returning();
  return result[0];
}

// 9. MESSAGE REACTIONS REPOSITORY
export async function getReactions(messageId: string) {
  return await db.select().from(messageReactions).where(eq(messageReactions.messageId, messageId));
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const existing = await db
    .select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(messageReactions).where(eq(messageReactions.id, existing[0].id));
    return { added: false, id: existing[0].id };
  } else {
    const id = `rx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const inserted = await db
      .insert(messageReactions)
      .values({
        id,
        messageId,
        userId,
        emoji,
        createdAt: new Date(),
      })
      .returning();
    return { added: true, reaction: inserted[0] };
  }
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  return await db
    .delete(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      )
    );
}

// 10. PINNED & SAVED MESSAGES REPOSITORY
export async function getPinnedMessages(workspaceId: string, channelId?: string) {
  if (channelId) {
    return await db.select().from(pinnedMessages).where(eq(pinnedMessages.channelId, channelId));
  }
  return await db.select().from(pinnedMessages);
}

export async function pinMessage(data: typeof pinnedMessages.$inferInsert) {
  const result = await db.insert(pinnedMessages).values(data).returning();
  return result[0];
}

export async function unpinMessage(messageId: string) {
  return await db.delete(pinnedMessages).where(eq(pinnedMessages.messageId, messageId));
}

export async function getSavedMessages(userId: string) {
  return await db.select().from(savedMessages).where(eq(savedMessages.userId, userId));
}

export async function saveMessage(data: typeof savedMessages.$inferInsert) {
  const result = await db.insert(savedMessages).values(data).returning();
  return result[0];
}

export async function unsaveMessage(messageId: string, userId: string) {
  return await db.delete(savedMessages).where(and(eq(savedMessages.messageId, messageId), eq(savedMessages.userId, userId)));
}

// 11. TASKS REPOSITORY
export async function getTasks(workspaceId: string) {
  return await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: string) {
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] || null;
}

export async function createTask(taskData: typeof tasks.$inferInsert) {
  const result = await db.insert(tasks).values(taskData).returning();
  return result[0];
}

export async function updateTask(id: string, updateData: Partial<typeof tasks.$inferInsert>) {
  const result = await db
    .update(tasks)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return result[0];
}

export async function deleteTask(id: string) {
  return await db.delete(tasks).where(eq(tasks.id, id));
}

// 12. CALENDAR EVENTS REPOSITORY
export async function getCalendarEvents(workspaceId: string) {
  return await db.select().from(calendarEvents).where(eq(calendarEvents.workspaceId, workspaceId)).orderBy(asc(calendarEvents.startDate));
}

export async function getCalendarEventById(id: string) {
  const result = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id)).limit(1);
  return result[0] || null;
}

export async function createCalendarEvent(eventData: typeof calendarEvents.$inferInsert) {
  const result = await db.insert(calendarEvents).values(eventData).returning();
  return result[0];
}

export async function updateCalendarEvent(id: string, updateData: Partial<typeof calendarEvents.$inferInsert>) {
  const result = await db
    .update(calendarEvents)
    .set(updateData)
    .where(eq(calendarEvents.id, id))
    .returning();
  return result[0];
}

export async function deleteCalendarEvent(id: string) {
  return await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

// 13. MEETINGS REPOSITORY
export async function getMeetings(workspaceId: string) {
  return await db.select().from(meetings).where(eq(meetings.workspaceId, workspaceId)).orderBy(desc(meetings.startedAt));
}

export async function getMeetingById(id: string) {
  const result = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  return result[0] || null;
}

export async function createMeeting(meetingData: typeof meetings.$inferInsert) {
  const result = await db.insert(meetings).values(meetingData).returning();
  return result[0];
}

export async function updateMeeting(id: string, updateData: Partial<typeof meetings.$inferInsert>) {
  const result = await db
    .update(meetings)
    .set(updateData)
    .where(eq(meetings.id, id))
    .returning();
  return result[0];
}

// 14. FILES REPOSITORY
export async function getFiles(workspaceId: string) {
  return await db.select().from(files).where(eq(files.workspaceId, workspaceId)).orderBy(desc(files.createdAt));
}

export async function createFile(fileData: typeof files.$inferInsert) {
  const result = await db.insert(files).values(fileData).returning();
  return result[0];
}

export async function deleteFile(id: string) {
  return await db.delete(files).where(eq(files.id, id));
}

// 15. AUDIT LOGS REPOSITORY
export async function getAuditLogs(tenantId: string) {
  return await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).orderBy(desc(auditLogs.createdAt)).limit(100);
}

export async function createAuditLog(logData: typeof auditLogs.$inferInsert) {
  const result = await db.insert(auditLogs).values(logData).returning();
  return result[0];
}

// 16. USER SESSIONS & REFRESH TOKENS REPOSITORY
export async function createSession(sessionData: typeof userSessions.$inferInsert) {
  const result = await db.insert(userSessions).values(sessionData).returning();
  return result[0];
}

export async function getSessionByToken(token: string) {
  const result = await db
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.token, token), eq(userSessions.isActive, true)))
    .limit(1);
  return result[0] || null;
}

export async function getSessionByRefreshToken(refreshToken: string) {
  const result = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.refreshToken, refreshToken))
    .limit(1);
  return result[0] || null;
}

export async function revokeSession(id: string) {
  return await db
    .update(userSessions)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(userSessions.id, id))
    .returning();
}

export async function revokeAllUserSessions(userId: string) {
  return await db
    .update(userSessions)
    .set({ isActive: false, revokedAt: new Date() })
    .where(eq(userSessions.userId, userId))
    .returning();
}

// 17. EMAIL VERIFICATION TOKENS REPOSITORY
export async function createEmailVerificationToken(data: typeof emailVerificationTokens.$inferInsert) {
  const result = await db.insert(emailVerificationTokens).values(data).returning();
  return result[0];
}

export async function getEmailVerificationToken(token: string) {
  const result = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);
  return result[0] || null;
}

export async function markEmailVerificationTokenUsed(id: string) {
  return await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.id, id))
    .returning();
}

// 18. PASSWORD RESET TOKENS REPOSITORY
export async function createPasswordResetToken(data: typeof passwordResetTokens.$inferInsert) {
  const result = await db.insert(passwordResetTokens).values(data).returning();
  return result[0];
}

export async function getPasswordResetToken(token: string) {
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  return result[0] || null;
}

export async function markPasswordResetTokenUsed(id: string) {
  return await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, id))
    .returning();
}
