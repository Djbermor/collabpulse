import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-direct-messages-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="direct-messages-container p-4">
      <h2 class="text-xl font-bold">Mensajes Directos</h2>
      <p class="text-gray-500">Conversaciones privadas directas y grupales en tiempo real.</p>
    </div>
  `
})
export class DirectMessagesViewComponent implements OnInit {
  ngOnInit(): void {}
}
