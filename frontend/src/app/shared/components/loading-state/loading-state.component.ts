import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3" [ngClass]="containerClass">
      <div class="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-xs font-medium tracking-wide">{{ message }}</p>
    </div>
  `
})
export class LoadingStateComponent {
  @Input() message: string = 'Cargando contenido...';
  @Input() containerClass: string = 'h-64';
}

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
      <div class="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
        <span class="material-icons-round text-2xl">{{ icon }}</span>
      </div>
      <h3 class="text-base font-semibold text-slate-100 mb-1">{{ title }}</h3>
      <p class="text-xs text-slate-400 leading-relaxed mb-5">{{ description }}</p>
      <button
        *ngIf="actionLabel"
        (click)="actionClicked()"
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer"
      >
        <span>{{ actionLabel }}</span>
      </button>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon: string = 'inbox';
  @Input() title: string = 'No hay elementos';
  @Input() description: string = 'No se encontraron elementos disponibles en esta sección.';
  @Input() actionLabel?: string;
  @Input() onAction?: () => void;

  actionClicked(): void {
    if (this.onAction) this.onAction();
  }
}

@Component({
  selector: 'app-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
      <div class="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 mb-4">
        <span class="material-icons-round text-2xl">error_outline</span>
      </div>
      <h3 class="text-base font-semibold text-slate-100 mb-1">{{ title }}</h3>
      <p class="text-xs text-slate-400 leading-relaxed mb-5">{{ message }}</p>
      <button
        *ngIf="showRetry"
        (click)="onRetryClicked()"
        class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs rounded-lg transition-colors inline-flex items-center gap-2 cursor-pointer"
      >
        <span class="material-icons-round text-sm">refresh</span>
        <span>Reintentar</span>
      </button>
    </div>
  `
})
export class ErrorStateComponent {
  @Input() title: string = 'Error al cargar información';
  @Input() message: string = 'Ocurrió un problema de conexión con el servidor.';
  @Input() showRetry: boolean = true;
  @Input() onRetry?: () => void;

  onRetryClicked(): void {
    if (this.onRetry) this.onRetry();
  }
}
