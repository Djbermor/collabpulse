import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Conversation } from '../models/message.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConversationApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/conversations`;

  constructor(private http: HttpClient) {}

  public getConversations(): Observable<Conversation[]> {
    return this.http.get<ApiResponse<Conversation[]>>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  public getConversationById(id: string): Observable<Conversation> {
    return this.http.get<ApiResponse<Conversation>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  public createDirectConversation(targetUserId: string): Observable<Conversation> {
    return this.http.post<ApiResponse<Conversation>>(this.baseUrl, {
      participantIds: [targetUserId],
      type: 'direct'
    }).pipe(
      map(res => res.data)
    );
  }
}
