import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastService, ToastMessage } from './core/services/toast.service';
import { ThemeService } from './core/services/theme.service';
import { KeyboardShortcutService } from './core/services/keyboard-shortcut.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <!-- Main Application Router Outlet -->
    <router-outlet></router-outlet>

    <!-- Global Floating Toast Notification Container -->
    <div
      class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      <div
        *ngFor="let toast of toastService.toasts()"
        class="pointer-events-auto p-3 rounded-xl border shadow-2xl flex items-start justify-between gap-3 text-xs transition-all duration-200 animate-in slide-in-from-bottom-2"
        [ngClass]="getToastClasses(toast.type)"
      >
        <div class="flex items-start gap-2.5">
          <span class="material-icons-round text-base mt-0.5">{{ getToastIcon(toast.type) }}</span>
          <span class="leading-relaxed text-slate-100">{{ toast.message }}</span>
        </div>

        <button
          type="button"
          (click)="toastService.remove(toast.id)"
          class="text-slate-400 hover:text-slate-100 transition-colors cursor-pointer shrink-0"
        >
          <span class="material-icons-round text-sm">close</span>
        </button>
      </div>
    </div>
  `
})
export class AppComponent {
  constructor(
    public toastService: ToastService,
    private themeService: ThemeService,
    private keyboardShortcuts: KeyboardShortcutService
  ) {}

  getToastClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-slate-900 border-emerald-500/60 text-emerald-400 shadow-emerald-950/20';
      case 'error':
        return 'bg-slate-900 border-red-500/60 text-red-400 shadow-red-950/20';
      case 'warning':
        return 'bg-slate-900 border-amber-500/60 text-amber-400 shadow-amber-950/20';
      default:
        return 'bg-slate-900 border-indigo-500/60 text-indigo-400 shadow-indigo-950/20';
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}
