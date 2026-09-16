import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PermissionService } from '../permissions/permission.service';
import { SystemPermission } from '../models/permission.model';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Preserve intended return URL
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Already logged in, redirect to default workspace
  const tenantId = authService.activeTenantId();
  return router.createUrlTree([`/workspace/${tenantId || 'default'}`]);
};

export const permissionGuard = (requiredPermission: SystemPermission): CanActivateFn => {
  return () => {
    const permissionService = inject(PermissionService);
    const router = inject(Router);

    if (permissionService.hasPermission(requiredPermission)) {
      return true;
    }

    return router.createUrlTree(['/forbidden']);
  };
};

export const workspaceGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const workspaceId = route.paramMap.get('workspaceId');

  if (workspaceId) {
    authService.setTenantId(workspaceId);
  }
  return true;
};
