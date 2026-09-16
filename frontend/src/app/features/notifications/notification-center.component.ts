import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationApiService } from '../../core/http/notification-api.service';
import { NotificationRealtimeService } from '../../core/websocket/notification-realtime.service';
import { ToastService } from '../../core/services/toast.service';
import { NotificationItem } from '../../core/models/notification.model';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, LoadingStateComponent, EmptyStateComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">notifications</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Centro de Notificaciones</h2>
            <p class="text-[11px] text-slate-400">Menciones, asignaciones y eventos de canales suscritos</p>
          </div>
        </div>

        <button
          *ngIf="notifications().length > 0"
          type="button"
          (click)="markAllAsRead()"
          class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span class="material-icons-round text-sm">done_all</span>
          <span>Marcar todas como leídas</span>
        </button>
      </header>

      <!-- LIST -->
      <div class="flex-1 overflow-y-auto p-6 space-y-3 max-w-3xl">
        <app-loading-state *ngIf="isLoading()" message="Cargando tus notificaciones..."></app-loading-state>

        <app-empty-state
          *ngIf="!isLoading() && notifications().length === 0"
          icon="notifications_none"
          title="Estás al día"
          description="No tienes notificaciones pendientes ni menciones no leídas."
        ></app-empty-state>

        <div
          *ngFor="let notif of notifications()"
          class="p-4 rounded-xl border transition-colors flex items-start justify-between gap-4"
          [ngClass]="notif.isRead ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-900 border-indigo-500/40 shadow-sm'"
        >
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" [ngClass]="getIconBackground(notif.type)">
              <span class="material-icons-round text-base">{{ getNotificationIcon(notif.type) }}</span>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-semibold text-slate-100">{{ notif.title }}</h4>
                <span *ngIf="!notif.isRead" class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">{{ notif.body }}</p>
              <span class="text-[10px] text-slate-500 font-mono">{{ notif.createdAt | timeAgo }}</span>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              *ngIf="!notif.isRead"
              (click)="markAsRead(notif.id)"
              class="p-1 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
              title="Marcar como leída"
            >
              <span class="material-icons-round text-base">check</span>
            </button>
            <button
              (click)="deleteNotification(notif.id)"
              class="p-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="Eliminar notificación"
            >
              <span class="material-icons-round text-base">delete_outline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class NotificationCenterComponent implements OnInit {
  public notifications = signal<NotificationItem[]>([]);
  public isLoading = signal<boolean>(true);

  constructor(
    private notifApi: NotificationApiService,
    private realtimeNotif: NotificationRealtimeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading.set(true);
    this.notifApi.getNotifications().subscribe({
      next: data => {
        this.notifications.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  markAsRead(id: string): void {
    this.notifApi.markAsRead(id).subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => n.id === id ? { ...n, isRead: true } : n));
        this.realtimeNotif.decrement();
      }
    });
  }

  markAllAsRead(): void {
    this.notifApi.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this.realtimeNotif.clear();
        this.toastService.success('Todas las notificaciones marcadas como leídas.');
      }
    });
  }

  deleteNotification(id: string): void {
    this.notifApi.deleteNotification(id).subscribe({
      next: () => {
        this.notifications.update(list => list.filter(n => n.id !== id));
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'mention': return 'alternate_email';
      case 'task_assigned': return 'assignment_ind';
      case 'channel_invite': return 'group_add';
      default: return 'notifications';
    }
  }

  getIconBackground(type: string): string {
    switch (type) {
      case 'mention': return 'bg-amber-950/50 text-amber-400';
      case 'task_assigned': return 'bg-blue-950/50 text-blue-400';
      case 'channel_invite': return 'bg-purple-950/50 text-purple-400';
      default: return 'bg-indigo-950/50 text-indigo-400';
    }
  }
}
