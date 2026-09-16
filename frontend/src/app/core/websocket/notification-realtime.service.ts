import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { SignalRService } from './signalr.service';
import { NotificationItem } from '../models/notification.model';
import { ToastService } from '../services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationRealtimeService {
  public unreadCount = signal<number>(0);

  constructor(
    private signalR: SignalRService,
    private toastService: ToastService
  ) {
    this.signalR.on<NotificationItem>('notification.created').subscribe(notification => {
      this.unreadCount.update(c => c + 1);
      this.toastService.info(`Nueva notificación: ${notification.title}`);
    });
  }

  public onNotificationReceived(): Observable<NotificationItem> {
    return this.signalR.on<NotificationItem>('notification.created');
  }

  public setUnreadCount(count: number): void {
    this.unreadCount.set(Math.max(0, count));
  }

  public decrement(): void {
    this.unreadCount.update(c => Math.max(0, c - 1));
  }

  public clear(): void {
    this.unreadCount.set(0);
  }
}
