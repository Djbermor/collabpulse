import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CalendarEvent } from '../models/task.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CalendarApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/calendar`;

  constructor(private http: HttpClient) {}

  public getEvents(startRange?: string, endRange?: string): Observable<CalendarEvent[]> {
    const params: any = {};
    if (startRange) params.start = startRange;
    if (endRange) params.end = endRange;

    return this.http.get<ApiResponse<CalendarEvent[]>>(`${this.baseUrl}/events`, { params }).pipe(
      map(res => res.data)
    );
  }

  public scheduleEvent(eventData: {
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    isAllDay?: boolean;
    attendeeUserIds?: string[];
  }): Observable<CalendarEvent> {
    return this.http.post<ApiResponse<CalendarEvent>>(`${this.baseUrl}/events`, eventData).pipe(
      map(res => res.data)
    );
  }

  public deleteEvent(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<{ success: boolean }>>(`${this.baseUrl}/events/${id}`).pipe(
      map(res => res.success)
    );
  }
}
