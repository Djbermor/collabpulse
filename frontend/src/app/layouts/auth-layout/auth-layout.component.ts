import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      <!-- Ambient Glow Backdrop -->
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Auth Container -->
      <div class="w-full max-w-md z-10 space-y-6">
        <!-- Brand Header -->
        <div class="text-center space-y-2">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20 mb-2">
            <span class="material-icons-round text-2xl">all_inclusive</span>
          </div>
          <h1 class="text-2xl font-bold tracking-tight text-white font-display">CollabPulse</h1>
          <p class="text-xs text-slate-400">Plataforma Empresarial de Colaboración y Comunicación</p>
        </div>

        <!-- Outlet Card -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <router-outlet></router-outlet>
        </div>

        <!-- Footer Notice -->
        <p class="text-center text-[11px] text-slate-500">
          Protegido con autenticación criptográfica JWT y aislamiento estricto multi-tenant.
        </p>
      </div>
    </div>
  `
})
export class AuthLayoutComponent {}
