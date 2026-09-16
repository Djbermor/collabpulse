import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div
        class="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
        role="alertdialog"
        aria-modal="true"
      >
        <div class="flex items-start gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            [ngClass]="isDanger ? 'bg-red-950/60 text-red-400 border border-red-900/50' : 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/50'"
          >
            <span class="material-icons-round text-xl">{{ isDanger ? 'warning' : 'help_outline' }}</span>
          </div>
          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-slate-100">{{ title }}</h3>
            <p class="text-xs text-slate-400 leading-relaxed">{{ message }}</p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            (click)="cancel()"
            class="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            (click)="confirm()"
            class="px-3.5 py-2 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer"
            [ngClass]="isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ConfirmDialogComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = '¿Confirmar acción?';
  @Input() message: string = 'Esta acción no se puede deshacer.';
  @Input() confirmText: string = 'Confirmar';
  @Input() cancelText: string = 'Cancelar';
  @Input() isDanger: boolean = false;

  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();

  confirm(): void {
    this.onConfirm.emit();
  }

  cancel(): void {
    this.onCancel.emit();
  }
}
