import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Channel, ChannelMember } from '../models/workspace.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChannelApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/channels`;

  constructor(private http: HttpClient) {}

  public getChannels(): Observable<Channel[]> {
    return this.http.get<ApiResponse<Channel[]>>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  public getChannelById(id: string): Observable<Channel> {
    return this.http.get<ApiResponse<Channel>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  public createChannel(data: { name: string; description?: string; topic?: string; isPrivate?: boolean }): Observable<Channel> {
    return this.http.post<ApiResponse<Channel>>(this.baseUrl, data).pipe(
      map(res => res.data)
    );
  }

  public updateChannel(id: string, updates: Partial<Channel>): Observable<Channel> {
    return this.http.put<ApiResponse<Channel>>(`${this.baseUrl}/${id}`, updates).pipe(
      map(res => res.data)
    );
  }

  public archiveChannel(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }

  public getChannelMembers(channelId: string): Observable<ChannelMember[]> {
    return this.http.get<ApiResponse<ChannelMember[]>>(`${this.baseUrl}/${channelId}/members`).pipe(
      map(res => res.data)
    );
  }

  public addChannelMember(channelId: string, userId: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${channelId}/members`, { userId }).pipe(
      map(res => res.success)
    );
  }

  public removeChannelMember(channelId: string, userId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${channelId}/members/${userId}`).pipe(
      map(res => res.success)
    );
  }
}
