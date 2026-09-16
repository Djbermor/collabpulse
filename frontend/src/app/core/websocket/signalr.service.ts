import { Injectable, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

export type ConnectionState = 'Connected' | 'Connecting' | 'Disconnected' | 'Reconnecting' | 'Failed';

export interface RealtimeEvent<T = any> {
  eventType: string;
  payload: T;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  public connectionState = signal<ConnectionState>('Disconnected');
  private eventSource: EventSource | null = null;
  private eventBus = new Subject<RealtimeEvent>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;

  constructor(private authService: AuthService) {}

  public connect(): void {
    if (this.connectionState() === 'Connected' || this.connectionState() === 'Connecting') {
      return;
    }

    this.connectionState.set('Connecting');
    const tenantId = this.authService.activeTenantId() || environment.defaultTenantId;
    const user = this.authService.currentUser();
    const userId = user?.id || 'usr-anonymous';

    const streamUrl = `${environment.apiBaseUrl}/realtime/stream?tenantId=${encodeURIComponent(tenantId)}&userId=${encodeURIComponent(userId)}`;

    try {
      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onopen = () => {
        this.connectionState.set('Connected');
        this.reconnectAttempts = 0;
        console.log('[SignalR/SSE] Connected to real-time hub');
      };

      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          this.eventBus.next({
            eventType: parsed.event || 'message',
            payload: parsed.data || parsed,
            timestamp: parsed.timestamp || new Date().toISOString()
          });
        } catch (err) {
          console.error('[SignalR/SSE] Failed to parse message', err);
        }
      };

      this.eventSource.onerror = (err) => {
        console.warn('[SignalR/SSE] Connection error', err);
        this.handleDisconnect();
      };
    } catch (err) {
      console.error('[SignalR/SSE] Connection initiation failed', err);
      this.handleDisconnect();
    }
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connectionState.set('Disconnected');
  }

  public on<T = any>(eventType: string): Observable<T> {
    return this.eventBus.asObservable().pipe(
      filter(event => event.eventType === eventType),
      map(event => event.payload as T)
    );
  }

  private handleDisconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.connectionState.set('Reconnecting');
      this.reconnectAttempts++;
      const delayMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
      this.reconnectTimer = setTimeout(() => {
        console.log(`[SignalR/SSE] Reconnecting attempt ${this.reconnectAttempts}...`);
        this.connect();
      }, delayMs);
    } else {
      this.connectionState.set('Failed');
      console.error('[SignalR/SSE] Maximum reconnection attempts reached.');
    }
  }
}
