import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FileItem, ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FileApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/files`;

  constructor(private http: HttpClient) {}

  public getFiles(channelId?: string): Observable<FileItem[]> {
    const params: any = {};
    if (channelId) params.channelId = channelId;

    return this.http.get<ApiResponse<FileItem[]>>(this.baseUrl, { params }).pipe(
      map(res => res.data)
    );
  }

  public uploadFile(formData: FormData): Observable<FileItem> {
    return this.http.post<ApiResponse<FileItem>>(`${this.baseUrl}/upload`, formData).pipe(
      map(res => res.data)
    );
  }

  public deleteFile(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.success)
    );
  }
}
