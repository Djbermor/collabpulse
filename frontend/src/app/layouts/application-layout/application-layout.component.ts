import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SignalRService } from '../../core/websocket/signalr.service';
import { NotificationRealtimeService } from '../../core/websocket/notification-realtime.service';
import { ThemeService } from '../../core/services/theme.service';
import { ChannelApiService } from '../../core/http/channel-api.service';
import { ConversationApiService } from '../../core/http/conversation-api.service';
import { PermissionService } from '../../core/permissions/permission.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { PresenceIndicatorComponent } from '../../shared/components/presence-indicator/presence-indicator.component';
import { Channel } from '../../core/models/workspace.model';
import { Conversation } from '../../core/models/message.model';

@Component({
  selector: 'app-application-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AvatarComponent,
    BadgeComponent,
    PresenceIndicatorComponent
  ],
  template: `
    <div class="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none font-sans">
      <!-- TOP BAR -->
      <header class="h-12 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xs flex items-center justify-between px-3 sm:px-4 shrink-0 z-30">
        <!-- Left: Workspace & Mobile Toggle -->
        <div class="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            (click)="toggleMobileSidebar()"
            class="md:hidden p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Toggle Navigation"
          >
            <span class="material-icons-round text-xl">menu</span>
          </button>

          <div class="flex items-center gap-2 cursor-pointer hover:bg-slate-800/80 px-2 py-1 rounded-lg transition-colors" [routerLink]="['/workspace', currentTenantId()]">
            <div class="w-6 h-6 rounded bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              CP
            </div>
            <span class="font-semibold text-xs text-slate-100 tracking-tight hidden sm:inline">CollabPulse</span>
            <span class="text-[10px] text-indigo-400 uppercase font-mono px-1.5 py-0.5 bg-indigo-950/80 rounded border border-indigo-800/50">Enterprise</span>
          </div>
        </div>

        <!-- Center: Quick Search Trigger (Ctrl+K) -->
        <div class="flex-1 max-w-md mx-2 sm:mx-6">
          <button
            type="button"
            [routerLink]="['/workspace', currentTenantId(), 'search']"
            class="w-full h-8 bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 rounded-lg px-3 flex items-center justify-between text-xs transition-colors cursor-pointer group"
          >
            <span class="flex items-center gap-2 truncate">
              <span class="material-icons-round text-sm group-hover:text-indigo-400 transition-colors">search</span>
              <span class="truncate">Buscar mensajes, personas o tareas...</span>
            </span>
            <kbd class="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">⌘K</kbd>
          </button>
        </div>

        <!-- Right: Actions & User Profile -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- Connection Status Indicator -->
          <div
            class="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border"
            [ngClass]="connectionBadgeClass()"
          >
            <span class="w-1.5 h-1.5 rounded-full" [ngClass]="signalR.connectionState() === 'Connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"></span>
            <span>{{ signalR.connectionState() }}</span>
          </div>

          <!-- Theme Toggle -->
          <button
            type="button"
            (click)="themeService.toggleTheme()"
            class="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Cambiar tema claro/oscuro"
          >
            <span class="material-icons-round text-lg">{{ themeService.currentTheme() === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
          </button>

          <!-- Notifications Center -->
          <button
            type="button"
            [routerLink]="['/workspace', currentTenantId(), 'notifications']"
            class="relative p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Notificaciones"
          >
            <span class="material-icons-round text-lg">notifications</span>
            <span
              *ngIf="notificationService.unreadCount() > 0"
              class="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900"
            ></span>
          </button>

          <!-- User Menu Dropdown -->
          <div class="relative">
            <button
              type="button"
              (click)="toggleUserMenu()"
              class="flex items-center gap-2 p-1 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <app-avatar
                [name]="currentUser()?.fullName || 'User'"
                [imageUrl]="currentUser()?.avatarUrl"
                [size]="24"
                [status]="currentUser()?.status || 'online'"
              ></app-avatar>
              <span class="text-xs font-medium text-slate-200 hidden md:inline truncate max-w-[100px]">{{ currentUser()?.firstName }}</span>
            </button>

            <!-- Dropdown Menu -->
            <div
              *ngIf="isUserMenuOpen()"
              class="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in"
            >
              <div class="px-3 py-2 border-b border-slate-800">
                <p class="text-xs font-semibold text-slate-100 truncate">{{ currentUser()?.fullName }}</p>
                <p class="text-[11px] text-slate-400 truncate">{{ currentUser()?.email }}</p>
                <span class="inline-block mt-1 text-[10px] text-indigo-400 uppercase font-mono px-1.5 py-0.2 bg-indigo-950/80 rounded">
                  {{ currentUser()?.role }}
                </span>
              </div>

              <div class="py-1">
                <a
                  [routerLink]="['/workspace', currentTenantId(), 'settings']"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span class="material-icons-round text-base text-slate-400">person</span>
                  <span>Mi Perfil & Ajustes</span>
                </a>
                <a
                  *ngIf="permissionService.isAdminOrOwner()"
                  [routerLink]="['/workspace', currentTenantId(), 'admin']"
                  (click)="closeUserMenu()"
                  class="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span class="material-icons-round text-base text-slate-400">admin_panel_settings</span>
                  <span>Panel de Administración</span>
                </a>
              </div>

              <div class="border-t border-slate-800 pt-1">
                <button
                  type="button"
                  (click)="logout()"
                  class="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 transition-colors text-left cursor-pointer"
                >
                  <span class="material-icons-round text-base">logout</span>
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- BODY: SIDEBAR + MAIN CONTENT AREA -->
      <div class="flex flex-1 overflow-hidden relative">
        <!-- SIDEBAR -->
        <aside
          class="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0 transition-transform duration-200 z-20"
          [ngClass]="isMobileSidebarOpen() ? 'absolute inset-y-0 left-0 bg-slate-900 translate-x-0 shadow-2xl' : 'hidden md:flex'"
        >
          <!-- Navigation Core -->
          <div class="flex-1 overflow-y-auto px-2 py-3 space-y-4">
            <!-- Main Hub Links -->
            <div class="space-y-0.5">
              <a
                [routerLink]="['/workspace', currentTenantId()]"
                routerLinkActive="bg-indigo-600/20 text-indigo-400 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span class="material-icons-round text-base text-slate-400">home</span>
                <span>Inicio / Resumen</span>
              </a>
              <a
                [routerLink]="['/workspace', currentTenantId(), 'tasks']"
                routerLinkActive="bg-indigo-600/20 text-indigo-400 font-semibold"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span class="material-icons-round text-base text-slate-400">check_circle_outline</span>
                <span>Tablero de Tareas</span>
              </a>
              <a
                [routerLink]="['/workspace', currentTenantId(), 'calendar']"
                routerLinkActive="bg-indigo-600/20 text-indigo-400 font-semibold"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span class="material-icons-round text-base text-slate-400">calendar_today</span>
                <span>Calendario & Eventos</span>
              </a>
              <a
                [routerLink]="['/workspace', currentTenantId(), 'meetings']"
                routerLinkActive="bg-indigo-600/20 text-indigo-400 font-semibold"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span class="material-icons-round text-base text-slate-400">video_call</span>
                <span>Reuniones Virtuales</span>
              </a>
              <a
                [routerLink]="['/workspace', currentTenantId(), 'files']"
                routerLinkActive="bg-indigo-600/20 text-indigo-400 font-semibold"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span class="material-icons-round text-base text-slate-400">folder_open</span>
                <span>Archivos Compartidos</span>
              </a>
            </div>

            <!-- Channels Section -->
            <div class="space-y-1">
              <div class="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Canales</span>
                <button
                  type="button"
                  [routerLink]="['/workspace', currentTenantId(), 'channels', 'new']"
                  class="hover:text-slate-100 transition-colors cursor-pointer"
                  title="Crear canal"
                >
                  <span class="material-icons-round text-sm">add</span>
                </button>
              </div>

              <div class="space-y-0.5">
                <a
                  *ngFor="let ch of channels()"
                  [routerLink]="['/workspace', currentTenantId(), 'channels', ch.id]"
                  routerLinkActive="bg-slate-800 text-indigo-400 font-semibold"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors group"
                >
                  <div class="flex items-center gap-2 truncate">
                    <span class="text-slate-500 font-mono text-xs">{{ ch.isPrivate ? '🔒' : '#' }}</span>
                    <span class="truncate">{{ ch.name }}</span>
                  </div>
                  <app-badge *ngIf="ch.unreadCount > 0" [count]="ch.unreadCount" variant="primary"></app-badge>
                </a>
              </div>
            </div>

            <!-- Direct Messages Section -->
            <div class="space-y-1">
              <div class="flex items-center justify-between px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Mensajes Directos</span>
                <button
                  type="button"
                  [routerLink]="['/workspace', currentTenantId(), 'messages', 'new']"
                  class="hover:text-slate-100 transition-colors cursor-pointer"
                  title="Nuevo mensaje directo"
                >
                  <span class="material-icons-round text-sm">add</span>
                </button>
              </div>

              <div class="space-y-0.5">
                <a
                  *ngFor="let conv of conversations()"
                  [routerLink]="['/workspace', currentTenantId(), 'messages', conv.id]"
                  routerLinkActive="bg-slate-800 text-indigo-400 font-semibold"
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
                >
                  <div class="flex items-center gap-2 truncate">
                    <app-avatar
                      [name]="conv.otherUser?.fullName || 'User'"
                      [imageUrl]="conv.otherUser?.avatarUrl"
                      [size]="20"
                      [status]="conv.otherUser?.status || 'offline'"
                    ></app-avatar>
                    <span class="truncate">{{ conv.otherUser?.fullName || conv.name || 'Chat' }}</span>
                  </div>
                  <app-badge *ngIf="conv.unreadCount > 0" [count]="conv.unreadCount" variant="danger"></app-badge>
                </a>
              </div>
            </div>
          </div>

          <!-- Bottom Workspace Switcher / Status -->
          <div class="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span class="text-[11px] text-slate-400">PostgreSQL + Realtime</span>
            </div>
            <span class="text-[10px] text-slate-500 font-mono">v1.0.0</span>
          </div>
        </aside>

        <!-- MAIN VIEW OUTLET -->
        <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950 relative">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class ApplicationLayoutComponent implements OnInit, OnDestroy {
  public currentUser = this.authService.currentUser;
  public currentTenantId = this.authService.activeTenantId;
  public isUserMenuOpen = signal(false);
  public isMobileSidebarOpen = signal(false);

  public channels = signal<Channel[]>([]);
  public conversations = signal<Conversation[]>([]);

  constructor(
    public authService: AuthService,
    public signalR: SignalRService,
    public notificationService: NotificationRealtimeService,
    public themeService: ThemeService,
    public permissionService: PermissionService,
    private channelApi: ChannelApiService,
    private conversationApi: ConversationApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Connect to real-time hub
    this.signalR.connect();

    // Fetch initial channels and conversations
    this.loadChannels();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    this.signalR.disconnect();
  }

  loadChannels(): void {
    this.channelApi.getChannels().subscribe({
      next: data => this.channels.set(data),
      error: () => {}
    });
  }

  loadConversations(): void {
    this.conversationApi.getConversations().subscribe({
      next: data => this.conversations.set(data),
      error: () => {}
    });
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update(v => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update(v => !v);
  }

  logout(): void {
    this.authService.logout();
  }

  connectionBadgeClass(): string {
    const state = this.signalR.connectionState();
    switch (state) {
      case 'Connected':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40';
      case 'Connecting':
      case 'Reconnecting':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  }
}
