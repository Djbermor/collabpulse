import { Injectable, signal } from '@angular/core';
import { SignalRService } from './signalr.service';

export interface TypingIndicatorPayload {
  channelId?: string;
  conversationId?: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TypingService {
  public activeTypers = signal<TypingIndicatorPayload[]>([]);
  private timeoutMap = new Map<string, any>();

  constructor(private signalR: SignalRService) {
    this.signalR.on<TypingIndicatorPayload>('user.typing').subscribe(payload => {
      this.handleTypingEvent(payload);
    });
  }

  private handleTypingEvent(payload: TypingIndicatorPayload): void {
    const key = `${payload.channelId || payload.conversationId}-${payload.userId}`;

    if (this.timeoutMap.has(key)) {
      clearTimeout(this.timeoutMap.get(key));
      this.timeoutMap.delete(key);
    }

    if (payload.isTyping) {
      this.activeTypers.update(typers => {
        const filtered = typers.filter(t => !(t.userId === payload.userId && t.channelId === payload.channelId));
        return [...filtered, payload];
      });

      // Auto clear typing status after 3 seconds of inactivity
      const timer = setTimeout(() => {
        this.clearTyper(payload.userId, payload.channelId, payload.conversationId);
      }, 3000);
      this.timeoutMap.set(key, timer);
    } else {
      this.clearTyper(payload.userId, payload.channelId, payload.conversationId);
    }
  }

  private clearTyper(userId: string, channelId?: string, conversationId?: string): void {
    this.activeTypers.update(typers =>
      typers.filter(t => !(t.userId === userId && t.channelId === channelId && t.conversationId === conversationId))
    );
  }
}
