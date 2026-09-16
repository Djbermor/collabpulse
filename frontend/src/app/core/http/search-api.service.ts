import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

export interface GlobalSearchResult {
  messages: any[];
  channels: any[];
  people: any[];
  files: any[];
  tasks: any[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/search`;

  constructor(private http: HttpClient) {}

  public search(query: string, filters?: { channelId?: string; fromUserId?: string; type?: string }): Observable<GlobalSearchResult> {
    const params: any = { q: query };
    if (filters?.channelId) params.channelId = filters.channelId;
    if (filters?.fromUserId) params.fromUserId = filters.fromUserId;
    if (filters?.type) params.type = filters.type;

    return this.http.get<ApiResponse<GlobalSearchResult>>(this.baseUrl, { params }).pipe(
      map(res => res.data)
    );
  }
}
