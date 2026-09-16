import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      *ngIf="count > 0"
      class="inline-flex items-center justify-center font-bold rounded-full px-1.5 py-0.5 select-none"
      [ngClass]="[getVariantClass(), getSizeClass()]"
    >
      {{ displayCount }}
    </span>
  `,
  styles: [`
    .badge-primary { background-color: var(--accent-color); color: #ffffff; }
    .badge-danger { background-color: var(--danger-color); color: #ffffff; }
    .badge-muted { background-color: var(--surface-secondary); color: var(--text-secondary); }
  `]
})
export class BadgeComponent {
  @Input() count: number = 0;
  @Input() max: number = 99;
  @Input() variant: 'primary' | 'danger' | 'muted' = 'primary';
  @Input() size: 'sm' | 'md' = 'sm';

  get displayCount(): string {
    return this.count > this.max ? `${this.max}+` : `${this.count}`;
  }

  getVariantClass(): string {
    switch (this.variant) {
      case 'danger': return 'badge-danger';
      case 'muted': return 'badge-muted';
      default: return 'badge-primary';
    }
  }

  getSizeClass(): string {
    return this.size === 'sm' ? 'text-[10px] min-w-[16px] h-4' : 'text-xs min-w-[20px] h-5';
  }
}
