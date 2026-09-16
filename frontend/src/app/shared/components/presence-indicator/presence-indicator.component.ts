import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStatus } from '../../../core/models/user.model';

@Component({
  selector: 'app-presence-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-block rounded-full ring-2 ring-slate-950 transition-colors"
      [ngClass]="[getSizeClass(), getStatusClass()]"
      [title]="getStatusLabel()"
      [attr.aria-label]="getStatusLabel()"
    ></span>
  `,
  styles: [`
    .status-online { background-color: var(--status-online); }
    .status-away { background-color: var(--status-away); }
    .status-dnd { background-color: var(--status-dnd); }
    .status-offline { background-color: var(--status-offline); }
  `]
})
export class PresenceIndicatorComponent {
  @Input() status: UserStatus = 'offline';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  public getSizeClass(): string {
    switch (this.size) {
      case 'sm': return 'w-2 h-2';
      case 'lg': return 'w-3.5 h-3.5';
      default: return 'w-2.5 h-2.5';
    }
  }

  public getStatusClass(): string {
    switch (this.status) {
      case 'online': return 'status-online';
      case 'away': return 'status-away';
      case 'dnd': return 'status-dnd';
      default: return 'status-offline';
    }
  }

  public getStatusLabel(): string {
    switch (this.status) {
      case 'online': return 'En línea';
      case 'away': return 'Ausente';
      case 'dnd': return 'No molestar';
      default: return 'Desconectado';
    }
  }
}
