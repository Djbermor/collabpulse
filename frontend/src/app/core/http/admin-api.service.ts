import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuditLogItem } from '../models/permission.model';
import { User, UserSession } from '../models/user.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

export interface AdminStats {
  totalUsers: number;
  activeWorkspaces: number;
  totalChannels: number;
  messagesSent24h: number;
  storageUsedMb: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  constructor(private http: HttpClient) {}

  public getStats(): Observable<AdminStats> {
    return this.http.get<ApiResponse<AdminStats>>(`${this.baseUrl}/stats`).pipe(
      map(res => res.data)
    );
  }

  public getUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.baseUrl}/users`).pipe(
      map(res => res.data)
    );
  }

  public updateUserRole(userId: string, role: string): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/users/${userId}/role`, { role }).pipe(
      map(res => res.success)
    );
  }

  public toggleUserActive(userId: string, isActive: boolean): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/users/${userId}/status`, { isActive }).pipe(
      map(res => res.success)
    );
  }

  public getAuditLogs(): Observable<AuditLogItem[]> {
    return this.http.get<ApiResponse<AuditLogItem[]>>(`${this.baseUrl}/audit-logs`).pipe(
      map(res => res.data)
    );
  }

  public inviteUser(inviteData: { email: string; role: string }): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/invitations`, inviteData).pipe(
      map(res => res.success)
    );
  }
}
