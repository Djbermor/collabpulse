import { Injectable, signal } from '@angular/core';
import { SignalRService } from './signalr.service';
import { UserStatus } from '../models/user.model';

export interface PresencePayload {
  userId: string;
  status: UserStatus;
  lastActiveAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PresenceService {
  private userStatuses = signal<Map<string, UserStatus>>(new Map());

  constructor(private signalR: SignalRService) {
    this.initPresenceListener();
  }

  public getStatus(userId: string): UserStatus {
    return this.userStatuses().get(userId) || 'offline';
  }

  public setStatus(userId: string, status: UserStatus): void {
    this.userStatuses.update(map => {
      const copy = new Map(map);
      copy.set(userId, status);
      return copy;
    });
  }

  private initPresenceListener(): void {
    this.signalR.on<PresencePayload>('user.presence').subscribe(event => {
      this.setStatus(event.userId, event.status);
    });
  }
}
