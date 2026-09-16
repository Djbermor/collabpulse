import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { UserApiService } from '../../core/http/user-api.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { UserSession, UserStatus } from '../../core/models/user.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-settings-view',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">manage_accounts</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Configuración & Perfil de Usuario</h2>
            <p class="text-[11px] text-slate-400">Preferencias personales, estado de presencia y seguridad de sesiones</p>
          </div>
        </div>

        <button
          type="button"
          (click)="saveProfile()"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors shadow-sm cursor-pointer"
        >
          Guardar Cambios
        </button>
      </header>

      <!-- CONTENT -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
        <!-- PROFILE CARD -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Información Personal</h3>

          <div class="flex items-center gap-4">
            <app-avatar
              [name]="currentUser()?.fullName || 'User'"
              [imageUrl]="currentUser()?.avatarUrl"
              [size]="64"
            ></app-avatar>
            <div class="space-y-1">
              <p class="text-sm font-semibold text-slate-100">{{ currentUser()?.fullName }}</p>
              <p class="text-xs text-slate-400">{{ currentUser()?.email }}</p>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 uppercase">
                Rol: {{ currentUser()?.role }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label class="block text-xs text-slate-300 mb-1">Nombre</label>
              <input
                type="text"
                [(ngModel)]="firstName"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">Apellido</label>
              <input
                type="text"
                [(ngModel)]="lastName"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <!-- STATUS CARD -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Estado de Presencia</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-slate-300 mb-1">Estado</label>
              <select
                [(ngModel)]="selectedStatus"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
              >
                <option value="online">🟢 En línea (Online)</option>
                <option value="away">🟡 Ausente (Away)</option>
                <option value="dnd">🔴 No molestar (Do Not Disturb)</option>
                <option value="offline">⚪ Desconectado (Invisible)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">Mensaje de estado personalizado</label>
              <input
                type="text"
                [(ngModel)]="statusMessage"
                placeholder="Ej. En reunión de arquitectura hasta las 4pm"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <!-- THEME SELECTION -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Apariencia</h3>
          <p class="text-xs text-slate-400">Seleccione el modo visual del sistema para su estación de trabajo.</p>

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              (click)="themeService.setTheme('dark')"
              class="px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2"
              [ngClass]="themeService.currentTheme() === 'dark' ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-800 bg-slate-950 text-slate-400'"
            >
              <span class="material-icons-round text-sm">dark_mode</span>
              <span>Oscuro (Dark)</span>
            </button>
            <button
              type="button"
              (click)="themeService.setTheme('light')"
              class="px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2"
              [ngClass]="themeService.currentTheme() === 'light' ? 'border-indigo-500 bg-indigo-950/40 text-indigo-300' : 'border-slate-800 bg-slate-950 text-slate-400'"
            >
              <span class="material-icons-round text-sm">light_mode</span>
              <span>Claro (Light)</span>
            </button>
          </div>
        </div>

        <!-- SESSIONS CARD -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Sesiones Activas</h3>
              <p class="text-xs text-slate-400">Dispositivos y navegadores actualmente conectados con su cuenta.</p>
            </div>
            <button
              (click)="revokeOtherSessions()"
              class="px-3 py-1 bg-red-950/60 border border-red-900/60 hover:bg-red-900/80 text-red-400 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cerrar las demás sesiones
            </button>
          </div>

          <div class="space-y-2">
            <div
              *ngFor="let s of sessions()"
              class="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <span class="material-icons-round text-slate-400 text-lg">laptop</span>
                <div>
                  <p class="text-xs font-medium text-slate-200">{{ s.deviceInfo }}</p>
                  <p class="text-[10px] text-slate-500 font-mono">{{ s.ipAddress }} • Activa hace un momento</p>
                </div>
              </div>
              <span *ngIf="s.isCurrent" class="text-[10px] font-bold text-emerald-400 px-2 py-0.5 bg-emerald-950/60 rounded border border-emerald-900/40">Esta sesión</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsViewComponent implements OnInit {
  public currentUser = this.authService.currentUser;
  public firstName = '';
  public lastName = '';
  public selectedStatus: UserStatus = 'online';
  public statusMessage = '';
  public sessions = signal<UserSession[]>([]);

  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    private userApi: UserApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const u = this.currentUser();
    if (u) {
      this.firstName = u.firstName || '';
      this.lastName = u.lastName || '';
      this.selectedStatus = u.status || 'online';
      this.statusMessage = u.statusText || '';
    }

    this.loadSessions();
  }

  loadSessions(): void {
    this.userApi.getSessions().subscribe({
      next: data => this.sessions.set(data),
      error: () => {}
    });
  }

  saveProfile(): void {
    this.userApi.updateProfile({
      firstName: this.firstName,
      lastName: this.lastName
    }).subscribe({
      next: updated => {
        this.userApi.updateStatus(this.selectedStatus, this.statusMessage).subscribe();
        this.toastService.success('Perfil y estado actualizados.');
      },
      error: () => this.toastService.error('Error al actualizar perfil.')
    });
  }

  revokeOtherSessions(): void {
    this.userApi.revokeAllOtherSessions().subscribe({
      next: () => {
        this.toastService.success('Todas las demás sesiones han sido revocadas.');
        this.loadSessions();
      }
    });
  }
}
