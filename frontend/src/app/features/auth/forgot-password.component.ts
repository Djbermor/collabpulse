import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xl font-bold text-white tracking-tight">Recuperar Contraseña</h2>
        <p class="text-xs text-slate-400">Le enviaremos un enlace seguro para restablecer su clave.</p>
      </div>

      <div *ngIf="isSent" class="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-center space-y-2">
        <span class="material-icons-round text-3xl text-emerald-400">mark_email_read</span>
        <h3 class="text-xs font-semibold text-emerald-300">Correo Enviado</h3>
        <p class="text-[11px] text-slate-300">Si la dirección coincide con una cuenta activa, recibirá las instrucciones en breves minutos.</p>
      </div>

      <form *ngIf="!isSent" [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-300" for="email">Correo Electrónico</label>
          <input
            id="email"
            type="email"
            formControlName="email"
            placeholder="nombre@empresa.com"
            class="w-full h-10 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <button
          type="submit"
          [disabled]="form.invalid || isSubmitting"
          class="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span *ngIf="isSubmitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span>Enviar enlace de recuperación</span>
        </button>
      </form>

      <div class="text-center pt-2 border-t border-slate-800">
        <a [routerLink]="['/auth/login']" class="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1">
          <span class="material-icons-round text-sm">arrow_back</span>
          <span>Volver al inicio de sesión</span>
        </a>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  public form: FormGroup;
  public isSubmitting = false;
  public isSent = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.isSubmitting = true;
    this.authService.forgotPassword(this.form.value.email).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.isSent = true;
      },
      error: () => {
        this.isSubmitting = false;
        this.isSent = true;
      }
    });
  }
}
