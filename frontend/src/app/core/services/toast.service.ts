import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  public toasts = signal<ToastMessage[]>([]);

  public show(message: string, type: ToastType = 'info', durationMs = 4000): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const toast: ToastMessage = { id, type, message, durationMs };

    this.toasts.update(current => [...current, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.remove(id), durationMs);
    }
  }

  public success(message: string, durationMs = 4000): void {
    this.show(message, 'success', durationMs);
  }

  public error(message: string, durationMs = 5000): void {
    this.show(message, 'error', durationMs);
  }

  public warning(message: string, durationMs = 4500): void {
    this.show(message, 'warning', durationMs);
  }

  public info(message: string, durationMs = 4000): void {
    this.show(message, 'info', durationMs);
  }

  public remove(id: string): void {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}
