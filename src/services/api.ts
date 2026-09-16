import { ApiResponse, UserRole, UserStatus } from '../types';

class ApiClient {
  private tenantId: string = '';
  private workspaceId: string = '';
  private userId: string = '';
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<ApiResponse<{ token: string; refreshToken: string }>> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTenant = localStorage.getItem('collab_tenant_id');
      const savedWorkspace = localStorage.getItem('collab_workspace_id');
      const savedUser = localStorage.getItem('collab_user_id');
      const savedToken = localStorage.getItem('collab_token');
      const savedRefreshToken = localStorage.getItem('collab_refresh_token');

      if (savedTenant) this.tenantId = savedTenant;
      if (savedWorkspace) this.workspaceId = savedWorkspace;
      if (savedUser) this.userId = savedUser;
      if (savedToken) this.token = savedToken;
      if (savedRefreshToken) this.refreshToken = savedRefreshToken;
    }
  }

  public setTenantId(tenantId: string) {
    this.tenantId = tenantId;
    if (typeof window !== 'undefined') localStorage.setItem('collab_tenant_id', tenantId);
  }

  public getTenantId(): string {
    return this.tenantId;
  }

  public setWorkspaceId(workspaceId: string) {
    this.workspaceId = workspaceId;
    if (typeof window !== 'undefined') localStorage.setItem('collab_workspace_id', workspaceId);
  }

  public getWorkspaceId(): string {
    return this.workspaceId;
  }

  public setUserId(userId: string) {
    this.userId = userId;
    if (typeof window !== 'undefined') localStorage.setItem('collab_user_id', userId);
  }

  public getUserId(): string {
    return this.userId;
  }

  public setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('collab_token', token);
      else localStorage.removeItem('collab_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public setRefreshToken(token: string | null) {
    this.refreshToken = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('collab_refresh_token', token);
      else localStorage.removeItem('collab_refresh_token');
    }
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public isAuthenticated(): boolean {
    return !!this.token;
  }

  public clearSession() {
    this.token = null;
    this.refreshToken = null;
    this.userId = '';
    this.tenantId = '';
    this.workspaceId = '';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('collab_token');
      localStorage.removeItem('collab_refresh_token');
      localStorage.removeItem('collab_user_id');
      localStorage.removeItem('collab_tenant_id');
      localStorage.removeItem('collab_workspace_id');
    }
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const correlationId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Correlation-Id': correlationId,
      ...(this.tenantId ? { 'X-Tenant-Id': this.tenantId } : {}),
      ...(this.workspaceId ? { 'X-Workspace-Id': this.workspaceId } : {}),
      ...(this.userId && this.token ? { 'X-User-Id': this.userId } : {}),
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const isAuthRoute = endpoint.startsWith('/auth/login') ||
      endpoint.startsWith('/auth/register') ||
      endpoint.startsWith('/auth/logout') ||
      endpoint.startsWith('/auth/refresh-token') ||
      endpoint.startsWith('/auth/forgot-password') ||
      endpoint.startsWith('/auth/reset-password') ||
      endpoint.startsWith('/auth/verify-email') ||
      endpoint.startsWith('/auth/unlock') ||
      endpoint.startsWith('/auth/health') ||
      endpoint.startsWith('/auth/audit');

    try {
      const res = await fetch(`/api/v1${endpoint}`, {
        ...options,
        headers
      });

      const data = await res.json();

      // Handle 401 token expiration with Single-Flight Queued Refresh (never for auth endpoints)
      if (res.status === 401 && this.refreshToken && !isAuthRoute) {
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshAccessToken().finally(() => {
            this.refreshPromise = null;
          });
        }

        try {
          const refreshRes = await this.refreshPromise;
          if (refreshRes.success && refreshRes.data?.token) {
            this.setToken(refreshRes.data.token);
            if (refreshRes.data.refreshToken) {
              this.setRefreshToken(refreshRes.data.refreshToken);
            }
            // Retry original request with newly issued token
            headers['Authorization'] = `Bearer ${refreshRes.data.token}`;
            const retryRes = await fetch(`/api/v1${endpoint}`, {
              ...options,
              headers
            });
            return await retryRes.json();
          } else {
            // Refresh token has been revoked or expired
            this.clearSession();
          }
        } catch {
          this.clearSession();
        }
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Error de red al contactar al servidor',
        code: 'NETWORK_ERROR'
      };
    }
  }

  public get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  }

  // --- Auth & Sessions ---
  public login(identifierOrEmail: string, password?: string, workspaceId?: string) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifierOrEmail,
        email: identifierOrEmail,
        password,
        workspaceId
      })
    });
  }

  public register(payload: {
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    jobTitle?: string;
    tenantId?: string;
    role?: UserRole;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public refreshAccessToken() {
    return this.request('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });
  }

  public logout(sessionId?: string) {
    return this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  }

  public getAuthHealth() {
    return this.request('/auth/health');
  }

  public getAuditRequests(limit: number = 50, user?: string) {
    const query = new URLSearchParams({ limit: String(limit), ...(user ? { user } : {}) });
    return this.request(`/auth/audit/requests?${query.toString()}`);
  }

  public unlockIdentifier(identifier: string) {
    return this.request('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  }

  public logoutAll() {
    return this.request('/auth/logout-all', {
      method: 'POST'
    });
  }

  public getSessions() {
    return this.request('/auth/sessions');
  }

  public revokeSession(sessionId: string) {
    return this.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  }

  public forgotPassword(email: string) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public resetPassword(token: string, newPassword: string) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }

  public changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  public getMe() {
    return this.request('/auth/me');
  }

  public switchUser(userId: string) {
    return this.request('/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  public updateStatus(status: string, customStatus?: string) {
    return this.request('/auth/status', {
      method: 'POST',
      body: JSON.stringify({ status, customStatus })
    });
  }

  public updateProfile(payload: {
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    phone?: string;
    phoneNumber?: string;
    bio?: string;
    timeZone?: string;
    customStatus?: string;
    avatarUrl?: string;
  }) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  // --- Organizations & Multi-Tenant ---
  public getOrganizations() {
    return this.request<any[]>('/organizations');
  }

  public createOrganization(payload: { name: string; slug?: string; type?: string; industry?: string; primaryDomain?: string; logoUrl?: string }) {
    return this.request('/organizations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public getOrganization(id: string) {
    return this.request(`/organizations/${id}`);
  }

  public updateOrganization(id: string, payload: any) {
    return this.request(`/organizations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  public addOrganizationDomain(id: string, payload: { domain: string; isPrimary?: boolean }) {
    return this.request(`/organizations/${id}/domains`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public deleteOrganizationDomain(id: string, domainId: string) {
    return this.request(`/organizations/${id}/domains/${domainId}`, {
      method: 'DELETE'
    });
  }

  public switchOrganization(id: string) {
    return this.request(`/organizations/${id}/switch`, {
      method: 'POST'
    });
  }

  public lookupOrganizationByDomain(domain: string) {
    return this.request(`/organizations/lookup/by-domain?domain=${encodeURIComponent(domain)}`);
  }

  // --- Workspaces & Membership ---
  public getTenants() {
    return this.getOrganizations();
  }

  public getWorkspaces() {
    return this.request('/workspaces');
  }

  public createWorkspace(name: string, description?: string, timeZone?: string) {
    return this.request('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description, timeZone })
    });
  }

  public getWorkspaceMembers(query?: string) {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.request(`/workspaces/members${q}`);
  }

  public getWorkspaceUsers(query?: string) {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
    return this.request(`/workspaces/users${q}`);
  }

  public searchUsers(query?: string) {
    return this.getWorkspaceUsers(query);
  }

  public updateMemberRole(userId: string, role: UserRole) {
    return this.request(`/workspaces/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  public removeMember(userId: string) {
    return this.request(`/workspaces/members/${userId}`, {
      method: 'DELETE'
    });
  }

  public inviteMember(email: string, role: string) {
    return this.request('/workspaces/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
  }

  public inviteUser(email: string, role: string) {
    return this.inviteMember(email, role);
  }

  public getInvitations() {
    return this.request('/workspaces/invitations');
  }

  public revokeInvitation(id: string) {
    return this.request(`/workspaces/invitations/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Channels ---
  public getChannels() {
    return this.request('/channels');
  }

  public createChannel(payload: { name: string; description: string; topic?: string; isPrivate?: boolean }) {
    return this.request('/channels', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public updateChannel(id: string, payload: any) {
    return this.request(`/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public archiveChannel(id: string) {
    return this.request(`/channels/${id}/archive`, {
      method: 'POST'
    });
  }

  public getChannelMembers(id: string) {
    return this.request(`/channels/${id}/members`);
  }

  // --- Conversations (DMs) ---
  public getConversations() {
    return this.request('/conversations');
  }

  public startConversation(payload: { targetUserId?: string; memberIds?: string[]; isGroup?: boolean; name?: string }) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public createConversation(payload: { targetUserId?: string; memberIds?: string[]; isGroup?: boolean; name?: string }) {
    return this.startConversation(payload);
  }

  public addConversationMember(id: string, userId: string) {
    return this.request(`/conversations/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  }

  public removeConversationMember(id: string, userId: string) {
    return this.request(`/conversations/${id}/members/${userId}`, {
      method: 'DELETE'
    });
  }

  public leaveConversation(id: string) {
    return this.request(`/conversations/${id}/leave`, {
      method: 'POST'
    });
  }

  public renameConversation(id: string, name: string) {
    return this.request(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    });
  }

  public hideConversation(id: string) {
    return this.request(`/conversations/${id}/hide`, {
      method: 'POST'
    });
  }

  public deleteConversation(id: string) {
    return this.request(`/conversations/${id}`, {
      method: 'DELETE'
    });
  }


  // --- Messages ---
  public getMessages(params: { channelId?: string; conversationId?: string; parentMessageId?: string }) {
    const query = new URLSearchParams();
    if (params.channelId) query.set('channelId', params.channelId);
    if (params.conversationId) query.set('conversationId', params.conversationId);
    if (params.parentMessageId) query.set('parentMessageId', params.parentMessageId);
    return this.request(`/messages?${query.toString()}`);
  }

  public sendMessage(payload: { channelId?: string; conversationId?: string; parentMessageId?: string; content: string; attachments?: any[] }) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public editMessage(id: string, content: string) {
    return this.request(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
  }

  public deleteMessage(id: string) {
    return this.request(`/messages/${id}`, {
      method: 'DELETE'
    });
  }

  public toggleReaction(id: string, emoji: string) {
    return this.request(`/messages/${id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  }

  public addReaction(id: string, emoji: string) {
    return this.toggleReaction(id, emoji);
  }

  public removeReaction(id: string, emoji: string) {
    return this.toggleReaction(id, emoji);
  }

  public togglePin(id: string) {
    return this.request(`/messages/${id}/pin`, {
      method: 'POST'
    });
  }

  public togglePinMessage(id: string) {
    return this.togglePin(id);
  }

  public getChannelPins(channelId: string) {
    return this.request(`/channels/${channelId}/pins`);
  }

  public getThread(messageId: string) {
    return this.request(`/messages/${messageId}/thread`);
  }

  public getSavedMessages() {
    return this.request('/messages/saved');
  }

  public saveMessage(messageId: string, note?: string) {
    return this.request(`/messages/${messageId}/save`, {
      method: 'POST',
      body: JSON.stringify({ note })
    });
  }

  public unsaveMessage(messageId: string) {
    return this.request(`/messages/${messageId}/save`, {
      method: 'DELETE'
    });
  }

  public markChannelRead(channelId: string, messageId?: string) {
    return this.request(`/channels/${channelId}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageId })
    });
  }

  public markConversationRead(conversationId: string) {
    return this.request(`/conversations/${conversationId}/read`, {
      method: 'POST'
    });
  }

  public sendTyping(payload: { channelId?: string; conversationId?: string; isTyping: boolean }) {
    return this.request('/messages/typing', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // --- Tasks ---
  public getTasks(params?: { status?: string; priority?: string; assignedTo?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.assignedTo) query.set('assignedTo', params.assignedTo);
    return this.request(`/tasks?${query.toString()}`);
  }

  public createTask(payload: any) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public updateTask(id: string, payload: any) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public deleteTask(id: string) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE'
    });
  }

  public getTaskComments(taskId: string) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  public addTaskComment(taskId: string, content: string) {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  }

  public deleteTaskComment(taskId: string, commentId: string) {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE'
    });
  }


  // --- Calendar ---
  public getCalendarEvents() {
    return this.request('/calendar/events');
  }

  public createCalendarEvent(payload: any) {
    return this.request('/calendar/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public deleteCalendarEvent(id: string) {
    return this.request(`/calendar/events/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Meetings ---
  public getMeetings() {
    return this.request('/meetings');
  }

  public startMeeting(title?: string) {
    return this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  }

  public joinMeeting(id: string) {
    return this.request(`/meetings/${id}/join`, {
      method: 'POST'
    });
  }

  public updateMeetingMedia(id: string, mediaState: { isAudioMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }) {
    return this.request(`/meetings/${id}/media`, {
      method: 'POST',
      body: JSON.stringify(mediaState)
    });
  }

  public leaveMeeting(id: string) {
    return this.request(`/meetings/${id}/leave`, {
      method: 'POST'
    });
  }

  // --- WebRTC Signaling & Calls ---
  public sendSignal(targetUserId?: string, roomId?: string, signalType?: string, data?: any) {
    return this.request('/realtime/signal', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, roomId, signalType, data })
    });
  }

  public inviteCall(payload: { targetUserId?: string; conversationId?: string; channelId?: string; roomId?: string; isVideo?: boolean; title?: string } | string, conversationId?: string, isVideo: boolean = true) {
    let bodyPayload: any;
    if (typeof payload === 'string') {
      bodyPayload = { targetUserId: payload, conversationId, isVideo };
    } else {
      bodyPayload = payload;
    }
    return this.request('/realtime/signal/call/invite', {
      method: 'POST',
      body: JSON.stringify(bodyPayload)
    });
  }

  public cancelCall(payload: { callId: string; targetUserId?: string; conversationId?: string; channelId?: string; roomId?: string }) {
    return this.request('/realtime/signal/call/cancel', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public respondCall(callerId: string, callId: string, accepted: boolean, reason?: string, roomId?: string) {
    return this.request('/realtime/signal/call/response', {
      method: 'POST',
      body: JSON.stringify({ callerId, callId, accepted, reason, roomId })
    });
  }

  public endCall(payload: { roomId?: string; targetUserId?: string; callId?: string }) {
    return this.request('/realtime/signal/call/end', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // --- Files ---
  public getFiles(fileType?: string) {
    const query = fileType ? `?fileType=${encodeURIComponent(fileType)}` : '';
    return this.request(`/files${query}`);
  }

  public uploadFile(payload: { name: string; fileType: string; size: number; url?: string } | FormData) {
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      return this.request('/files/upload', {
        method: 'POST',
        body: payload
      });
    }
    return this.request('/files/upload', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public deleteFile(id: string) {
    return this.request(`/files/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Notifications ---
  public getNotifications() {
    return this.request('/notifications');
  }

  public markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'POST'
    });
  }

  public markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST'
    });
  }

  // --- Global Search ---
  public search(q: string) {
    return this.request(`/search?q=${encodeURIComponent(q)}`);
  }

  public globalSearch(q: string) {
    return this.search(q);
  }

  // --- Admin, Audit & Security ---
  public getAdminStats() {
    return this.request('/admin/stats');
  }

  public getAdminUsers() {
    return this.request<any[]>('/admin/users');
  }

  public updateUserRole(userId: string, role: string) {
    return this.request(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  public updateAccountStatus(userId: string, accountStatus: 'Active' | 'Suspended' | 'Inactive') {
    return this.request(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ accountStatus })
    });
  }

  public adminCreateUser(payload: { email: string; firstName: string; lastName: string; role?: string; jobTitle?: string; password?: string }) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public adminUpdateUser(userId: string, payload: { firstName?: string; lastName?: string; jobTitle?: string; role?: string; email?: string; accountStatus?: string; isActive?: boolean }) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  public adminDeleteUser(userId: string) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  public adminGetUser(userId: string) {
    return this.request(`/admin/users/${userId}`);
  }

  public getAuditLogs(params?: { action?: string; userId?: string; entity?: string; limit?: number; page?: number }) {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.entity) query.set('entity', params.entity);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.page) query.set('page', String(params.page));
    return this.request(`/admin/audit-logs?${query.toString()}`);
  }

  public getSecurityOverview() {
    return this.request('/admin/security/overview');
  }

  public updateWorkspaceSettings(payload: any) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }
}

export const api = new ApiClient();
