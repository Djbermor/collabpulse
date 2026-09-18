import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Check,
  Building2,
  ChevronDown,
  User as UserIcon,
  Layers,
  Sparkles,
  Plus,
  Moon,
  Sun,
  Sliders,
  Menu,
  Shield,
  Wifi,
  WifiOff,
  LogOut
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserStatus } from '../../types';
import { api } from '../../services/api';
import { CreateOrganizationModal } from '../organizations/CreateOrganizationModal';

export const Header: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    tenants,
    switchTenant,
    switchUser,
    updateUserStatus,
    notifications,
    unreadCount,
    realtimeConnected,
    setIsSearchOpen,
    setIsProfileOpen,
    setIsSettingsOpen,
    setIsQuickActionOpen,
    userSettings,
    toggleTheme,
    setMobileSidebarOpen,
    refreshNotifications,
    addToast,
    setActiveView,
    logout
  } = useApp();

  const [showTenantDropdown, setShowTenantDropdown] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);

  const tenantRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tenantRef.current && !tenantRef.current.contains(event.target as Node)) setShowTenantDropdown(false);
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) setShowStatusMenu(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const getStatusColor = (status: UserStatus = 'Offline') => {
    switch (status) {
      case 'Online': return 'bg-emerald-500';
      case 'Away': return 'bg-amber-500';
      case 'Busy': return 'bg-rose-500';
      case 'DoNotDisturb': return 'bg-purple-500';
      default: return 'bg-slate-500';
    }
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    refreshNotifications();
    addToast('Notificaciones marcadas como leídas', 'success');
  };

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between select-none z-30 relative shrink-0">
      {/* Left: Brand & Tenant Switcher */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => setMobileSidebarOpen(prev => !prev)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Abrir navegación lateral"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div
          onClick={() => setActiveView('home')}
          className="flex items-center gap-2 cursor-pointer group"
          title="Ir a Inicio"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
              Nexora
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Enterprise
              </span>
            </span>
          </div>
        </div>

        {/* Tenant Selector */}
        <div className="relative" ref={tenantRef}>
          <button
            onClick={() => setShowTenantDropdown(!showTenantDropdown)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-xs text-slate-300 transition-colors border border-slate-800 cursor-pointer"
            title="Cambiar de Organización (Multi-tenant)"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-semibold text-slate-200 max-w-[110px] sm:max-w-[140px] truncate">
              {currentTenant?.name || 'Organización'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showTenantDropdown && (
            <div className="absolute left-0 mt-1.5 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 text-xs animate-in fade-in">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between">
                <span>Organizaciones</span>
                <span className="text-[10px] text-slate-500 lowercase">
                  {tenants.filter(t => (t as any).status !== 'INACTIVE' && (t as any).status !== 'Inactive').length} activas
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {tenants
                  .filter(t => (t as any).status !== 'INACTIVE' && (t as any).status !== 'Inactive')
                  .map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        switchTenant(t.id);
                        setShowTenantDropdown(false);
                        addToast(`Cambiado a organización ${t.name}`, 'info');
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800/80 transition-colors ${
                        currentTenant?.id === t.id ? 'text-indigo-400 font-semibold bg-indigo-950/30' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="truncate">
                          <div className="font-medium text-slate-200 truncate">{t.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{t.domain} • Plan {t.plan}</div>
                        </div>
                      </div>
                      {currentTenant?.id === t.id && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
              </div>
              <div className="pt-1 mt-1 border-t border-slate-800">
                <button
                  onClick={() => {
                    setShowTenantDropdown(false);
                    setIsCreateOrgOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/80 font-medium transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear nueva organización</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-xl mx-2 sm:mx-4">
        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-all shadow-inner group cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors shrink-0" />
            <span className="truncate">Buscar mensajes, canales, tareas, archivos...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 rounded border border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Action (+), Realtime badge, Theme toggle, Settings, User Switcher, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Action (+) Button */}
        <button
          onClick={() => setIsQuickActionOpen(true)}
          className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs cursor-pointer"
          title="Crear nuevo elemento (canal, tarea, reunión, archivo)"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Realtime Pulse Indicator */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400"
          title={realtimeConnected ? 'Conectado a SignalR / SSE Hub' : 'Reconectando a SignalR...'}
        >
          <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-medium text-slate-300 font-mono">
            {realtimeConnected ? 'SignalR Live' : 'Conectando'}
          </span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title={userSettings.theme === 'dark' ? 'Cambiar a tema Claro' : 'Cambiar a tema Oscuro'}
        >
          {userSettings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Preferencias de la aplicación"
        >
          <Sliders className="w-4 h-4" />
        </button>



        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors relative cursor-pointer"
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-950 animate-pulse" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-1.5 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs animate-in fade-in">
              <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-slate-100">Notificaciones</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                  >
                    Marcar todas leídas
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs">
                    No tienes notificaciones pendientes
                  </div>
                ) : (
                  notifications.slice(0, 5).map(notif => (
                    <div
                      key={notif.id}
                      className={`p-3 hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        !notif.isRead ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      <div className="font-semibold text-slate-200 text-xs">{notif.title}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{notif.message}</div>
                      <div className="text-[9px] text-slate-500 mt-1 font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Status and Avatar */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
            title="Estado y perfil"
          >
            <div className="relative">
              <img
                src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={currentUser?.firstName}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
              />
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${getStatusColor(
                  currentUser?.status
                )}`}
              />
            </div>
          </button>

          {showStatusMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 text-xs animate-in fade-in">
              <div className="px-2 py-1.5 border-b border-slate-800 mb-2">
                <div className="font-semibold text-slate-100">
                  {currentUser?.firstName} {currentUser?.lastName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.email}</div>
                {currentUser?.customStatus && (
                  <div className="mt-1 text-[11px] text-indigo-300 italic truncate">
                    "{currentUser.customStatus}"
                  </div>
                )}
              </div>

              <div className="mb-2">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  Estado de Presencia
                </div>
                {(['Online', 'Away', 'Busy', 'DoNotDisturb', 'Offline'] as UserStatus[]).map(st => (
                  <button
                    key={st}
                    onClick={() => {
                      updateUserStatus(st);
                      setShowStatusMenu(false);
                      addToast(`Estado cambiado a ${st}`, 'info');
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(st)}`} />
                      <span>{st === 'Online' ? 'En línea' : st === 'Away' ? 'Ausente' : st === 'Busy' ? 'Ocupado' : st === 'DoNotDisturb' ? 'No molestar' : 'Desconectado'}</span>
                    </div>
                    {currentUser?.status === st && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1">
                <button
                  onClick={() => {
                    setShowStatusMenu(false);
                    setIsProfileOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Mi Perfil</span>
                </button>

                <button
                  onClick={() => {
                    setShowStatusMenu(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-slate-300 flex items-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preferencias</span>
                </button>

                <button
                  onClick={() => {
                    setShowStatusMenu(false);
                    logout();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-800/80 mt-1 pt-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateOrganizationModal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
      />
    </header>
  );
};
