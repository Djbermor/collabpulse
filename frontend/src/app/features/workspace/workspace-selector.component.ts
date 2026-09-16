import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-workspace-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="workspace-selector flex items-center gap-2 p-2">
      <span class="font-bold">Espacio de Trabajo:</span>
      <span class="bg-indigo-600 px-2 py-1 rounded text-sm text-white">Acme Corporation</span>
    </div>
  `
})
export class WorkspaceSelectorComponent {}
