import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User, UserSession } from '../models/user.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  constructor(private http: HttpClient) {}

  public getProfile(): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.baseUrl}/me`).pipe(
      map(res => res.data)
    );
  }

  public updateProfile(updates: Partial<User>): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.baseUrl}/profile`, updates).pipe(
      map(res => res.data)
    );
  }

  public updateStatus(status: string, statusText?: string): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/status`, { status, statusText }).pipe(
      map(res => res.success)
    );
  }

  public getSessions(): Observable<UserSession[]> {
    return this.http.get<ApiResponse<UserSession[]>>(`${this.baseUrl}/sessions`).pipe(
      map(res => res.data)
    );
  }

  public revokeSession(sessionId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/sessions/${sessionId}`).pipe(
      map(res => res.success)
    );
  }

  public revokeAllOtherSessions(): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/sessions/others`).pipe(
      map(res => res.success)
    );
  }
}
