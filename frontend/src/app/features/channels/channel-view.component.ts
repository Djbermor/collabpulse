import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChannelApiService } from '../../core/http/channel-api.service';
import { MessageApiService } from '../../core/http/message-api.service';
import { RealtimeMessageService } from '../../core/websocket/realtime-message.service';
import { TypingService } from '../../core/websocket/typing.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { TimeAgoPipe, FileSizePipe } from '../../shared/pipes/time-ago.pipe';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { Channel } from '../../core/models/workspace.model';
import { Message } from '../../core/models/message.model';

@Component({
  selector: 'app-channel-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AvatarComponent,
    TimeAgoPipe,
    FileSizePipe,
    LoadingStateComponent,
    EmptyStateComponent
  ],
  template: `
    <div class="flex-1 flex flex-col h-full w-full bg-slate-950 overflow-hidden relative">
      <!-- CHANNEL HEADER -->
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xs flex items-center justify-between px-4 shrink-0 z-10">
        <div class="flex items-center gap-3 truncate">
          <span class="text-slate-400 font-mono text-base font-bold">{{ channel()?.isPrivate ? '🔒' : '#' }}</span>
          <div class="truncate">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-bold text-slate-100 truncate">{{ channel()?.name || 'Cargando canal...' }}</h2>
              <span *ngIf="channel()?.isPinned" class="material-icons-round text-xs text-amber-400" title="Canal fijado">push_pin</span>
            </div>
            <p class="text-[11px] text-slate-400 truncate">{{ channel()?.topic || channel()?.description || 'Canal de colaboración' }}</p>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center gap-2">
          <!-- Member Count Badge -->
          <div class="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-300">
            <span class="material-icons-round text-sm text-slate-400">group</span>
            <span>{{ channel()?.membersCount || 1 }} miembros</span>
          </div>

          <!-- Pinned Messages -->
          <button
            type="button"
            (click)="togglePinnedMessages()"
            class="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Mensajes destacados"
          >
            <span class="material-icons-round text-base">push_pin</span>
          </button>
        </div>
      </header>

      <!-- MESSAGES FEED -->
      <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-4">
        <app-loading-state *ngIf="isLoading()" message="Cargando historial de mensajes..."></app-loading-state>

        <app-empty-state
          *ngIf="!isLoading() && messages().length === 0"
          icon="chat_bubble_outline"
          [title]="'¡Bienvenido a #' + (channel()?.name || 'este canal') + '!'"
          description="Este es el inicio de la conversación. Envía el primer mensaje para coordinar con tu equipo."
        ></app-empty-state>

        <!-- Message List -->
        <div *ngFor="let msg of messages()" class="flex gap-3 group hover:bg-slate-900/40 p-2 -mx-2 rounded-xl transition-colors relative">
          <!-- Sender Avatar -->
          <app-avatar
            [name]="msg.senderName"
            [imageUrl]="msg.senderAvatar"
            [size]="32"
          ></app-avatar>

          <!-- Message Body -->
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-baseline gap-2">
              <span class="text-xs font-semibold text-slate-200 hover:underline cursor-pointer">{{ msg.senderName }}</span>
              <span class="text-[10px] text-slate-500 font-mono">{{ msg.createdAt | timeAgo }}</span>
              <span *ngIf="msg.isPinned" class="text-[10px] text-amber-400 font-mono px-1 py-0.2 bg-amber-950/40 rounded border border-amber-900/40">Fijado</span>
            </div>

            <!-- Content -->
            <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words select-text">{{ msg.content }}</p>

            <!-- Attachments -->
            <div *ngIf="msg.attachments && msg.attachments.length > 0" class="pt-1.5 space-y-1">
              <div
                *ngFor="let att of msg.attachments"
                class="inline-flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs hover:border-slate-700 transition-colors"
              >
                <span class="material-icons-round text-base text-indigo-400">attach_file</span>
                <span class="font-medium text-slate-200">{{ att.name }}</span>
                <span class="text-[10px] text-slate-500">{{ att.size | fileSize }}</span>
              </div>
            </div>

            <!-- Reactions Bar -->
            <div *ngIf="msg.reactions && msg.reactions.length > 0" class="flex flex-wrap gap-1 pt-1">
              <button
                *ngFor="let r of msg.reactions"
                type="button"
                (click)="toggleReaction(msg.id, r.emoji)"
                class="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-full text-xs flex items-center gap-1 cursor-pointer transition-colors"
                [ngClass]="hasUserReacted(r) ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-300' : 'text-slate-300'"
              >
                <span>{{ r.emoji }}</span>
                <span class="text-[10px] font-bold">{{ r.count }}</span>
              </button>
            </div>

            <!-- Thread replies badge -->
            <button
              *ngIf="msg.replyCount > 0"
              type="button"
              (click)="openThread(msg)"
              class="inline-flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
            >
              <span class="material-icons-round text-xs">forum</span>
              <span>{{ msg.replyCount }} {{ msg.replyCount === 1 ? 'respuesta' : 'respuestas' }}</span>
            </button>
          </div>

          <!-- Message Actions on Hover -->
          <div class="hidden group-hover:flex items-center gap-0.5 absolute right-2 top-2 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-md">
            <button
              type="button"
              (click)="addQuickReaction(msg.id, '👍')"
              class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Me gusta"
            >👍</button>
            <button
              type="button"
              (click)="addQuickReaction(msg.id, '❤️')"
              class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Corazón"
            >❤️</button>
            <button
              type="button"
              (click)="addQuickReaction(msg.id, '🚀')"
              class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Cohete"
            >🚀</button>
            <button
              type="button"
              (click)="openThread(msg)"
              class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Responder en hilo"
            >
              <span class="material-icons-round text-sm">reply</span>
            </button>
            <button
              type="button"
              (click)="pinMessage(msg.id)"
              class="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Fijar mensaje"
            >
              <span class="material-icons-round text-sm">push_pin</span>
            </button>
          </div>
        </div>
      </div>

      <!-- TYPING INDICATOR -->
      <div *ngIf="typingUsersText()" class="px-4 py-1 text-[11px] text-slate-400 italic flex items-center gap-2">
        <span class="flex gap-0.5">
          <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
          <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </span>
        <span>{{ typingUsersText() }}</span>
      </div>

      <!-- MESSAGE COMPOSER -->
      <div class="p-3 border-t border-slate-800 bg-slate-900/40">
        <div class="bg-slate-900 border border-slate-800 rounded-xl focus-within:border-indigo-500/80 transition-colors p-2 space-y-2 shadow-sm">
          <!-- Textarea -->
          <textarea
            #messageInput
            [(ngModel)]="composerText"
            (keydown)="onKeyDown($event)"
            rows="2"
            [placeholder]="'Mensaje en #' + (channel()?.name || 'canal') + ' (Enter para enviar, Shift+Enter para salto de línea)...'"
            class="w-full bg-transparent border-0 resize-none text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden"
          ></textarea>

          <!-- Composer Toolbar -->
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <div class="flex items-center gap-1">
              <button
                type="button"
                (click)="addEmoji('👍')"
                class="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors text-xs cursor-pointer"
              >👍</button>
              <button
                type="button"
                (click)="addEmoji('🎉')"
                class="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors text-xs cursor-pointer"
              >🎉</button>
              <button
                type="button"
                (click)="addEmoji('🔥')"
                class="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors text-xs cursor-pointer"
              >🔥</button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Adjuntar archivo"
              >
                <span class="material-icons-round text-sm">attach_file</span>
              </button>
            </div>

            <!-- Send button -->
            <button
              type="button"
              (click)="sendMessage()"
              [disabled]="!composerText.trim() || isSending()"
              class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span>Enviar</span>
              <span class="material-icons-round text-xs">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ChannelViewComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;

  public channel = signal<Channel | null>(null);
  public messages = signal<Message[]>([]);
  public isLoading = signal<boolean>(true);
  public isSending = signal<boolean>(false);
  public composerText = '';

  private currentChannelId: string = '';
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private channelApi: ChannelApiService,
    private messageApi: MessageApiService,
    private realtimeMessages: RealtimeMessageService,
    private typingService: TypingService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const channelId = params.get('channelId');
      if (channelId) {
        this.currentChannelId = channelId;
        this.loadChannelData(channelId);
      }
    });

    // Subscribe to realtime message updates
    this.subscriptions.push(
      this.realtimeMessages.onMessageCreated().subscribe(msg => {
        if (msg.channelId === this.currentChannelId && !this.messages().some(m => m.id === msg.id)) {
          this.messages.update(list => [...list, msg]);
          this.scrollToBottom();
        }
      }),
      this.realtimeMessages.onReactionChanged().subscribe(event => {
        this.messages.update(list =>
          list.map(m => {
            if (m.id !== event.messageId) return m;
            const existingIdx = m.reactions.findIndex(r => r.emoji === event.emoji);
            let updatedReactions = [...m.reactions];

            if (event.action === 'added') {
              if (existingIdx >= 0) {
                updatedReactions[existingIdx] = {
                  ...updatedReactions[existingIdx],
                  count: updatedReactions[existingIdx].count + 1,
                  users: [...updatedReactions[existingIdx].users, event.userId]
                };
              } else {
                updatedReactions.push({ emoji: event.emoji, count: 1, users: [event.userId] });
              }
            } else if (event.action === 'removed' && existingIdx >= 0) {
              const count = updatedReactions[existingIdx].count - 1;
              if (count <= 0) {
                updatedReactions.splice(existingIdx, 1);
              } else {
                updatedReactions[existingIdx] = {
                  ...updatedReactions[existingIdx],
                  count,
                  users: updatedReactions[existingIdx].users.filter(u => u !== event.userId)
                };
              }
            }
            return { ...m, reactions: updatedReactions };
          })
        );
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  loadChannelData(channelId: string): void {
    this.isLoading.set(true);
    this.channelApi.getChannelById(channelId).subscribe({
      next: data => {
        this.channel.set(data);
        this.loadMessages(channelId);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadMessages(channelId: string): void {
    this.messageApi.getMessages({ channelId, limit: 50 }).subscribe({
      next: msgs => {
        this.messages.set(msgs);
        this.isLoading.set(false);
        this.scrollToBottom();
      },
      error: () => this.isLoading.set(false)
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const text = this.composerText.trim();
    if (!text || this.isSending()) return;

    this.isSending.set(true);

    // Optimistic UI update
    const currentUser = this.authService.currentUser();
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      tenantId: this.authService.activeTenantId(),
      workspaceId: this.channel()?.workspaceId || 'default',
      channelId: this.currentChannelId,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.fullName || 'Tú',
      senderAvatar: currentUser?.avatarUrl,
      content: text,
      type: 'text',
      attachments: [],
      reactions: [],
      replyCount: 0,
      isPinned: false,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString()
    };

    this.messages.update(list => [...list, optimisticMsg]);
    this.composerText = '';
    this.scrollToBottom();

    this.messageApi.sendMessage({
      channelId: this.currentChannelId,
      content: text
    }).subscribe({
      next: realMsg => {
        this.messages.update(list => list.map(m => m.id === tempId ? realMsg : m));
        this.isSending.set(false);
      },
      error: err => {
        this.isSending.set(false);
        this.toastService.error('Error al enviar el mensaje.');
        // Rollback
        this.messages.update(list => list.filter(m => m.id !== tempId));
      }
    });
  }

  addEmoji(emoji: string): void {
    this.composerText += emoji;
  }

  addQuickReaction(messageId: string, emoji: string): void {
    this.toggleReaction(messageId, emoji);
  }

  toggleReaction(messageId: string, emoji: string): void {
    this.messageApi.addReaction(messageId, emoji).subscribe({
      error: () => this.toastService.error('No se pudo aplicar la reacción')
    });
  }

  pinMessage(messageId: string): void {
    this.messageApi.pinMessage(messageId).subscribe({
      next: () => this.toastService.success('Mensaje fijado en el canal.'),
      error: () => this.toastService.error('Error al fijar mensaje.')
    });
  }

  hasUserReacted(reaction: any): boolean {
    const currentUserId = this.authService.currentUser()?.id;
    return currentUserId ? reaction.users.includes(currentUserId) : false;
  }

  typingUsersText(): string {
    const active = this.typingService.activeTypers().filter(t => t.channelId === this.currentChannelId);
    if (active.length === 0) return '';
    if (active.length === 1) return `${active[0].userName} está escribiendo...`;
    return `${active.length} personas están escribiendo...`;
  }

  openThread(message: Message): void {
    // Open thread drawer
    this.toastService.info(`Abriendo hilo para el mensaje de ${message.senderName}`);
  }

  togglePinnedMessages(): void {
    this.toastService.info('Visualizando mensajes destacados del canal');
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 50);
  }
}
