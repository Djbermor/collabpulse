import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Tenant, Workspace, Channel, Conversation, Message, Notification, Meeting, ToastNotification, SavedItem, UserSettings, FeaturePermissions, DEFAULT_MVP_FEATURES } from '../types';
import { api } from '../services/api';
import { signalR } from '../services/signalr';
import { sound } from '../services/sound';

export type ActiveView = 'channel' | 'conversation' | 'tasks' | 'calendar' | 'meeting' | 'files' | 'admin' | 'settings' | 'activity' | 'saved';

interface AppContextType {
  currentUser: User | null;
  currentTenant: Tenant | null;
  tenants: Tenant[];
  currentWorkspace: Workspace | null;
  channels: Channel[];
  currentChannel: Channel | null;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  activeView: ActiveView;
  activeThreadParent: Message | null;
  activeMeeting: Meeting | null;
  notifications: Notification[];
  unreadCount: number;
  typingText: string | null;
  realtimeConnected: boolean;

  // Saved Items & Toasts & Settings
  savedItems: SavedItem[];
  toasts: ToastNotification[];
  userSettings: UserSettings;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  isAuthChecking: boolean;

  // Setters & Actions
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  register: (payload: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  setActiveView: (view: ActiveView) => void;
  selectChannel: (channelId: string) => void;
  selectConversation: (conversationId: string) => void;
  switchUser: (userId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  updateUserStatus: (status: string, customStatus?: string) => Promise<void>;
  openThread: (message: Message) => void;
  closeThread: () => void;
  startOrJoinMeeting: (meetingId?: string, title?: string, callType?: 'video' | 'audio') => Promise<void>;
  leaveMeeting: () => void;
  endActiveCall: () => Promise<void>;
  startCall: (options: { targetUserId?: string; conversationId?: string; channelId?: string; isVideo: boolean; title: string }) => Promise<void>;
  cancelOutgoingCall: () => Promise<void>;
  refreshChannels: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshNotifications: () => Promise<void>;

  addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  saveItem: (item: SavedItem) => void;
  unsaveItem: (id: string) => void;
  isItemSaved: (id: string) => boolean;
  updateUserSettings: (settings: Partial<UserSettings>) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  setMobileSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  setIsSearchOpen: (open: boolean) => void;
  setIsCreateChannelOpen: (open: boolean) => void;
  setIsInviteOpen: (open: boolean) => void;
  setIsProfileOpen: (open: boolean) => void;
  setIsPinnedOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsQuickActionOpen: (open: boolean) => void;
  isStartDmOpen: boolean;
  setIsStartDmOpen: (open: boolean) => void;
  isCreateGroupOpen: boolean;
  setIsCreateGroupOpen: (open: boolean) => void;
  features: FeaturePermissions;
  isFeatureEnabled: (feature: keyof FeaturePermissions) => boolean;
  updateFeaturePermissions: (permissions: Partial<FeaturePermissions>) => Promise<boolean>;
  incomingCall: any | null;
  setIncomingCall: (call: any | null) => void;
  outgoingCall: any | null;
  setOutgoingCall: (call: any | null) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [activeView, setActiveViewState] = useState<ActiveView>('channel');
  const [features, setFeatures] = useState<FeaturePermissions>(DEFAULT_MVP_FEATURES);
  const [activeThreadParent, setActiveThreadParent] = useState<Message | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);

  // Modals & Panels
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState<boolean>(false);
  const [isInviteOpen, setIsInviteOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState<boolean>(false);
  const [isStartDmOpen, setIsStartDmOpen] = useState<boolean>(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<any | null>(null);

  const outgoingCallRef = useRef<any | null>(null);
  outgoingCallRef.current = outgoingCall;
  const activeMeetingRef = useRef<Meeting | null>(null);
  activeMeetingRef.current = activeMeeting;
  const incomingCallRef = useRef<any | null>(null);
  incomingCallRef.current = incomingCall;
  const currentConversationRef = useRef<Conversation | null>(null);
  currentConversationRef.current = currentConversation;

  // Layout states
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Saved Items (Dynamically loaded from backend API)
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  // User Settings
  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('collabpulse_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      theme: 'dark',
      compactMode: false,
      soundEnabled: true,
      desktopNotifications: true,
      enterSendsMessage: true,
      reducedMotion: false,
      highContrast: false,
      language: 'es'
    };
  });

  // Apply theme to HTML root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', userSettings.theme);
  }, [userSettings.theme]);

  const updateUserSettings = (newSettings: Partial<UserSettings>) => {
    setUserSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('collabpulse_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleTheme = () => {
    updateUserSettings({ theme: userSettings.theme === 'dark' ? 'light' : 'dark' });
  };

  const addToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, message, type, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const saveItem = async (item: SavedItem) => {
    setSavedItems(prev => {
      if (prev.some(s => s.id === item.id)) return prev;
      return [item, ...prev];
    });
    if (item.type === 'message') {
      try {
        await api.saveMessage(item.id);
      } catch {}
    }
    addToast('Elemento guardado para después', 'success');
  };

  const unsaveItem = async (id: string) => {
    setSavedItems(prev => prev.filter(s => s.id !== id));
    try {
      await api.unsaveMessage(id);
    } catch {}
    addToast('Elemento eliminado de guardados', 'info');
  };

  const isItemSaved = (id: string) => {
    return savedItems.some(s => s.id === id);
  };

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (!api.isAuthenticated()) {
      setCurrentUser(null);
      setIsAuthChecking(false);
      return;
    }

    try {
      const meRes = await api.getMe();
      if (!meRes.success || !meRes.data?.user) {
        api.clearSession();
        setCurrentUser(null);
        setIsAuthChecking(false);
        return;
      }

      setCurrentUser(meRes.data.user);

      const [tenantsRes, workspacesRes, channelsRes, convsRes, notifsRes, savedRes, featuresRes] = await Promise.all([
        api.getTenants(),
        api.getWorkspaces(),
        api.getChannels(),
        api.getConversations(),
        api.getNotifications(),
        api.getSavedMessages(),
        api.getFeaturePermissions()
      ]);

      if (featuresRes && featuresRes.success && featuresRes.data) {
        setFeatures(featuresRes.data);
      }

      if (tenantsRes.success && tenantsRes.data) {
        setTenants(tenantsRes.data);
        const activeT = tenantsRes.data.find((t: Tenant) => t.id === api.getTenantId()) || tenantsRes.data[0];
        setCurrentTenant(activeT);
      }

      if (workspacesRes.success && workspacesRes.data) {
        setCurrentWorkspace(workspacesRes.data[0] || null);
      }

      if (channelsRes.success && channelsRes.data) {
        setChannels(channelsRes.data);
        if (channelsRes.data.length > 0 && !currentChannel && activeView === 'channel') {
          // Default to general channel
          const generalCh = channelsRes.data.find((c: Channel) => c.name === 'general') || channelsRes.data[0];
          setCurrentChannel(generalCh);
        }
      }

      if (convsRes.success && convsRes.data) {
        setConversations(convsRes.data);
      }

      if (notifsRes.success && notifsRes.data) {
        setNotifications(notifsRes.data);
      }

      if (savedRes.success && savedRes.data) {
        setSavedItems(savedRes.data.map((sm: any) => ({
          id: sm.id,
          type: 'message',
          title: `Mensaje guardado #${sm.channelName || 'chat'}`,
          subtitle: sm.authorName || 'Mensaje',
          content: sm.content,
          createdAt: sm.savedAt
        })));
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setIsAuthChecking(false);
    }
  }, [activeView, currentChannel]);

  const login = async (identifierOrEmail: string, password?: string) => {
    try {
      const res = await api.login(identifierOrEmail, password || '');
      if (res.success && res.data) {
        api.setToken(res.data.token);
        if (res.data.refreshToken) api.setRefreshToken(res.data.refreshToken);
        api.setUserId(res.data.user.id);
        if (res.data.user.tenantId) api.setTenantId(res.data.user.tenantId);
        if (res.data.workspace?.id) api.setWorkspaceId(res.data.workspace.id);
        setCurrentUser(res.data.user);
        await loadInitialData();
        return { success: true, mustChangePassword: res.data.mustChangePassword };
      }
      return {
        success: false,
        message: res.message || 'Credenciales inválidas',
        code: res.code,
        remainingAttempts: (res as any).remainingAttempts,
        remainingSeconds: (res as any).remainingSeconds
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error de autenticación' };
    }
  };

  const register = async (payload: any) => {
    try {
      const res = await api.register(payload);
      if (res.success && res.data) {
        api.setToken(res.data.token);
        if (res.data.refreshToken) api.setRefreshToken(res.data.refreshToken);
        api.setUserId(res.data.user.id);
        if (res.data.user.tenantId) api.setTenantId(res.data.user.tenantId);
        setCurrentUser(res.data.user);
        await loadInitialData();
        return { success: true };
      }
      return { success: false, message: res.message || 'Error al registrar usuario' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error de conexión con el servidor' };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {}
    signalR.stop();
    api.clearSession();
    setCurrentUser(null);
    setCurrentTenant(null);
    setCurrentWorkspace(null);
    setCurrentChannel(null);
    setCurrentConversation(null);
    setChannels([]);
    setConversations([]);
    setNotifications([]);
    setSavedItems([]);
    sound.stopAllRings();
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveMeeting(null);
    addToast('Has cerrado sesión correctamente', 'info');
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Connect SignalR / SSE
  useEffect(() => {
    if (!currentUser || !currentTenant) return;

    signalR.start(currentTenant.id, currentUser.id);

    signalR.on('connectionStateChanged', ({ isConnected }) => {
      setRealtimeConnected(isConnected);
    });

    signalR.on('UserTyping', ({ userName, channelId, conversationId }) => {
      if (
        (channelId && currentChannel && channelId === currentChannel.id) ||
        (conversationId && currentConversation && conversationId === currentConversation.id)
      ) {
        setTypingText(`${userName} está escribiendo...`);
      }
    });

    signalR.on('UserStoppedTyping', ({ channelId, conversationId }) => {
      if (
        (channelId && currentChannel && channelId === currentChannel.id) ||
        (conversationId && currentConversation && conversationId === currentConversation.id)
      ) {
        setTypingText(null);
      }
    });

    signalR.on('ChannelCreated', (newChannel: Channel) => {
      setChannels(prev => {
        if (prev.some(c => c.id === newChannel.id)) return prev;
        return [...prev, newChannel];
      });
    });

    signalR.on('ChannelUpdated', (updatedChannel: Channel) => {
      setChannels(prev => prev.map(c => c.id === updatedChannel.id ? updatedChannel : c));
      if (currentChannel?.id === updatedChannel.id) {
        setCurrentChannel(updatedChannel);
      }
    });

    signalR.on('ConversationCreated', (newConv: Conversation) => {
      setConversations(prev => {
        if (prev.some(c => c.id === newConv.id)) return prev;
        return [newConv, ...prev];
      });
      refreshConversations();
    });

    signalR.on('NotificationCreated', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    signalR.on('FeaturePermissionsUpdated', (updatedFeatures: FeaturePermissions) => {
      setFeatures(updatedFeatures);
    });

    const handleGlobalMessage = (msg: Message) => {
      if (!msg) return;
      if (msg.conversationId) {
        setConversations(prev => {
          const exists = prev.some(c => c.id === msg.conversationId);
          if (exists) {
            return prev.map(c => {
              if (c.id === msg.conversationId) {
                return {
                  ...c,
                  lastMessage: msg.content,
                  lastMessageAt: msg.createdAt,
                  unreadCount: (currentConversation?.id === msg.conversationId || msg.senderId === currentUser?.id)
                    ? (c.unreadCount || 0)
                    : (c.unreadCount || 0) + 1
                };
              }
              return c;
            });
          } else {
            refreshConversations();
            return prev;
          }
        });
      }
    };

    const handleGlobalCallEnded = () => {
      sound.stopAllRings();
      setActiveMeeting(null);
      setOutgoingCall(null);
      setIncomingCall(null);
      setActiveView(prev => (prev === 'meeting' ? 'calls' : prev));
    };
    window.addEventListener('collabpulse:call-ended', handleGlobalCallEnded);

    signalR.on('MessageCreated', handleGlobalMessage);
    signalR.on('MessageReceived', handleGlobalMessage);

    return () => {
      window.removeEventListener('collabpulse:call-ended', handleGlobalCallEnded);
      signalR.off('MessageCreated', handleGlobalMessage);
      signalR.off('MessageReceived', handleGlobalMessage);
    };
  }, [currentUser?.id, currentTenant?.id, currentChannel?.id, currentConversation?.id]);

  // Global Keyboard Shortcut: Ctrl/Cmd + K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsCreateChannelOpen(false);
        setIsInviteOpen(false);
        setIsProfileOpen(false);
        setIsPinnedOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectChannel = (channelId: string) => {
    const ch = channels.find(c => c.id === channelId);
    if (ch) {
      setCurrentChannel(ch);
      setCurrentConversation(null);
      setActiveView('channel');
      setActiveThreadParent(null);
      setTypingText(null);
    }
  };

  const selectConversation = (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setCurrentConversation(conv);
      setCurrentChannel(null);
      setActiveView('conversation');
      setActiveThreadParent(null);
      setTypingText(null);
    }
  };

  const switchUser = async (userId: string) => {
    const res = await api.switchUser(userId);
    if (res.success && res.data?.user) {
      api.setUserId(res.data.user.id);
      setCurrentUser(res.data.user);
      signalR.start(currentTenant?.id || '', res.data.user.id);
      refreshNotifications();
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      await api.switchOrganization(tenantId);
    } catch {}
    api.setTenantId(tenantId);
    const targetTenant = tenants.find(t => t.id === tenantId);
    if (targetTenant) setCurrentTenant(targetTenant);
    setCurrentChannel(null);
    setCurrentConversation(null);
    setActiveThreadParent(null);
    setChannels([]);
    setConversations([]);
    if (currentUser) {
      signalR.start(tenantId, currentUser.id);
    }
    await loadInitialData();
  };

  const updateUserStatus = async (status: string, customStatus?: string) => {
    const res = await api.updateStatus(status, customStatus);
    if (res.success && res.data) {
      setCurrentUser(res.data);
    }
  };

  const openThread = (message: Message) => {
    setActiveThreadParent(message);
  };

  const closeThread = () => {
    setActiveThreadParent(null);
  };

  const startCall = async (options: {
    targetUserId?: string;
    conversationId?: string;
    channelId?: string;
    isVideo: boolean;
    title: string;
  }) => {
    window.dispatchEvent(new CustomEvent('collabpulse:start-call', {
      detail: {
        targetUserId: options.targetUserId,
        conversationId: options.conversationId,
        channelId: options.channelId,
        callType: options.isVideo ? 'video' : 'audio',
        title: options.title
      }
    }));
  };

  const cancelOutgoingCall = async () => {
    sound.stopAllRings();
    if (outgoingCallRef.current) {
      const call = outgoingCallRef.current;
      setOutgoingCall(null);
      try {
        await api.cancelCall({
          callId: call.callId,
          roomId: call.roomId,
          targetUserId: call.targetUserId,
          conversationId: call.conversationId,
          channelId: call.channelId
        });
      } catch (e) {
        console.error('Error cancelling call:', e);
      }
    }
  };

  const endActiveCall = async () => {
    sound.stopAllRings();
    sound.playHangupTone();
    const roomId = activeMeetingRef.current?.meetingCode || activeMeetingRef.current?.id || outgoingCallRef.current?.roomId;
    if (roomId) {
      try {
        await api.endCall({ roomId });
        await api.leaveMeeting(roomId);
      } catch (e) {
        console.error('Error ending call:', e);
      }
    }
    setActiveMeeting(null);
    setOutgoingCall(null);
    setIncomingCall(null);
    setActiveView(currentConversationRef.current ? 'conversation' : 'channel');
  };

  const startOrJoinMeeting = async (meetingId?: string, title?: string, callType: 'video' | 'audio' = 'video') => {
    sound.stopAllRings();
    const resolvedRoomId = meetingId || ('meet-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    const resolvedTitle = title || (currentChannel ? `Reunión en #${currentChannel.name}` : 'Reunión en curso');

    window.dispatchEvent(new CustomEvent('collabpulse:join-call', {
      detail: {
        roomId: resolvedRoomId,
        title: resolvedTitle,
        callType,
        conversationId: currentConversation?.id,
        channelId: currentChannel?.id
      }
    }));

    if (meetingId) {
      const res = await api.joinMeeting(meetingId);
      if (res.success && res.data) {
        setActiveMeeting({ ...res.data, callType } as any);
      } else {
        setActiveMeeting({
          id: meetingId,
          meetingCode: meetingId,
          title: resolvedTitle,
          callType,
          isLive: true,
          participants: [],
          tenantId: currentTenant?.id || '',
          workspaceId: currentWorkspace?.id || '',
          hostId: currentUser?.id || '',
          createdAt: new Date().toISOString()
        } as any);
      }
    } else {
      const res = await api.startMeeting(resolvedTitle);
      if (res.success && res.data) {
        setActiveMeeting({ ...res.data, callType } as any);
      }
    }
  };


  const leaveMeeting = () => {
    endActiveCall();
  };

  const refreshChannels = async () => {
    const res = await api.getChannels();
    if (res.success && res.data) {
      setChannels(res.data);
    }
  };

  const refreshConversations = async () => {
    const res = await api.getConversations();
    if (res.success && res.data) {
      setConversations(res.data);
    }
  };

  const refreshNotifications = async () => {
    const res = await api.getNotifications();
    if (res.success && res.data) {
      setNotifications(res.data);
    }
  };

  const isFeatureEnabled = useCallback((feature: keyof FeaturePermissions) => {
    return !!features[feature];
  }, [features]);

  const updateFeaturePermissions = useCallback(async (permissions: Partial<FeaturePermissions>) => {
    const res = await api.updateFeaturePermissions(permissions);
    if (res.success && res.data) {
      setFeatures(res.data);
      addToast('Permisos de funcionalidades actualizados', 'success');
      return true;
    }
    addToast(res.message || 'Error al actualizar permisos', 'error');
    return false;
  }, [addToast]);

  const setActiveView = useCallback((view: ActiveView) => {
    const viewToFeature: Partial<Record<ActiveView, keyof FeaturePermissions>> = {
      channel: 'channels',
      conversation: 'messaging',
      tasks: 'tasks',
      calendar: 'calendar',
      meeting: 'calls',
      files: 'files',
      saved: 'saved',
      activity: 'activity'
    };
    const reqFeature = viewToFeature[view];
    if (reqFeature && !features[reqFeature]) {
      addToast('Funcionalidad no disponible en esta versión.', 'info');
      setActiveViewState('channel');
      return;
    }
    setActiveViewState(view);
  }, [features, addToast]);

  useEffect(() => {
    const viewToFeature: Partial<Record<ActiveView, keyof FeaturePermissions>> = {
      tasks: 'tasks',
      calendar: 'calendar',
      meeting: 'calls',
      files: 'files',
      saved: 'saved',
      activity: 'activity'
    };
    const reqFeature = viewToFeature[activeView];
    if (reqFeature && !features[reqFeature]) {
      setActiveViewState('channel');
    }
  }, [features, activeView]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentTenant,
        tenants,
        currentWorkspace,
        channels,
        currentChannel,
        conversations,
        currentConversation,
        activeView,
        activeThreadParent,
        activeMeeting,
        notifications,
        unreadCount,
        typingText,
        realtimeConnected,

        isSearchOpen,
        isCreateChannelOpen,
        isInviteOpen,
        isProfileOpen,
        isPinnedOpen,
        isSettingsOpen,
        isQuickActionOpen,

        savedItems,
        toasts,
        userSettings,
        sidebarCollapsed,
        mobileSidebarOpen,
        isAuthChecking,

        login,
        register,
        logout,
        setActiveView,
        selectChannel,
        selectConversation,
        switchUser,
        switchTenant,
        updateUserStatus,
        openThread,
        closeThread,
        startOrJoinMeeting,
        leaveMeeting,
        endActiveCall,
        startCall,
        cancelOutgoingCall,
        refreshChannels,
        refreshConversations,
        refreshNotifications,

        addToast,
        removeToast,
        saveItem,
        unsaveItem,
        isItemSaved,
        updateUserSettings,
        toggleTheme,
        setSidebarCollapsed,
        setMobileSidebarOpen,

        setIsSearchOpen,
        setIsCreateChannelOpen,
        setIsInviteOpen,
        setIsProfileOpen,
        setIsPinnedOpen,
        setIsSettingsOpen,
        setIsQuickActionOpen,
        isStartDmOpen,
        setIsStartDmOpen,
        isCreateGroupOpen,
        setIsCreateGroupOpen,
        features,
        isFeatureEnabled,
        updateFeaturePermissions,
        incomingCall,
        setIncomingCall,
        outgoingCall,
        setOutgoingCall
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
