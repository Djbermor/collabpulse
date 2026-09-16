import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Message } from '../models/message.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ThreadApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/messages`;

  constructor(private http: HttpClient) {}

  public getThreadMessages(parentMessageId: string): Observable<Message[]> {
    return this.http.get<ApiResponse<Message[]>>(`${this.baseUrl}/thread/${parentMessageId}`).pipe(
      map(res => res.data)
    );
  }

  public replyToThread(parentMessageId: string, content: string, attachments?: any[]): Observable<Message> {
    return this.http.post<ApiResponse<Message>>(this.baseUrl, {
      parentId: parentMessageId,
      content,
      attachments
    }).pipe(
      map(res => res.data)
    );
  }
}
