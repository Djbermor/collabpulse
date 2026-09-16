import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../../core/http/task-api.service';
import { ToastService } from '../../core/services/toast.service';
import { TaskItem, TaskStatus, TaskPriority } from '../../core/models/task.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, LoadingStateComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">check_circle_outline</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Tablero de Tareas & Entregables</h2>
            <p class="text-[11px] text-slate-400">Gestión de flujo de trabajo colaborativo con estados en tiempo real</p>
          </div>
        </div>

        <!-- Actions -->
        <button
          type="button"
          (click)="openCreateModal()"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span class="material-icons-round text-sm">add</span>
          <span>Nueva Tarea</span>
        </button>
      </header>

      <!-- KANBAN BOARD CONTAINER -->
      <div class="flex-1 overflow-x-auto p-6">
        <app-loading-state *ngIf="isLoading()" message="Cargando tablero Kanban..."></app-loading-state>

        <div *ngIf="!isLoading()" class="flex gap-4 h-full min-w-[900px]">
          <!-- COLUMN 1: PENDING -->
          <div class="flex-1 flex flex-col bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                <h3 class="text-xs font-bold text-slate-200">Pendiente</h3>
              </div>
              <span class="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{{ pendingTasks().length }}</span>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
              <div
                *ngFor="let task of pendingTasks()"
                class="bg-slate-900 border border-slate-800 hover:border-slate-700 p-3 rounded-lg space-y-2 shadow-xs transition-colors"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-100 leading-snug">{{ task.title }}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" [ngClass]="getPriorityClass(task.priority)">
                    {{ task.priority }}
                  </span>
                </div>
                <p *ngIf="task.description" class="text-[11px] text-slate-400 line-clamp-2">{{ task.description }}</p>

                <div class="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span class="text-slate-500 font-mono" *ngIf="task.dueDate">📅 {{ task.dueDate | date:'shortDate' }}</span>
                  <button
                    (click)="changeStatus(task.id, 'in_progress')"
                    class="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer ml-auto"
                  >
                    Iniciar →
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUMN 2: IN PROGRESS -->
          <div class="flex-1 flex flex-col bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                <h3 class="text-xs font-bold text-indigo-400">En Progreso</h3>
              </div>
              <span class="text-xs font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full">{{ inProgressTasks().length }}</span>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
              <div
                *ngFor="let task of inProgressTasks()"
                class="bg-slate-900 border border-indigo-900/50 hover:border-indigo-700/80 p-3 rounded-lg space-y-2 shadow-xs transition-colors"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-100 leading-snug">{{ task.title }}</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase" [ngClass]="getPriorityClass(task.priority)">
                    {{ task.priority }}
                  </span>
                </div>
                <p *ngIf="task.description" class="text-[11px] text-slate-400 line-clamp-2">{{ task.description }}</p>

                <div class="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <button
                    (click)="changeStatus(task.id, 'pending')"
                    class="text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    ← Regresar
                  </button>
                  <button
                    (click)="changeStatus(task.id, 'completed')"
                    class="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    Completar ✓
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- COLUMN 3: COMPLETED -->
          <div class="flex-1 flex flex-col bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <h3 class="text-xs font-bold text-emerald-400">Completadas</h3>
              </div>
              <span class="text-xs font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full">{{ completedTasks().length }}</span>
            </div>

            <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
              <div
                *ngFor="let task of completedTasks()"
                class="bg-slate-900/70 border border-slate-800/70 p-3 rounded-lg space-y-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-medium text-slate-300 line-through leading-snug">{{ task.title }}</span>
                  <span class="material-icons-round text-emerald-400 text-sm">check_circle</span>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span class="text-[10px] text-slate-500">Completada</span>
                  <button
                    (click)="deleteTask(task.id)"
                    class="text-red-400 hover:text-red-300 cursor-pointer"
                    title="Eliminar tarea"
                  >
                    <span class="material-icons-round text-xs">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CREATE TASK MODAL -->
      <div *ngIf="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div class="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-3 shadow-2xl">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Nueva Tarea</h3>
            <button (click)="isModalOpen = false" class="text-slate-400 hover:text-slate-200 cursor-pointer">
              <span class="material-icons-round text-base">close</span>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-300 mb-1">Título de la tarea</label>
              <input
                type="text"
                [(ngModel)]="newTaskTitle"
                placeholder="Ej. Revisar especificaciones de arquitectura"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">Descripción</label>
              <textarea
                [(ngModel)]="newTaskDescription"
                rows="2"
                placeholder="Detalles sobre lo que se debe entregar..."
                class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-300 mb-1">Prioridad</label>
                <select
                  [(ngModel)]="newTaskPriority"
                  class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
                >
                  <option value="low">Baja (Low)</option>
                  <option value="medium">Media (Medium)</option>
                  <option value="high">Alta (High)</option>
                  <option value="urgent">Urgente (Urgent)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs text-slate-300 mb-1">Fecha Límite</label>
                <input
                  type="date"
                  [(ngModel)]="newTaskDueDate"
                  class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              (click)="isModalOpen = false"
              class="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="saveTask()"
              [disabled]="!newTaskTitle.trim()"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg cursor-pointer"
            >
              Guardar Tarea
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TaskBoardComponent implements OnInit {
  public tasks = signal<TaskItem[]>([]);
  public isLoading = signal<boolean>(true);
  public isModalOpen = false;

  public newTaskTitle = '';
  public newTaskDescription = '';
  public newTaskPriority: TaskPriority = 'medium';
  public newTaskDueDate = '';

  public pendingTasks = computed(() => this.tasks().filter(t => t.status === 'pending'));
  public inProgressTasks = computed(() => this.tasks().filter(t => t.status === 'in_progress'));
  public completedTasks = computed(() => this.tasks().filter(t => t.status === 'completed'));

  constructor(
    private taskApi: TaskApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.isLoading.set(true);
    this.taskApi.getTasks().subscribe({
      next: data => {
        this.tasks.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  openCreateModal(): void {
    this.newTaskTitle = '';
    this.newTaskDescription = '';
    this.newTaskPriority = 'medium';
    this.newTaskDueDate = '';
    this.isModalOpen = true;
  }

  saveTask(): void {
    if (!this.newTaskTitle.trim()) return;

    this.taskApi.createTask({
      title: this.newTaskTitle.trim(),
      description: this.newTaskDescription.trim(),
      priority: this.newTaskPriority,
      dueDate: this.newTaskDueDate ? new Date(this.newTaskDueDate).toISOString() : undefined
    }).subscribe({
      next: created => {
        this.tasks.update(list => [created, ...list]);
        this.toastService.success('Tarea creada correctamente.');
        this.isModalOpen = false;
      },
      error: () => this.toastService.error('Error al crear tarea.')
    });
  }

  changeStatus(id: string, status: TaskStatus): void {
    this.taskApi.updateTaskStatus(id, status).subscribe({
      next: updated => {
        this.tasks.update(list => list.map(t => t.id === id ? { ...t, status } : t));
        this.toastService.info('Estado de tarea actualizado.');
      },
      error: () => this.toastService.error('Error al actualizar estado.')
    });
  }

  deleteTask(id: string): void {
    this.taskApi.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update(list => list.filter(t => t.id !== id));
        this.toastService.success('Tarea eliminada.');
      },
      error: () => this.toastService.error('Error al eliminar tarea.')
    });
  }

  getPriorityClass(priority: TaskPriority): string {
    switch (priority) {
      case 'urgent': return 'bg-red-950/80 text-red-400 border border-red-800/60';
      case 'high': return 'bg-amber-950/80 text-amber-400 border border-amber-800/60';
      case 'medium': return 'bg-blue-950/80 text-blue-400 border border-blue-800/60';
      default: return 'bg-slate-800 text-slate-400';
    }
  }
}
