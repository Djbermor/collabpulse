import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse
} from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../services/toast.service';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const tenantId = authService.activeTenantId();
  const user = authService.currentUser();

  let modifiedReq = req.clone();

  // Attach Headers
  const headersConfig: Record<string, string> = {};
  if (token) {
    headersConfig['Authorization'] = `Bearer ${token}`;
  }
  if (tenantId) {
    headersConfig['X-Tenant-Id'] = tenantId;
  }
  if (user?.id) {
    headersConfig['X-User-Id'] = user.id;
  }

  modifiedReq = modifiedReq.clone({ setHeaders: headersConfig });

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized with automatic refresh token rotation
      if (error.status === 401 && !req.url.includes('/auth/login') && !req.url.includes('/auth/refresh-token')) {
        return authService.refreshToken().pipe(
          switchMap(newToken => {
            const retryReq = req.clone({
              setHeaders: {
                ...headersConfig,
                Authorization: `Bearer ${newToken}`
              }
            });
            return next(retryReq);
          }),
          catchError(refreshErr => {
            authService.logout();
            return throwError(() => refreshErr);
          })
        );
      }

      return throwError(() => error);
    })
  );
};

export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'Ha ocurrido un error inesperado';

      if (error.error && typeof error.error === 'object' && error.error.message) {
        errorMessage = error.error.message;
      } else {
        switch (error.status) {
          case 400:
            errorMessage = 'Datos de solicitud inválidos.';
            break;
          case 401:
            errorMessage = 'Sesión expirada. Por favor, inicie sesión nuevamente.';
            break;
          case 403:
            errorMessage = 'No tiene permisos para realizar esta acción.';
            break;
          case 404:
            errorMessage = 'El recurso solicitado no fue encontrado.';
            break;
          case 409:
            errorMessage = 'Conflicto con el estado actual del recurso.';
            break;
          case 422:
            errorMessage = 'Errores de validación en los campos enviados.';
            break;
          case 429:
            errorMessage = 'Demasiadas solicitudes. Espere un momento antes de reintentar.';
            break;
          case 500:
            errorMessage = 'Error interno del servidor.';
            break;
          case 503:
            errorMessage = 'Servicio temporalmente no disponible.';
            break;
        }
      }

      // Suppress toast for background heartbeat/polling if necessary
      if (!req.url.includes('/health')) {
        toastService.error(errorMessage);
      }

      return throwError(() => error);
    })
  );
};
