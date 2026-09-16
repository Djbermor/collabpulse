import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { SignalRService } from './signalr.service';
import { Message, Reaction } from '../models/message.model';

export interface ReactionEventPayload {
  messageId: string;
  emoji: string;
  userId: string;
  action: 'added' | 'removed';
}

@Injectable({
  providedIn: 'root'
})
export class RealtimeMessageService {
  constructor(private signalR: SignalRService) {}

  public onMessageCreated(): Observable<Message> {
    return this.signalR.on<Message>('message.created');
  }

  public onMessageUpdated(): Observable<Message> {
    return this.signalR.on<Message>('message.updated');
  }

  public onMessageDeleted(): Observable<{ messageId: string; channelId?: string; conversationId?: string }> {
    return this.signalR.on('message.deleted');
  }

  public onReactionChanged(): Observable<ReactionEventPayload> {
    return this.signalR.on<ReactionEventPayload>('message.reaction');
  }

  public onThreadReply(): Observable<{ parentId: string; reply: Message }> {
    return this.signalR.on('thread.reply');
  }
}
