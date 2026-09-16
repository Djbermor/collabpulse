import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TaskItem, TaskStatus, TaskPriority } from '../models/task.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TaskApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  constructor(private http: HttpClient) {}

  public getTasks(status?: TaskStatus): Observable<TaskItem[]> {
    const params: any = {};
    if (status) params.status = status;

    return this.http.get<ApiResponse<TaskItem[]>>(this.baseUrl, { params }).pipe(
      map(res => res.data)
    );
  }

  public createTask(task: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    dueDate?: string;
    assigneeId?: string;
  }): Observable<TaskItem> {
    return this.http.post<ApiResponse<TaskItem>>(this.baseUrl, task).pipe(
      map(res => res.data)
    );
  }

  public updateTaskStatus(id: string, newStatus: TaskStatus): Observable<TaskItem> {
    return this.http.put<ApiResponse<TaskItem>>(`${this.baseUrl}/${id}/status`, { status: newStatus }).pipe(
      map(res => res.data)
    );
  }

  public deleteTask(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }
}
