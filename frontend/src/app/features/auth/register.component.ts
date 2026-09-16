import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="space-y-6">
      <div class="space-y-1">
        <h2 class="text-xl font-bold text-white tracking-tight">Registrar Organización</h2>
        <p class="text-xs text-slate-400">Configure su empresa y cree la cuenta del administrador raíz.</p>
      </div>

      <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="space-y-3">
        <!-- Company Name -->
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-300" for="companyName">Nombre de la Organización</label>
          <input
            id="companyName"
            type="text"
            formControlName="companyName"
            (input)="onCompanyNameChange()"
            placeholder="Acme Corporation"
            class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <!-- Company Slug -->
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-300" for="companySlug">Identificador Único (Slug)</label>
          <div class="flex items-center">
            <span class="px-2.5 h-9 bg-slate-800 text-slate-400 text-xs flex items-center rounded-l-lg border border-r-0 border-slate-800 font-mono">collabpulse.com/</span>
            <input
              id="companySlug"
              type="text"
              formControlName="companySlug"
              placeholder="acme-corp"
              class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-r-lg px-3 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        <!-- Admin Name Row -->
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-300" for="adminFirstName">Nombre</label>
            <input
              id="adminFirstName"
              type="text"
              formControlName="adminFirstName"
              placeholder="Carlos"
              class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-semibold text-slate-300" for="adminLastName">Apellido</label>
            <input
              id="adminLastName"
              type="text"
              formControlName="adminLastName"
              placeholder="Gómez"
              class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        <!-- Admin Email -->
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-300" for="adminEmail">Email Corporativo del Administrador</label>
          <input
            id="adminEmail"
            type="email"
            formControlName="adminEmail"
            placeholder="carlos@acme.com"
            class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <!-- Password -->
        <div class="space-y-1">
          <label class="block text-xs font-semibold text-slate-300" for="adminPassword">Contraseña Maestra (min. 8 caracteres)</label>
          <input
            id="adminPassword"
            type="password"
            formControlName="adminPassword"
            placeholder="••••••••••••"
            class="w-full h-9 bg-slate-950/80 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          [disabled]="registerForm.invalid || isSubmitting"
          class="w-full h-10 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <span *ngIf="isSubmitting" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          <span>{{ isSubmitting ? 'Aprovisionando...' : 'Crear Organización y Acceder' }}</span>
        </button>
      </form>

      <div class="text-center pt-2 border-t border-slate-800">
        <p class="text-xs text-slate-400">
          ¿Ya tienes cuenta?
          <a [routerLink]="['/auth/login']" class="text-indigo-400 font-medium hover:underline ml-1">
            Iniciar Sesión
          </a>
        </p>
      </div>
    </div>
  `
})
export class RegisterComponent {
  public registerForm: FormGroup;
  public isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      companySlug: ['', [Validators.required, Validators.pattern('^[a-z0-9-]+$')]],
      adminFirstName: ['', [Validators.required]],
      adminLastName: ['', [Validators.required]],
      adminEmail: ['', [Validators.required, Validators.email]],
      adminPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  onCompanyNameChange(): void {
    const name = this.registerForm.get('companyName')?.value || '';
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.registerForm.patchValue({ companySlug: slug });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isSubmitting = true;
    this.authService.register(this.registerForm.value).subscribe({
      next: res => {
        this.toastService.success('¡Organización aprovisionada con éxito!');
        this.router.navigate(['/workspace', res.tenantId]);
      },
      error: err => {
        this.isSubmitting = false;
        this.toastService.error(err?.error?.message || 'Error al aprovisionar la organización.');
      }
    });
  }
}
