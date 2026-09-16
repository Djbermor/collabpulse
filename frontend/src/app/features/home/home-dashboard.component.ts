import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ChannelApiService } from '../../core/http/channel-api.service';
import { TaskApiService } from '../../core/http/task-api.service';
import { CalendarApiService } from '../../core/http/calendar-api.service';
import { Channel } from '../../core/models/workspace.model';
import { TaskItem, CalendarEvent } from '../../core/models/task.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AvatarComponent, TimeAgoPipe],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-y-auto p-6 space-y-6">
      <!-- WELCOME HERO BANNER -->
      <div class="p-6 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-violet-950/50 border border-slate-800/80 rounded-2xl relative overflow-hidden shadow-lg">
        <div class="max-w-2xl space-y-2 z-10 relative">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Workspace Conectado en Tiempo Real
          </span>
          <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
            ¡Hola, {{ currentUser()?.firstName || 'Colaborador' }}!
          </h1>
          <p class="text-xs text-slate-300 leading-relaxed">
            Bienvenido a tu panel de control central en CollabPulse. Aquí tienes un resumen de la actividad reciente, tareas asignadas y reuniones programadas para hoy.
          </p>
        </div>

        <!-- Quick actions buttons -->
        <div class="flex flex-wrap gap-2.5 pt-4 z-10 relative">
          <a
            [routerLink]="['/workspace', currentTenantId(), 'tasks']"
            class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span class="material-icons-round text-base">add_task</span>
            <span>Nueva Tarea</span>
          </a>
          <a
            [routerLink]="['/workspace', currentTenantId(), 'meetings']"
            class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span class="material-icons-round text-base">video_call</span>
            <span>Iniciar Sala Rápida</span>
          </a>
          <a
            [routerLink]="['/workspace', currentTenantId(), 'channels', 'general']"
            class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <span class="material-icons-round text-base">tag</span>
            <span>Ir a #general</span>
          </a>
        </div>
      </div>

      <!-- MAIN SUMMARY GRID -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- LEFT 2 COLS: RECENT CHANNELS & TASKS -->
        <div class="lg:col-span-2 space-y-6">
          <!-- CHANNELS OVERVIEW -->
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-icons-round text-indigo-400 text-lg">tag</span>
                <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Tus Canales Destacados</h3>
              </div>
              <a [routerLink]="['/workspace', currentTenantId(), 'channels', 'new']" class="text-xs text-indigo-400 hover:underline">
                Explorar todos →
              </a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                *ngFor="let ch of channels()"
                [routerLink]="['/workspace', currentTenantId(), 'channels', ch.id]"
                class="p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-1 block transition-colors group"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-slate-200 group-hover:text-indigo-400"># {{ ch.name }}</span>
                  <span *ngIf="ch.unreadCount > 0" class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                    {{ ch.unreadCount }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 truncate">{{ ch.topic || ch.description || 'Sin tema fijado' }}</p>
              </a>
            </div>
          </div>

          <!-- PENDING TASKS PREVIEW -->
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-icons-round text-amber-400 text-lg">checklist</span>
                <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Tareas Prioritarias</h3>
              </div>
              <a [routerLink]="['/workspace', currentTenantId(), 'tasks']" class="text-xs text-indigo-400 hover:underline">
                Ver tablero Kanban →
              </a>
            </div>

            <div class="space-y-2">
              <div
                *ngFor="let task of pendingTasks()"
                class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
              >
                <div class="flex items-center gap-2.5">
                  <span class="material-icons-round text-slate-500 text-base">radio_button_unchecked</span>
                  <span class="text-xs font-medium text-slate-200">{{ task.title }}</span>
                </div>
                <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {{ task.priority }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT 1 COL: UPCOMING CALENDAR EVENTS & TEAM STATUS -->
        <div class="space-y-6">
          <!-- UPCOMING EVENTS -->
          <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-icons-round text-emerald-400 text-lg">event</span>
                <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Próximos Eventos</h3>
              </div>
              <a [routerLink]="['/workspace', currentTenantId(), 'calendar']" class="text-xs text-indigo-400 hover:underline">
                Calendario →
              </a>
            </div>

            <div class="space-y-3">
              <div
                *ngFor="let ev of events()"
                class="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1"
              >
                <p class="text-xs font-semibold text-slate-200">{{ ev.title }}</p>
                <div class="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <span class="material-icons-round text-xs text-indigo-400">schedule</span>
                  <span>{{ ev.startTime | date:'shortTime' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ARCHITECTURE STATUS BADGE -->
          <div class="p-4 bg-slate-900/40 border border-slate-800/80 rounded-xl space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h4 class="text-xs font-semibold text-slate-200">Arquitectura Limpia & CQRS</h4>
            </div>
            <p class="text-[11px] text-slate-400 leading-relaxed">
              La plataforma ejecuta el pipeline MediatR de validación, logs y aislamiento tenant estricto por cada petición HTTP y canal SSE.
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class HomeDashboardComponent implements OnInit {
  public currentUser = this.authService.currentUser;
  public currentTenantId = this.authService.activeTenantId;

  public channels = signal<Channel[]>([]);
  public pendingTasks = signal<TaskItem[]>([]);
  public events = signal<CalendarEvent[]>([]);

  constructor(
    private authService: AuthService,
    private channelApi: ChannelApiService,
    private taskApi: TaskApiService,
    private calendarApi: CalendarApiService
  ) {}

  ngOnInit(): void {
    this.channelApi.getChannels().subscribe({
      next: chs => this.channels.set(chs.slice(0, 4)),
      error: () => {}
    });

    this.taskApi.getTasks('pending').subscribe({
      next: ts => this.pendingTasks.set(ts.slice(0, 4)),
      error: () => {}
    });

    this.calendarApi.getEvents().subscribe({
      next: evs => this.events.set(evs.slice(0, 3)),
      error: () => {}
    });
  }
}
