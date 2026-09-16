import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { ApplicationLayoutComponent } from './layouts/application-layout/application-layout.component';
import { authGuard, guestGuard, workspaceGuard, permissionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Authentication Routes
  {
    path: 'auth',
    component: AuthLayoutComponent,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register.component').then(m => m.RegisterComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
      }
    ]
  },

  // Authenticated Multi-Tenant Application Routes
  {
    path: 'workspace/:tenantId',
    component: ApplicationLayoutComponent,
    canActivate: [authGuard, workspaceGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home-dashboard.component').then(m => m.HomeDashboardComponent)
      },
      {
        path: 'channels/:channelId',
        loadComponent: () =>
          import('./features/channels/channel-view.component').then(m => m.ChannelViewComponent)
      },
      {
        path: 'messages/:conversationId',
        loadComponent: () =>
          import('./features/channels/channel-view.component').then(m => m.ChannelViewComponent)
      },
      {
        path: 'tasks',
        loadComponent: () =>
          import('./features/tasks/task-board.component').then(m => m.TaskBoardComponent)
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/calendar/calendar-view.component').then(m => m.CalendarViewComponent)
      },
      {
        path: 'meetings',
        loadComponent: () =>
          import('./features/meetings/meeting-room.component').then(m => m.MeetingRoomComponent)
      },
      {
        path: 'files',
        loadComponent: () =>
          import('./features/files/files-view.component').then(m => m.FilesViewComponent)
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notification-center.component').then(m => m.NotificationCenterComponent)
      },
      {
        path: 'search',
        loadComponent: () =>
          import('./features/search/search-overlay.component').then(m => m.SearchOverlayComponent)
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-view.component').then(m => m.SettingsViewComponent)
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/administration/admin-overview.component').then(m => m.AdminOverviewComponent),
        canActivate: [permissionGuard],
        data: { requiredPermission: 'admin.settings.manage' }
      }
    ]
  },

  // Fallback route
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
