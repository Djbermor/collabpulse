import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: any): void {
    // Avoid circular injection with ToastService
    const toastService = this.injector.get(ToastService);

    const message = error?.message || 'Error inesperado en la aplicación';
    console.error('Unhandled Global Client Exception:', error);

    // Only surface relevant user-facing errors, ignore cancellation/aborts
    if (!message.includes('ResizeObserver') && !message.includes('Navigation cancelled')) {
      toastService.error('Se ha producido un error inesperado en la interfaz.');
    }
  }
}
