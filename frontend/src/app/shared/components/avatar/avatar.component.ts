import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStatus } from '../../../core/models/user.model';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="avatar-container relative inline-flex items-center justify-center select-none rounded-full font-semibold overflow-hidden"
      [ngClass]="sizeClass()"
      [style.background-color]="bgColor()"
    >
      <img
        *ngIf="imageUrl"
        [src]="imageUrl"
        [alt]="name || 'User Avatar'"
        class="w-full h-full object-cover"
        referrerpolicy="no-referrer"
        (error)="onImageError()"
      />
      <span *ngIf="!imageUrl || hasImageError" class="text-white tracking-wider uppercase" [ngClass]="textSizeClass()">
        {{ initials() }}
      </span>

      <!-- Presence indicator dot -->
      <span
        *ngIf="status"
        class="absolute bottom-0 right-0 block rounded-full ring-2 ring-slate-950"
        [ngClass]="[statusClass(), statusSizeClass()]"
        [title]="status"
        [attr.aria-label]="status"
      ></span>
    </div>
  `,
  styles: [`
    .avatar-container {
      display: inline-flex;
      position: relative;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      font-family: inherit;
    }
    .status-online { background-color: var(--status-online); }
    .status-away { background-color: var(--status-away); }
    .status-dnd { background-color: var(--status-dnd); }
    .status-offline { background-color: var(--status-offline); }
  `]
})
export class AvatarComponent {
  @Input() name: string = '';
  @Input() imageUrl?: string;
  @Input() size: 20 | 24 | 32 | 40 | 48 | 64 = 32;
  @Input() status?: UserStatus;

  public hasImageError = false;

  public initials = computed(() => {
    if (!this.name) return '?';
    const parts = this.name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return this.name.substring(0, 2).toUpperCase();
  });

  public bgColor = computed(() => {
    if (!this.name) return '#4f46e5';
    let hash = 0;
    for (let i = 0; i < this.name.length; i++) {
      hash = this.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  });

  public sizeClass = computed(() => {
    switch (this.size) {
      case 20: return 'w-5 h-5';
      case 24: return 'w-6 h-6';
      case 32: return 'w-8 h-8';
      case 40: return 'w-10 h-10';
      case 48: return 'w-12 h-12';
      case 64: return 'w-16 h-16';
      default: return 'w-8 h-8';
    }
  });

  public textSizeClass = computed(() => {
    switch (this.size) {
      case 20: return 'text-[9px]';
      case 24: return 'text-[10px]';
      case 32: return 'text-xs';
      case 40: return 'text-sm';
      case 48: return 'text-base';
      case 64: return 'text-xl';
      default: return 'text-xs';
    }
  });

  public statusSizeClass = computed(() => {
    switch (this.size) {
      case 20:
      case 24: return 'w-1.5 h-1.5';
      case 32: return 'w-2.5 h-2.5';
      case 40:
      case 48: return 'w-3 h-3';
      case 64: return 'w-4 h-4';
      default: return 'w-2.5 h-2.5';
    }
  });

  public statusClass = computed(() => {
    switch (this.status) {
      case 'online': return 'status-online';
      case 'away': return 'status-away';
      case 'dnd': return 'status-dnd';
      default: return 'status-offline';
    }
  });

  public onImageError(): void {
    this.hasImageError = true;
  }
}
