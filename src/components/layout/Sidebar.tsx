import React, { useState } from 'react';
import {
  Hash,
  Lock,
  Plus,
  MessageSquare,
  Users,
  CheckSquare,
  Calendar,
  Phone,
  Video,
  FileText,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Pin,
  UserPlus,
  Bell,
  Bookmark,
  ChevronLeft,
  X,
  Sparkles,
  Home
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserStatus } from '../../types';

export const Sidebar: React.FC = () => {
  const {
    currentWorkspace,
    channels,
    currentChannel,
    conversations,
    currentConversation,
    activeView,
    activeMeeting,
    currentUser,
    unreadCount,
    savedItems,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    selectChannel,
    selectConversation,
    setActiveView,
    setIsCreateChannelOpen,
    setIsInviteOpen,
    setIsStartDmOpen,
    setIsCreateGroupOpen,
    features
  } = useApp();

  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);

  const getStatusColor = (status: UserStatus = 'Offline') => {
    switch (status) {
      case 'Online': return 'bg-emerald-500';
      case 'Away': return 'bg-amber-500';
      case 'Busy': return 'bg-rose-500';
      case 'DoNotDisturb': return 'bg-purple-500';
      default: return 'bg-slate-600';
    }
  };

  const isOwnerOrAdmin = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';
  const directConversations = conversations.filter(c => !c.isGroup);
  const groupConversations = conversations.filter(c => c.isGroup);

  const sidebarContent = (
    <aside
      aria-label="Barra de navegación del espacio de trabajo"
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } bg-slate-950/95 border-r border-slate-800 flex flex-col h-full select-none text-xs transition-all duration-200 shrink-0`}
    >
      {/* Workspace Bar */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between min-h-[56px]">
        {!sidebarCollapsed ? (
          <>
            <div className="min-w-0 flex-1 mr-2">
              <div className="font-bold text-sm text-slate-100 truncate">
                {currentWorkspace?.name || 'Workspace'}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {currentWorkspace?.slug || 'principal'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsInviteOpen(true)}
                className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 transition-colors cursor-pointer"
                title="Invitar miembros a la organización"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Colapsar barra lateral"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col items-center gap-1">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expandir barra lateral"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Feature Navigation */}
      <div className="p-2 space-y-0.5 border-b border-slate-800/80">
        <button
          onClick={() => {
            setActiveView('home');
            setMobileSidebarOpen(false);
          }}
          className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
            activeView === 'home'
              ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Inicio"
        >
          <Home className="w-4 h-4 text-indigo-400 shrink-0" />
          {!sidebarCollapsed && <span>Inicio</span>}
        </button>

        {features.messaging !== false && (
          <button
            onClick={() => {
              if (channels.length > 0 && !currentChannel) selectChannel(channels[0].id);
              setActiveView('channel');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'channel' || activeView === 'conversation'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Mensajería & Canales"
          >
            <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
            {!sidebarCollapsed && <span>Mensajería</span>}
          </button>
        )}

        {features.activity && (
          <button
            onClick={() => {
              setActiveView('activity');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between ${sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'activity'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Actividad & Notificaciones"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell className="w-4 h-4 text-amber-400 shrink-0" />
              {!sidebarCollapsed && <span>Actividad</span>}
            </div>
            {!sidebarCollapsed && unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        )}

        {features.saved && (
          <button
            onClick={() => {
              setActiveView('saved');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between ${sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'saved'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Elementos Guardados"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Bookmark className="w-4 h-4 text-cyan-400 shrink-0" />
              {!sidebarCollapsed && <span>Guardados</span>}
            </div>
            {!sidebarCollapsed && savedItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono">
                {savedItems.length}
              </span>
            )}
          </button>
        )}

        {features.tasks && (
          <button
            onClick={() => {
              setActiveView('tasks');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'tasks'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Tablero de Tareas Kanban"
          >
            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            {!sidebarCollapsed && <span>Tablero de Tareas</span>}
          </button>
        )}

        {features.calendar && (
          <button
            onClick={() => {
              setActiveView('calendar');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'calendar'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Calendario Corporativo"
          >
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            {!sidebarCollapsed && <span>Calendario</span>}
          </button>
        )}

        {(features.calls || features.videoCalls) && (
          <button
            onClick={() => {
              setActiveView('meeting');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between ${sidebarCollapsed ? 'justify-center p-2' : 'px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'meeting'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Llamadas y Videollamadas"
          >
            <div className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              {!sidebarCollapsed && <span>Llamadas</span>}
            </div>
            {!sidebarCollapsed && activeMeeting && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>En vivo</span>
              </span>
            )}
          </button>
        )}

        {features.files && (
          <button
            onClick={() => {
              setActiveView('files');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'files'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Archivos y Documentos"
          >
            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
            {!sidebarCollapsed && <span>Archivos & Adjuntos</span>}
          </button>
        )}

        {isOwnerOrAdmin && (
          <button
            onClick={() => {
              setActiveView('admin');
              setMobileSidebarOpen(false);
            }}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-1.5'} rounded-lg font-medium transition-colors cursor-pointer ${
              activeView === 'admin'
                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Administración & Auditoría"
          >
            <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
            {!sidebarCollapsed && <span>Administración</span>}
          </button>
        )}
      </div>

      {/* Scrollable Channels, DMs, & Groups list */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Section: Canales */}
          {features.channels !== false && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1 text-slate-400 group">
                <button
                  onClick={() => setChannelsExpanded(!channelsExpanded)}
                  className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {channelsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>Canales ({channels.length})</span>
                </button>
                <button
                  onClick={() => setIsCreateChannelOpen(true)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Crear nuevo canal"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {channelsExpanded && (
                <div className="space-y-0.5">
                  {channels.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 italic">
                      No hay canales creados
                    </div>
                  ) : (
                    channels.map(ch => {
                      const isSelected = activeView === 'channel' && currentChannel?.id === ch.id;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => {
                            selectChannel(ch.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {ch.isPrivate ? (
                              <Lock className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                            ) : (
                              <Hash className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`} />
                            )}
                            <span className="truncate">{ch.name}</span>
                            {ch.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400/80 rotate-45 shrink-0" />}
                          </div>
                          {ch.unreadCount && ch.unreadCount > 0 ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                              {ch.unreadCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Mensajes Directos (1 a 1) */}
          {features.messaging !== false && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1 text-slate-400 group">
                <button
                  onClick={() => setDmsExpanded(!dmsExpanded)}
                  className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {dmsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>Mensajes Directos ({directConversations.length})</span>
                </button>
                <button
                  onClick={() => setIsStartDmOpen(true)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Nuevo mensaje directo"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {dmsExpanded && (
                <div className="space-y-0.5">
                  {directConversations.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 italic flex items-center justify-between">
                      <span>Sin conversaciones</span>
                      <button
                        onClick={() => setIsStartDmOpen(true)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium text-[10px] cursor-pointer"
                      >
                        Iniciar
                      </button>
                    </div>
                  ) : (
                    directConversations.map(conv => {
                      const isSelected = activeView === 'conversation' && currentConversation?.id === conv.id;
                      const otherUser = (conv as any).otherUser;
                      const displayName = (conv as any).displayName || 'Conversación';
                      const avatar = (conv as any).displayAvatar;

                      return (
                        <button
                          key={conv.id}
                          onClick={() => {
                            selectConversation(conv.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="relative shrink-0">
                              {avatar ? (
                                <img src={avatar} alt={displayName} className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px]">
                                  {displayName.substring(0, 2)}
                                </div>
                              )}
                              {otherUser && (
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-slate-950 ${getStatusColor(
                                    otherUser.status
                                  )}`}
                                />
                              )}
                            </div>
                            <span className="truncate">{displayName}</span>
                          </div>
                          {conv.unreadCount && conv.unreadCount > 0 ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                              {conv.unreadCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Grupos */}
          {features.groups !== false && (
            <div>
              <div className="flex items-center justify-between px-1 mb-1 text-slate-400 group">
                <button
                  onClick={() => setGroupsExpanded(!groupsExpanded)}
                  className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {groupsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span>Grupos ({groupConversations.length})</span>
                </button>
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  title="Crear nuevo grupo"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {groupsExpanded && (
                <div className="space-y-0.5">
                  {groupConversations.length === 0 ? (
                    <div className="px-2.5 py-2 text-[11px] text-slate-500 italic flex items-center justify-between">
                      <span>Sin grupos</span>
                      <button
                        onClick={() => setIsCreateGroupOpen(true)}
                        className="text-indigo-400 hover:text-indigo-300 font-medium text-[10px] cursor-pointer"
                      >
                        Crear grupo
                      </button>
                    </div>
                  ) : (
                    groupConversations.map(conv => {
                      const isSelected = activeView === 'conversation' && currentConversation?.id === conv.id;
                      const displayName = (conv as any).displayName || 'Grupo';

                      return (
                        <button
                          key={conv.id}
                          onClick={() => {
                            selectConversation(conv.id);
                            setMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-lg bg-indigo-900/60 border border-indigo-700/40 flex items-center justify-center text-indigo-300 text-[10px] shrink-0">
                              <Users className="w-3 h-3" />
                            </div>
                            <span className="truncate">{displayName}</span>
                          </div>
                          {conv.unreadCount && conv.unreadCount > 0 ? (
                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                              {conv.unreadCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer info */}
      {!sidebarCollapsed && (
        <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] text-slate-500 flex items-center justify-between">
          <div>
            <span>Tenant: </span>
            <span className="font-mono text-slate-400">{currentUser?.tenantId}</span>
          </div>
          <div className="font-mono text-emerald-400">v1.0.0</div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="md:hidden fixed inset-0 z-50 flex"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full bg-slate-950 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left">
            <div className="absolute top-2 right-2 z-20">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                aria-label="Cerrar barra lateral"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
