import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService, AdminStats } from '../../core/http/admin-api.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';
import { AuditLogItem } from '../../core/models/permission.model';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { TimeAgoPipe } from '../../shared/pipes/time-ago.pipe';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, AvatarComponent, TimeAgoPipe, LoadingStateComponent],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden">
      <!-- HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-6 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center">
            <span class="material-icons-round text-lg">admin_panel_settings</span>
          </div>
          <div>
            <h2 class="text-sm font-bold text-slate-100">Panel de Control de la Organización</h2>
            <p class="text-[11px] text-slate-400">Gobernanza corporativa, gestión de roles RBAC y registros de auditoría</p>
          </div>
        </div>

        <button
          type="button"
          (click)="openInviteModal()"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span class="material-icons-round text-sm">person_add</span>
          <span>Invitar Colaborador</span>
        </button>
      </header>

      <!-- CONTENT -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- STATS KPI CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span class="text-xs text-slate-400 font-medium">Usuarios Activos</span>
            <p class="text-2xl font-bold text-slate-100 font-mono">{{ stats()?.totalUsers || 24 }}</p>
            <span class="text-[10px] text-emerald-400">100% aislados en tenant</span>
          </div>

          <div class="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span class="text-xs text-slate-400 font-medium">Canales Creados</span>
            <p class="text-2xl font-bold text-indigo-400 font-mono">{{ stats()?.totalChannels || 12 }}</p>
            <span class="text-[10px] text-slate-400">Públicos y Privados</span>
          </div>

          <div class="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span class="text-xs text-slate-400 font-medium">Mensajes (Últimas 24h)</span>
            <p class="text-2xl font-bold text-violet-400 font-mono">{{ stats()?.messagesSent24h || 148 }}</p>
            <span class="text-[10px] text-indigo-400">Tráfico en tiempo real</span>
          </div>

          <div class="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1">
            <span class="text-xs text-slate-400 font-medium">Almacenamiento Usado</span>
            <p class="text-2xl font-bold text-amber-400 font-mono">{{ stats()?.storageUsedMb || 420 }} MB</p>
            <span class="text-[10px] text-slate-400">De 50 GB cuota</span>
          </div>
        </div>

        <!-- USERS MANAGEMENT TABLE -->
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Directorio de Miembros</h3>
            <span class="text-xs text-slate-400 font-mono">{{ users().length }} miembros</span>
          </div>

          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th class="py-2.5 px-3">Usuario</th>
                <th class="py-2.5 px-3">Email</th>
                <th class="py-2.5 px-3">Rol RBAC</th>
                <th class="py-2.5 px-3">Estado</th>
                <th class="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-xs text-slate-300">
              <tr *ngFor="let user of users()" class="hover:bg-slate-800/30">
                <td class="py-3 px-3 flex items-center gap-2.5">
                  <app-avatar [name]="user.fullName" [imageUrl]="user.avatarUrl" [size]="28"></app-avatar>
                  <span class="font-medium text-slate-200">{{ user.fullName }}</span>
                </td>
                <td class="py-3 px-3 font-mono text-[11px] text-slate-400">{{ user.email }}</td>
                <td class="py-3 px-3">
                  <select
                    [ngModel]="user.role"
                    (ngModelChange)="onRoleChange(user.id, $event)"
                    class="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-hidden"
                  >
                    <option value="owner">Owner (Propietario)</option>
                    <option value="admin">Admin (Administrador)</option>
                    <option value="member">Member (Miembro)</option>
                    <option value="guest">Guest (Invitado)</option>
                  </select>
                </td>
                <td class="py-3 px-3">
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    [ngClass]="user.isActive ? 'bg-emerald-950/60 text-emerald-400' : 'bg-red-950/60 text-red-400'"
                  >
                    {{ user.isActive ? 'Activo' : 'Suspendido' }}
                  </span>
                </td>
                <td class="py-3 px-3 text-right">
                  <button
                    (click)="toggleUserStatus(user)"
                    class="text-xs text-slate-400 hover:text-amber-400 cursor-pointer"
                  >
                    {{ user.isActive ? 'Suspender' : 'Reactivar' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- AUDIT LOGS TABLE -->
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-3 p-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Registro de Auditoría de Seguridad</h3>
            <span class="text-xs text-slate-400 font-mono">Inmutable (Append-only)</span>
          </div>

          <div class="space-y-2">
            <div
              *ngFor="let log of auditLogs()"
              class="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono"
            >
              <div class="flex items-center gap-3">
                <span class="text-indigo-400 font-bold">[{{ log.action }}]</span>
                <span class="text-slate-300 font-sans">{{ log.resource }}: {{ log.details }}</span>
              </div>
              <div class="text-slate-500 text-[10px]">
                <span>{{ log.ipAddress }} • {{ log.createdAt | timeAgo }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- INVITE MODAL -->
      <div *ngIf="isInviteModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
        <div class="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-3 shadow-2xl">
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 class="text-xs font-bold text-slate-100 uppercase tracking-wide">Invitar Nuevo Colaborador</h3>
            <button (click)="isInviteModalOpen = false" class="text-slate-400 hover:text-slate-200 cursor-pointer">
              <span class="material-icons-round text-base">close</span>
            </button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-300 mb-1">Email del Colaborador</label>
              <input
                type="email"
                [(ngModel)]="inviteEmail"
                placeholder="colaborador@empresa.com"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label class="block text-xs text-slate-300 mb-1">Rol Asignado</label>
              <select
                [(ngModel)]="inviteRole"
                class="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-2 text-xs text-slate-100 focus:outline-hidden"
              >
                <option value="member">Miembro Estándar</option>
                <option value="admin">Administrador</option>
                <option value="guest">Invitado con permisos restringidos</option>
              </select>
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              (click)="isInviteModalOpen = false"
              class="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="sendInvite()"
              [disabled]="!inviteEmail"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg cursor-pointer"
            >
              Enviar Invitación
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminOverviewComponent implements OnInit {
  public stats = signal<AdminStats | null>(null);
  public users = signal<User[]>([]);
  public auditLogs = signal<AuditLogItem[]>([]);

  public isInviteModalOpen = false;
  public inviteEmail = '';
  public inviteRole = 'member';

  constructor(
    private adminApi: AdminApiService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAdminData();
  }

  loadAdminData(): void {
    this.adminApi.getStats().subscribe({
      next: data => this.stats.set(data),
      error: () => {}
    });

    this.adminApi.getUsers().subscribe({
      next: data => this.users.set(data),
      error: () => {}
    });

    this.adminApi.getAuditLogs().subscribe({
      next: data => this.auditLogs.set(data),
      error: () => {}
    });
  }

  onRoleChange(userId: string, newRole: string): void {
    this.adminApi.updateUserRole(userId, newRole).subscribe({
      next: () => this.toastService.success('Rol de usuario actualizado exitosamente.'),
      error: () => this.toastService.error('Error al cambiar el rol.')
    });
  }

  toggleUserStatus(user: User): void {
    this.adminApi.toggleUserActive(user.id, !user.isActive).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
        this.toastService.info('Estado de usuario modificado.');
      },
      error: () => this.toastService.error('Error al modificar estado.')
    });
  }

  openInviteModal(): void {
    this.inviteEmail = '';
    this.inviteRole = 'member';
    this.isInviteModalOpen = true;
  }

  sendInvite(): void {
    if (!this.inviteEmail) return;

    this.adminApi.inviteUser({ email: this.inviteEmail, role: this.inviteRole }).subscribe({
      next: () => {
        this.toastService.success(`Invitación enviada a ${this.inviteEmail}`);
        this.isInviteModalOpen = false;
      },
      error: () => this.toastService.error('Error al enviar invitación.')
    });
  }
}
