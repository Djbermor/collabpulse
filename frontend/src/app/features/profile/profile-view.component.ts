import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-view-container p-4">
      <h2 class="text-xl font-bold">Perfil de Usuario</h2>
      <p class="text-gray-500">Configuración de cuenta, presencia, avatar y credenciales.</p>
    </div>
  `
})
export class ProfileViewComponent {}
