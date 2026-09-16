import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { NotificationItem, ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;

  constructor(private http: HttpClient) {}

  public getNotifications(): Observable<NotificationItem[]> {
    return this.http.get<ApiResponse<NotificationItem[]>>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  public markAsRead(id: string): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}/read`, {}).pipe(
      map(res => res.success)
    );
  }

  public markAllAsRead(): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/read-all`, {}).pipe(
      map(res => res.success)
    );
  }

  public deleteNotification(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }
}
