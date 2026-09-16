import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Meeting } from '../models/task.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MeetingApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/meetings`;

  constructor(private http: HttpClient) {}

  public getMeetings(): Observable<Meeting[]> {
    return this.http.get<ApiResponse<Meeting[]>>(this.baseUrl).pipe(
      map(res => res.data)
    );
  }

  public getMeetingById(id: string): Observable<Meeting> {
    return this.http.get<ApiResponse<Meeting>>(`${this.baseUrl}/${id}`).pipe(
      map(res => res.data)
    );
  }

  public createMeeting(meeting: {
    title: string;
    channelId?: string;
    provider?: string;
    scheduledStartTime?: string;
  }): Observable<Meeting> {
    return this.http.post<ApiResponse<Meeting>>(this.baseUrl, meeting).pipe(
      map(res => res.data)
    );
  }

  public endMeeting(id: string): Observable<boolean> {
    return this.http.put<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/${id}/end`, {}).pipe(
      map(res => res.success)
    );
  }
}
