import { Response } from 'express';
import { db } from './db';

interface ConnectedClient {
  id: string;
  tenantId: string;
  userId: string;
  workspaceId?: string;
  groups: Set<string>;
  res: Response;
  lastPing: number;
}

class RealtimeHub {
  private clients: Map<string, ConnectedClient> = new Map();
  // Multi-device tracker: userId -> Set of connectionIds
  private userDeviceConnections: Map<string, Set<string>> = new Map();
  // Typing state tracker: key: `${channelOrConvId}:${userId}` -> timestamp
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // 15-second keepalive pulse to prevent browser/proxy connection drop or buffering
    setInterval(() => {
      for (const client of this.clients.values()) {
        try {
          client.res.write(': keepalive\n\n');
          if (typeof (client.res as any).flush === 'function') {
            (client.res as any).flush();
          }
        } catch {
          this.unregister(client.id);
        }
      }
    }, 15000);
  }

  public register(id: string, tenantId: string, userId: string, res: Response, workspaceId?: string) {
    const client: ConnectedClient = {
      id,
      tenantId,
      userId,
      workspaceId,
      groups: new Set<string>([`user:${userId}`, `tenant:${tenantId}`]),
      res,
      lastPing: Date.now()
    };

    if (workspaceId) {
      client.groups.add(`workspace:${workspaceId}`);
    }

    // Auto-subscribe to all accessible channels and conversations for this user
    // Eliminates frontend race condition where joinGroup was called before connection completed
    if (userId) {
      const userChannels = db.channels.filter(c => {
        if (c.deletedAt) return false;
        if (tenantId && c.tenantId !== tenantId) return false;
        if (!c.isPrivate) return true;
        return db.channelMembers.some(m => m.channelId === c.id && m.userId === userId);
      });
      userChannels.forEach(c => client.groups.add(`channel:${c.id}`));

      const userConvs = db.conversations.filter(c => {
        if (tenantId && c.tenantId !== tenantId) return false;
        return c.memberIds.includes(userId);
      });
      userConvs.forEach(conv => client.groups.add(`conversation:${conv.id}`));
    }

    this.clients.set(id, client);

    // Multi-device presence tracking
    let userCons = this.userDeviceConnections.get(userId);
    if (!userCons) {
      userCons = new Set();
      this.userDeviceConnections.set(userId, userCons);
    }
    const previousCount = userCons.size;
    userCons.add(id);

    // If first device connected, mark user as Online
    if (previousCount === 0) {
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.status = 'Online';
        user.lastSeenAt = new Date().toISOString();
        this.broadcastToTenant(tenantId, 'UserPresenceChanged', {
          userId,
          status: 'Online',
          lastSeenAt: user.lastSeenAt
        });
      }
    }

    // Initial handshake (SignalR protocol compatible)
    res.write(`data: ${JSON.stringify({
      event: 'Connected',
      payload: {
        connectionId: id,
        timestamp: new Date().toISOString(),
        groups: Array.from(client.groups),
        protocol: 'SignalR-Compatible-SSE/1.0'
      }
    })}\n\n`);

    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    res.on('close', () => {
      this.unregister(id);
    });
  }

  public unregister(id: string) {
    const client = this.clients.get(id);
    if (!client) return;

    const { userId, tenantId } = client;
    this.clients.delete(id);

    // Multi-device tracking: remove this connection
    const userCons = this.userDeviceConnections.get(userId);
    if (userCons) {
      userCons.delete(id);
      if (userCons.size === 0) {
        this.userDeviceConnections.delete(userId);
        // User has disconnected on all devices: mark as Offline
        const user = db.users.find(u => u.id === userId);
        if (user) {
          user.status = 'Offline';
          user.lastSeenAt = new Date().toISOString();
          this.broadcastToTenant(tenantId, 'UserPresenceChanged', {
            userId,
            status: 'Offline',
            lastSeenAt: user.lastSeenAt
          });
        }
      }
    }
  }

  // Join a SignalR group e.g. channel:{channelId}, workspace:{workspaceId}, conversation:{convId}
  public joinGroup(connectionIdOrUserId: string, group: string): boolean {
    let joined = false;
    for (const client of this.clients.values()) {
      if (client.id === connectionIdOrUserId || client.userId === connectionIdOrUserId) {
        client.groups.add(group);
        joined = true;
      }
    }
    return joined;
  }

  public leaveGroup(connectionIdOrUserId: string, group: string): boolean {
    let left = false;
    for (const client of this.clients.values()) {
      if (client.id === connectionIdOrUserId || client.userId === connectionIdOrUserId) {
        client.groups.delete(group);
        left = true;
      }
    }
    return left;
  }

  public broadcastToGroup(group: string, event: string, payload: any) {
    const dataString = `data: ${JSON.stringify({ event, payload })}\n\n`;
    for (const client of this.clients.values()) {
      if (client.groups.has(group)) {
        try {
          client.res.write(dataString);
          if (typeof (client.res as any).flush === 'function') {
            (client.res as any).flush();
          }
        } catch {
          this.unregister(client.id);
        }
      }
    }
  }

  public broadcastToTenant(tenantId: string, event: string, payload: any) {
    this.broadcastToGroup(`tenant:${tenantId}`, event, payload);
  }

  public broadcastToWorkspace(workspaceId: string, event: string, payload: any) {
    this.broadcastToGroup(`workspace:${workspaceId}`, event, payload);
  }

  public broadcastToChannel(channelId: string, event: string, payload: any) {
    this.broadcastToGroup(`channel:${channelId}`, event, payload);
  }

  public broadcastToConversation(conversationId: string, event: string, payload: any) {
    this.broadcastToGroup(`conversation:${conversationId}`, event, payload);
  }

  public sendToUser(userId: string, event: string, payload: any) {
    this.broadcastToGroup(`user:${userId}`, event, payload);
  }

  public recordHeartbeat(userId: string) {
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.lastSeenAt = new Date().toISOString();
    }
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        client.lastPing = Date.now();
      }
    }
  }

  // Handle typing indicator with automated throttling and auto-stop after 3 seconds
  public handleTyping(userId: string, userName: string, targetId: string, isChannel: boolean, isTyping: boolean, tenantId: string) {
    const key = `${targetId}:${userId}`;
    const group = isChannel ? `channel:${targetId}` : `conversation:${targetId}`;

    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key)!);
      this.typingTimeouts.delete(key);
    }

    if (isTyping) {
      // Emit TypingStarted
      this.broadcastToGroup(group, 'TypingStarted', {
        userId,
        userName,
        channelId: isChannel ? targetId : undefined,
        conversationId: !isChannel ? targetId : undefined,
        timestamp: new Date().toISOString()
      });

      // Automatically emit TypingStopped after 3500ms of inactivity
      const timeout = setTimeout(() => {
        this.typingTimeouts.delete(key);
        this.broadcastToGroup(group, 'TypingStopped', {
          userId,
          userName,
          channelId: isChannel ? targetId : undefined,
          conversationId: !isChannel ? targetId : undefined
        });
      }, 3500);

      this.typingTimeouts.set(key, timeout);
    } else {
      this.broadcastToGroup(group, 'TypingStopped', {
        userId,
        userName,
        channelId: isChannel ? targetId : undefined,
        conversationId: !isChannel ? targetId : undefined
      });
    }
  }

  // Active connections statistics
  public getStats() {
    return {
      connectedClients: this.clients.size,
      onlineUsers: this.userDeviceConnections.size,
      timestamp: new Date().toISOString()
    };
  }
}

export const realtimeHub = new RealtimeHub();

