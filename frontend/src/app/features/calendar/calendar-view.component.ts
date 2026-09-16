import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalendarApiService } from '../../core/http/calendar-api.service';
import { ToastService } from '../../core/services/toast.service';
import { CalendarEvent } from '../../core/models/task.model';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingStateComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">calendar_month</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Calendario & Eventos</h2>
            <p class="text-[11px] text-slate-400">Planificación de sincronizaciones, demos y entregas de sprint</p>
          </div>
        </div>

        <button
          type="button"
          (click)="openModal()"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span class="material-icons-round text-sm">event</span>
          <span>Programar Evento</span>
        </button>
      </header>

      <!-- CONTENT GRID -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <app-loading-state *ngIf="isLoading()" message="Sincronizando eventos del calendario..."></app-loading-state>

        <div *ngIf="!isLoading()" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            *ngFor="let ev of events()"
            class="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition-colors shadow-xs"
          >
            <div class="flex items-start justify-between gap-2">
              <span class="text-xs font-bold text-slate-100">{{ ev.title }}</span>
              <span class="material-icons-round text-slate-500 text-sm">schedule</span>
            </div>

            <p *ngIf="ev.description" class="text-xs text-slate-400 leading-relaxed">{{ ev.description }}</p>

            <div class="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 font-mono">
              <div class="flex items-center gap-1.5">
                <span class="material-icons-round text-xs text-indigo-400">access_time</span>
                <span>{{ ev.startTime | date:'shortTime' }} - {{ ev.endTime | date:'shortTime' }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-icons-round text-xs text-indigo-400">calendar_today</span>
                <span>{{ ev.startTime | date:'fullDate' }}</span>
              </div>
            </div>

            <div class="flex justify-end pt-1">
              <button
                (click)="deleteEvent(ev.id)"
                class="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span class="material-icons-round text-xs">delete</span>
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHEDULE EVENT MODAL -->
      <div *ngIf="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div class="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-3 shadow-2xl">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Agendar Evento</h3>
            <button (click)="isModalOpen = false" class="text-slate-400 hover:text-slate-200 cursor-pointer">
              <span class="material-icons-round text-base">close</span>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-300 mb-1">Título</label>
              <input
                type="text"
                [(ngModel)]="newTitle"
                placeholder="Ej. Daily Scrum o Demostración Sprint"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">Descripción</label>
              <textarea
                [(ngModel)]="newDescription"
                rows="2"
                placeholder="Temas a tratar en la sesión..."
                class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-300 mb-1">Fecha y Hora Inicio</label>
                <input
                  type="datetime-local"
                  [(ngModel)]="newStartTime"
                  class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
                />
              </div>

              <div>
                <label class="block text-xs text-slate-300 mb-1">Fecha y Hora Fin</label>
                <input
                  type="datetime-local"
                  [(ngModel)]="newEndTime"
                  class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              (click)="isModalOpen = false"
              class="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="saveEvent()"
              [disabled]="!newTitle.trim() || !newStartTime"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg cursor-pointer"
            >
              Agendar
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CalendarViewComponent implements OnInit {
  public events = signal<CalendarEvent[]>([]);
  public isLoading = signal<boolean>(true);
  public isModalOpen = false;

  public newTitle = '';
  public newDescription = '';
  public newStartTime = '';
  public newEndTime = '';

  constructor(
    private calendarApi: CalendarApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.isLoading.set(true);
    this.calendarApi.getEvents().subscribe({
      next: data => {
        this.events.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  openModal(): void {
    this.newTitle = '';
    this.newDescription = '';
    const now = new Date();
    this.newStartTime = now.toISOString().slice(0, 16);
    now.setHours(now.getHours() + 1);
    this.newEndTime = now.toISOString().slice(0, 16);
    this.isModalOpen = true;
  }

  saveEvent(): void {
    if (!this.newTitle.trim() || !this.newStartTime) return;

    this.calendarApi.scheduleEvent({
      title: this.newTitle.trim(),
      description: this.newDescription.trim(),
      startTime: new Date(this.newStartTime).toISOString(),
      endTime: this.newEndTime ? new Date(this.newEndTime).toISOString() : new Date(this.newStartTime).toISOString()
    }).subscribe({
      next: created => {
        this.events.update(list => [created, ...list]);
        this.toastService.success('Evento agendado exitosamente.');
        this.isModalOpen = false;
      },
      error: () => this.toastService.error('Error al agendar evento.')
    });
  }

  deleteEvent(id: string): void {
    this.calendarApi.deleteEvent(id).subscribe({
      next: () => {
        this.events.update(list => list.filter(e => e.id !== id));
        this.toastService.success('Evento eliminado.');
      },
      error: () => this.toastService.error('Error al eliminar evento.')
    });
  }
}
