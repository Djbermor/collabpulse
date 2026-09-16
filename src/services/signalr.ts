type EventHandler = (payload: any) => void;

export class SignalRConnection {
  private eventSource: EventSource | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private isConnected: boolean = false;
  private reconnectTimer: any = null;

  public start(tenantId: string, userId: string) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      const url = `/api/v1/realtime/stream?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.emit('connectionStateChanged', { isConnected: true });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.event) {
            this.emit(parsed.event, parsed.payload);
            // Map SignalR alias events if needed
            if (parsed.event === 'MessageCreated') {
              this.emit('MessageReceived', parsed.payload);
            }
            if (parsed.event === 'NotificationCreated') {
              this.emit('NotificationReceived', parsed.payload);
            }
            if (parsed.event === 'ReactionAdded' || parsed.event === 'ReactionRemoved') {
              this.emit('MessageReactionUpdated', parsed.payload);
            }
          }
        } catch (err) {
          console.error('Error parsing realtime event:', err);
        }
      };

      this.eventSource.onerror = () => {
        this.isConnected = false;
        this.emit('connectionStateChanged', { isConnected: false });
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        // Retry connection after 3s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.start(tenantId, userId);
          }, 3000);
        }
      };
    } catch (err) {
      console.error('Failed to establish realtime connection:', err);
    }
  }

  public stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.emit('connectionStateChanged', { isConnected: false });
  }

  public on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  public off(event: string, handler?: EventHandler) {
    if (!handler) {
      this.handlers.delete(event);
      return;
    }
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler);
    }
  }

  private emit(event: string, payload: any) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach(fn => fn(payload));
    }
  }

  public getStatus(): boolean {
    return this.isConnected;
  }

  public async joinGroup(group: string, userId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/realtime/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, userId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async leaveGroup(group: string, userId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/v1/realtime/groups/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group, userId })
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const signalR = new SignalRConnection();
