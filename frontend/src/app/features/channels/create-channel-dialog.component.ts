import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ChannelApiService } from '../../core/http/channel-api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-create-channel-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div
        class="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4"
        role="dialog"
      >
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="material-icons-round text-indigo-400 text-lg">tag</span>
            <h3 class="text-sm font-semibold text-slate-100">Crear nuevo Canal</h3>
          </div>
          <button (click)="close()" class="text-slate-400 hover:text-slate-200 cursor-pointer">
            <span class="material-icons-round text-base">close</span>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-300" for="channelName">Nombre del Canal</label>
            <div class="flex items-center">
              <span class="px-2.5 h-9 bg-slate-800 text-slate-400 text-xs flex items-center rounded-l-lg border border-r-0 border-slate-800 font-mono">#</span>
              <input
                id="channelName"
                type="text"
                formControlName="name"
                placeholder="anuncios-generales"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-r-lg px-3 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-300" for="channelTopic">Tema o Propósito (opcional)</label>
            <input
              id="channelTopic"
              type="text"
              formControlName="topic"
              placeholder="Discusión sobre lanzamientos y novedades de producto"
              class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div class="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex items-start gap-3">
            <input
              id="isPrivate"
              type="checkbox"
              formControlName="isPrivate"
              class="w-4 h-4 mt-0.5 rounded border-slate-800 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <div class="space-y-0.5">
              <label for="isPrivate" class="text-xs font-semibold text-slate-200 cursor-pointer select-none">Hacer canal privado</label>
              <p class="text-[11px] text-slate-400">Cuando un canal es privado, solo los miembros invitados pueden ver sus mensajes y archivos.</p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              (click)="close()"
              class="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="form.invalid || isCreating"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span *ngIf="isCreating" class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Crear Canal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class CreateChannelDialogComponent {
  @Input() isOpen = false;
  @Output() onClose = new EventEmitter<void>();
  @Output() onChannelCreated = new EventEmitter<any>();

  public form: FormGroup;
  public isCreating = false;

  constructor(
    private fb: FormBuilder,
    private channelApi: ChannelApiService,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.pattern('^[a-z0-9-_]+$')]],
      topic: [''],
      isPrivate: [false]
    });
  }

  close(): void {
    this.form.reset({ isPrivate: false });
    this.onClose.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isCreating = true;
    this.channelApi.createChannel(this.form.value).subscribe({
      next: created => {
        this.isCreating = false;
        this.toastService.success(`Canal #${created.name} creado exitosamente.`);
        this.onChannelCreated.emit(created);
        this.close();
      },
      error: () => {
        this.isCreating = false;
        this.toastService.error('Error al crear el canal.');
      }
    });
  }
}
