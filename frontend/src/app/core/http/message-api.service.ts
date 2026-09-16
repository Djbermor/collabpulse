import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Message, Reaction } from '../models/message.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MessageApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/messages`;

  constructor(private http: HttpClient) {}

  public getMessages(params: {
    channelId?: string;
    conversationId?: string;
    limit?: number;
    before?: string;
  }): Observable<Message[]> {
    let httpParams = new HttpParams();
    if (params.channelId) httpParams = httpParams.set('channelId', params.channelId);
    if (params.conversationId) httpParams = httpParams.set('conversationId', params.conversationId);
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.before) httpParams = httpParams.set('before', params.before);

    return this.http.get<ApiResponse<Message[]>>(this.baseUrl, { params: httpParams }).pipe(
      map(res => res.data)
    );
  }

  public sendMessage(payload: {
    channelId?: string;
    conversationId?: string;
    parentId?: string;
    content: string;
    attachments?: any[];
  }): Observable<Message> {
    return this.http.post<ApiResponse<Message>>(this.baseUrl, payload).pipe(
      map(res => res.data)
    );
  }

  public updateMessage(id: string, content: string): Observable<Message> {
    return this.http.put<ApiResponse<Message>>(`${this.baseUrl}/${id}`, { content }).pipe(
      map(res => res.data)
    );
  }

  public deleteMessage(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }

  public addReaction(messageId: string, emoji: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${messageId}/reactions`, { emoji }).pipe(
      map(res => res.success)
    );
  }

  public pinMessage(messageId: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${messageId}/pin`, {}).pipe(
      map(res => res.success)
    );
  }

  public getPinnedMessages(channelId: string): Observable<Message[]> {
    return this.http.get<ApiResponse<Message[]>>(`${this.baseUrl}/pinned`, {
      params: { channelId }
    }).pipe(
      map(res => res.data)
    );
  }
}
