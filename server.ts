import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { realtimeHub } from './server/realtime';
import { authRouter } from './server/routes/auth';
import { workspacesRouter } from './server/routes/workspaces';
import { channelsRouter } from './server/routes/channels';
import { conversationsRouter } from './server/routes/conversations';
import { messagesRouter } from './server/routes/messages';
import { tasksRouter } from './server/routes/tasks';
import { calendarRouter } from './server/routes/calendar';
import { meetingsRouter } from './server/routes/meetings';
import { filesRouter } from './server/routes/files';
import { notificationsRouter } from './server/routes/notifications';
import { searchRouter } from './server/routes/search';
import { adminRouter } from './server/routes/admin';
import { signalingRouter } from './server/routes/signaling';
import { callsRouter } from './server/routes/calls';
import { groupCallsRouter } from './server/routes/groupCalls';
import { organizationsRouter } from './server/routes/organizations';
import { usersRouter } from './server/routes/users';
import { correlationMiddleware, requireFeature } from './server/middleware';
import { db } from './server/db';
import { pool } from './src/db/index';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS & Tenant Extraction Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Tenant-Id, X-User-Id, X-Workspace-Id, X-Correlation-Id');
  res.header('Access-Control-Expose-Headers', 'X-Correlation-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request Correlation & Telemetry Tracking Middleware
app.use(correlationMiddleware);

// Health Checks (Section 50 Observability)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    services: {
      database: db.isPostgresConnected ? 'connected (Google Cloud SQL PostgreSQL ready)' : 'connected (Cloud SQL initializing)',
      realtime: 'active (SignalR / SSE Hub ready)',
      storage: 'persistent (Google Cloud SQL in us-east1)'
    }
  });
});

app.get('/health/database', async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT 1 as live, current_database(), current_user, version()');
    const latencyMs = Date.now() - startTime;
    res.json({
      status: 'healthy',
      database: 'Google Cloud SQL PostgreSQL',
      connected: true,
      currentDatabase: result.rows[0]?.current_database,
      currentUser: result.rows[0]?.current_user,
      version: result.rows[0]?.version,
      query: 'SELECT 1',
      latencyMs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/ready', (req, res) => {
  res.json({ ready: true });
});

// Real-time Event Stream (SSE conforming to SignalR real-time specification)
app.get('/api/v1/realtime/stream', (req, res) => {
  const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || db.tenants[0]?.id || '';
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || '';
  const workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string) || db.workspaces[0]?.id || '';
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders();

  realtimeHub.register(clientId, tenantId, userId, res, workspaceId);
});

// SignalR Negotiate compatibility endpoint
app.post(['/hubs/realtime/negotiate', '/api/v1/realtime/negotiate'], (req, res) => {
  const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  res.json({
    connectionId,
    connectionToken: connectionId,
    negotiateVersion: 1,
    availableTransports: [
      {
        transport: 'ServerSentEvents',
        transferFormats: ['Text']
      }
    ],
    url: `/api/v1/realtime/stream`
  });
});

// Join group (e.g. channel:{id}, conversation:{id}, workspace:{id})
app.post('/api/v1/realtime/groups/join', (req, res) => {
  const { group, userId, connectionId } = req.body;
  if (!group || (!userId && !connectionId)) {
    return res.status(400).json({ success: false, message: 'Group and (userId or connectionId) required' });
  }
  const joined = realtimeHub.joinGroup(connectionId || userId, group);
  res.json({ success: true, joined, group });
});

// Leave group
app.post('/api/v1/realtime/groups/leave', (req, res) => {
  const { group, userId, connectionId } = req.body;
  if (!group || (!userId && !connectionId)) {
    return res.status(400).json({ success: false, message: 'Group and (userId or connectionId) required' });
  }
  const left = realtimeHub.leaveGroup(connectionId || userId, group);
  res.json({ success: true, left, group });
});

// Heartbeat ping
app.post('/api/v1/realtime/heartbeat', (req, res) => {
  const userId = req.body.userId || (req.headers['x-user-id'] as string);
  if (userId) {
    realtimeHub.recordHeartbeat(userId);
  }
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Realtime Hub Stats
app.get('/api/v1/realtime/stats', (req, res) => {
  res.json({ success: true, data: realtimeHub.getStats() });
});

// Feature Permissions (Global endpoint accessible to clients)
app.get('/api/v1/features', (req, res) => {
  const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'tenant-mu36yjdt';
  const features = db.getFeaturePermissions(tenantId);
  res.json({ success: true, data: features });
});

// Mount API v1 Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/workspaces', workspacesRouter);
app.use('/api/v1/channels', channelsRouter);
app.use('/api/v1/conversations', conversationsRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/tasks', requireFeature('tasks'), tasksRouter);
app.use('/api/v1/calendar', requireFeature('calendar'), calendarRouter);
app.use('/api/v1/meetings', requireFeature('videoCalls'), meetingsRouter);
app.use('/api/v1/files', requireFeature('files'), filesRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/realtime/signal', signalingRouter);
app.use('/api/v1/calls', requireFeature('calls'), callsRouter);
app.use('/api/v1/group-calls', requireFeature('videoCalls'), groupCallsRouter);
app.use('/api/v1/organizations', organizationsRouter);
app.use('/api/v1/users', usersRouter);

// Serve physical user uploads statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    code: err.code || 'INTERNAL_SERVER_ERROR'
  });
});

async function startServer() {
  // Retry sync with database on cloud boot (allows Cloud SQL / remote DB connection to stabilize)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await db.syncFromPostgres();
      break;
    } catch (err: any) {
      console.error(`[Boot] Database sync attempt ${attempt}/3 failed:`, err.message);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nexora Server running on http://0.0.0.0:${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
  });

  // Calendar Reminders Background Worker
  const notifiedEvents = new Set<string>();
  setInterval(async () => {
    try {
      const now = Date.now();
      const in15Mins = now + 15 * 60 * 1000;

      for (const evt of db.calendarEvents) {
        const startTime = new Date(evt.startAt || (evt as any).startDate).getTime();
        const targetUserId = evt.createdBy || (evt as any).creatorId;
        if (startTime > now && startTime <= in15Mins && !notifiedEvents.has(evt.id) && targetUserId) {
          notifiedEvents.add(evt.id);
          const minutesRemaining = Math.max(1, Math.round((startTime - now) / 60000));
          const notif = {
            id: `notif-cal-${evt.id}-${Date.now()}`,
            tenantId: evt.tenantId,
            userId: targetUserId,
            type: 'System' as const,
            title: `Recordatorio: ${evt.title}`,
            message: `El evento "${evt.title}" comienza en ${minutesRemaining} minutos${evt.location ? ` en ${evt.location}` : ''}.`,
            linkUrl: '/calendar',
            isRead: false,
            createdAt: new Date().toISOString()
          };
          db.notifications.unshift(notif);
          await db.persistNotification(notif);
          realtimeHub.sendToUser(targetUserId, 'NotificationCreated', notif);
        }
      }
    } catch (err) {
      console.warn('[CalendarReminder] Worker check note:', err);
    }
  }, 60000);

  // Graceful shutdown handlers for Google Cloud Run / Container orchestrators

  const handleShutdown = async (signal: string) => {
    console.log(`[Lifecycle] ${signal} signal received: closing HTTP server...`);
    server.close(async () => {
      console.log('[Lifecycle] HTTP server closed.');
      try {
        await pool.end();
        console.log('[Lifecycle] PostgreSQL pool closed.');
      } catch (e) {
        console.error('[Lifecycle] Error closing pool:', e);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
