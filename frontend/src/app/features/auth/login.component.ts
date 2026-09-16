import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
        <p class="text-xs text-slate-400">Ingrese sus credenciales de acceso para entrar a su organización.</p>
      </div>

      <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-4">
        <!-- Email Field -->
        <div class="space-y-1.5">
          <label class="block text-xs font-semibold text-slate-300" for="email">Correo Electrónico</label>
          <div class="relative">
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="nombre@empresa.com"
              class="w-full h-10 bg-slate-950/80 border rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-colors"
              [ngClass]="emailErrors ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'"
            />
          </div>
          <p *ngIf="emailErrors" class="text-[11px] text-red-400">Ingrese un correo corporativo válido.</p>
        </div>

        <!-- Password Field -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-semibold text-slate-300" for="password">Contraseña</label>
            <a [routerLink]="['/auth/forgot-password']" class="text-[11px] text-indigo-400 hover:underline">
              ¿Olvidó su contraseña?
            </a>
          </div>
          <input
            id="password"
            type="password"
            formControlName="password"
            placeholder="••••••••••••"
            class="w-full h-10 bg-slate-950/80 border rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden transition-colors"
            [ngClass]="passwordErrors ? 'border-red-500 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500'"
          />
          <p *ngIf="passwordErrors" class="text-[11px] text-red-400">La contraseña es obligatoria.</p>
        </div>

        <!-- Remember Me Checkbox -->
        <div class="flex items-center gap-2">
          <input
            id="remember"
            type="checkbox"
            formControlName="rememberMe"
            class="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <label for="remember" class="text-xs text-slate-400 cursor-pointer select-none">Recordar en este dispositivo</label>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          [disabled]="loginForm.invalid || isSubmitting"
          class="w-full h-10 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <span *ngIf="isSubmitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span>{{ isSubmitting ? 'Verificando...' : 'Acceder al Workspace' }}</span>
        </button>
      </form>

      <!-- Registration link -->
      <div class="text-center pt-2 border-t border-slate-800">
        <p class="text-xs text-slate-400">
          ¿No tienes una organización?
          <a [routerLink]="['/auth/register']" class="text-indigo-400 font-medium hover:underline ml-1">
            Crear nuevo Workspace
          </a>
        </p>
      </div>
    </div>
  `
})
export class LoginComponent {
  public loginForm: FormGroup;
  public isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['admin@collabpulse.com', [Validators.required, Validators.email]],
      password: ['Password123!', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true]
    });
  }

  get emailErrors(): boolean {
    const ctrl = this.loginForm.get('email');
    return !!(ctrl && ctrl.touched && ctrl.invalid);
  }

  get passwordErrors(): boolean {
    const ctrl = this.loginForm.get('password');
    return !!(ctrl && ctrl.touched && ctrl.invalid);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isSubmitting = true;
    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: res => {
        this.toastService.success(`Bienvenido de nuevo, ${res.user.firstName}!`);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || `/workspace/${res.tenantId || 'default'}`;
        this.router.navigateByUrl(returnUrl);
      },
      error: err => {
        this.isSubmitting = false;
        this.toastService.error(err?.error?.message || 'Credenciales inválidas. Compruebe usuario y clave.');
      }
    });
  }
}
