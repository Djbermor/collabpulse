import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { User } from '../models/user.model';
import { ApiResponse } from '../models/notification.model';
import { environment } from '../../../environments/environment';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  tenantId: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'collabpulse_access_token';
  private readonly REFRESH_KEY = 'collabpulse_refresh_token';
  private readonly USER_KEY = 'collabpulse_current_user';
  private readonly TENANT_KEY = 'collabpulse_active_tenant';

  // Angular Signals for reactive state
  private currentUserSignal = signal<User | null>(this.getStoredUser());
  private activeTenantIdSignal = signal<string>(this.getStoredTenantId() || environment.defaultTenantId);
  private isAuthenticatingSignal = signal<boolean>(false);

  // Readonly computed signals
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly activeTenantId = this.activeTenantIdSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.currentUserSignal());
  public readonly isAuthenticating = this.isAuthenticatingSignal.asReadonly();

  // Observable compatibility
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isRefreshingToken = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  public login(credentials: { email: string; password: string; tenantSlug?: string }): Observable<AuthResponse> {
    this.isAuthenticatingSignal.set(true);
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/login`, credentials).pipe(
      map(res => res.data),
      tap(authData => {
        this.setSession(authData);
        this.isAuthenticatingSignal.set(false);
      }),
      catchError(err => {
        this.isAuthenticatingSignal.set(false);
        return throwError(() => err);
      })
    );
  }

  public register(registrationData: {
    companyName: string;
    companySlug: string;
    adminFirstName: string;
    adminLastName: string;
    adminEmail: string;
    adminPassword: string;
  }): Observable<AuthResponse> {
    this.isAuthenticatingSignal.set(true);
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/register`, registrationData).pipe(
      map(res => res.data),
      tap(authData => {
        this.setSession(authData);
        this.isAuthenticatingSignal.set(false);
      }),
      catchError(err => {
        this.isAuthenticatingSignal.set(false);
        return throwError(() => err);
      })
    );
  }

  public refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<ApiResponse<AuthTokens>>(`${environment.apiBaseUrl}/auth/refresh-token`, { refreshToken }).pipe(
      map(res => res.data.accessToken),
      tap(newAccessToken => {
        localStorage.setItem(this.TOKEN_KEY, newAccessToken);
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  public forgotPassword(email: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${environment.apiBaseUrl}/auth/forgot-password`, { email }).pipe(
      map(res => res.success)
    );
  }

  public resetPassword(token: string, newPassword: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${environment.apiBaseUrl}/auth/reset-password`, { token, newPassword }).pipe(
      map(res => res.success)
    );
  }

  public verifyEmail(token: string): Observable<boolean> {
    return this.http.post<ApiResponse<{ success: boolean }>>(`${environment.apiBaseUrl}/auth/verify-email`, { token }).pipe(
      map(res => res.success)
    );
  }

  public logout(): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      this.http.post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken }).subscribe({
        error: () => {}
      });
    }

    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSignal.set(null);
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  public setTenantId(tenantId: string): void {
    this.activeTenantIdSignal.set(tenantId);
    localStorage.setItem(this.TENANT_KEY, tenantId);
  }

  public getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  public getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  public getCurrentUser(): User | null {
    return this.currentUserSignal();
  }

  public updateCurrentUserProfile(updatedUser: Partial<User>): void {
    const current = this.currentUserSignal();
    if (current) {
      const merged = { ...current, ...updatedUser };
      this.currentUserSignal.set(merged);
      this.currentUserSubject.next(merged);
      localStorage.setItem(this.USER_KEY, JSON.stringify(merged));
    }
  }

  private setSession(auth: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, auth.tokens.accessToken);
    localStorage.setItem(this.REFRESH_KEY, auth.tokens.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(auth.user));
    if (auth.tenantId) {
      this.setTenantId(auth.tenantId);
    }
    this.currentUserSignal.set(auth.user);
    this.currentUserSubject.next(auth.user);
  }

  private getStoredUser(): User | null {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private getStoredTenantId(): string | null {
    return localStorage.getItem(this.TENANT_KEY);
  }
}
