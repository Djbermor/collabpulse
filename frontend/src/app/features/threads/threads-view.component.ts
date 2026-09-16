import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-threads-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="threads-view-container p-4">
      <h2 class="text-xl font-bold">Hilos de Conversación</h2>
      <p class="text-gray-500">Respuestas agrupadas y contexto por mensaje raíz.</p>
    </div>
  `
})
export class ThreadsViewComponent implements OnInit {
  ngOnInit(): void {}
}
