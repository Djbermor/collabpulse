import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="message-list-container space-y-3">
      <div *ngFor="let msg of messages" class="message-item p-2 hover:bg-slate-800 rounded">
        <span class="font-semibold text-indigo-400">{{ msg.senderName }}: </span>
        <span class="text-slate-200">{{ msg.content }}</span>
      </div>
    </div>
  `
})
export class MessageListComponent {
  @Input() messages: Array<{ senderName: string; content: string }> = [];
}
