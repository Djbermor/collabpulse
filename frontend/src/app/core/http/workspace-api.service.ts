import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Workspace } from '../models/workspace.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/workspaces`;

  constructor(private http: HttpClient) {}

  public getWorkspaces(): Observable<Workspace[]> {
    return this.http.get<ApiResponse<Workspace[]>>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  public getWorkspaceById(id: string): Observable<Workspace> {
    return this.http.get<ApiResponse<Workspace>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  public createWorkspace(workspace: { name: string; slug: string; description?: string }): Observable<Workspace> {
    return this.http.post<ApiResponse<Workspace>>(this.baseUrl, workspace).pipe(
      map(res => res.data)
    );
  }

  public updateWorkspace(id: string, updates: Partial<Workspace>): Observable<Workspace> {
    return this.http.put<ApiResponse<Workspace>>(`${this.baseUrl}/${id}`, updates).pipe(
      map(res => res.data)
    );
  }
}
