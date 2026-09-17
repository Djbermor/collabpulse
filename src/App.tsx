import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { ThreadDrawer } from './components/chat/ThreadDrawer';
import { PinnedMessagesModal } from './components/chat/PinnedMessagesModal';
import { TasksView } from './components/tasks/TasksView';
import { CalendarView } from './components/calendar/CalendarView';
import { MeetingRoom } from './components/meetings/MeetingRoom';
import { FilesView } from './components/files/FilesView';
import { AdminView } from './components/admin/AdminView';
import { ActivityView } from './components/activity/ActivityView';
import { SavedView } from './components/saved/SavedView';
import { SearchModal } from './components/modals/SearchModal';
import { CreateChannelModal } from './components/modals/CreateChannelModal';
import { InviteModal } from './components/modals/InviteModal';
import { UserProfileModal } from './components/modals/UserProfileModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { QuickActionModal } from './components/modals/QuickActionModal';
import { StartDmModal } from './components/modals/StartDmModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { IncomingCallModal } from './components/meetings/IncomingCallModal';
import { OutgoingCallModal } from './components/meetings/OutgoingCallModal';
import { CallWindow } from './components/calls/CallWindow';
import { CallProvider } from './context/CallContext';
import { CallsView } from './components/meetings/CallsView';
import { OfflineBanner } from './components/layout/OfflineBanner';
import { ToastContainer } from './components/layout/ToastContainer';
import { AuthScreen } from './components/auth/AuthScreen';
import { Loader2, ShieldAlert } from 'lucide-react';

const DisabledFeatureFallback: React.FC<{ name: string }> = ({ name }) => {
  const { setActiveView } = useApp();
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900/40 select-none">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-slate-100 mb-2">Funcionalidad no disponible en esta versión</h3>
      <p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
        El módulo <span className="font-semibold text-slate-200">{name}</span> está actualmente deshabilitado en esta versión MVP de Nexora. Puede ser habilitado por un administrador desde el panel de control.
      </p>
      <button
        onClick={() => setActiveView('channel')}
        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
      >
        Volver a Mensajería
      </button>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const {
    currentUser,
    isAuthChecking,
    activeView,
    activeMeeting,
    activeThreadParent,
    closeThread,
    isSearchOpen,
    setIsSearchOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isQuickActionOpen,
    setIsQuickActionOpen,
    setSidebarCollapsed,
    features
  } = useApp();

  // Global Keyboard Shortcuts (Keyboard-first principle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K -> Global Search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      // Cmd/Ctrl + B -> Toggle Sidebar
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      // Cmd/Ctrl + , -> Settings
      else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      // Escape -> Close topmost modal or thread
      else if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (isQuickActionOpen) setIsQuickActionOpen(false);
        else if (activeThreadParent) closeThread();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isSettingsOpen, isQuickActionOpen, activeThreadParent]);

  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs font-medium tracking-wide">Cargando sesión de Nexora Enterprise...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthScreen />
        <ToastContainer />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'channel':
      case 'conversation':
        return <ChatArea />;
      case 'activity':
        return features.activity ? <ActivityView /> : <DisabledFeatureFallback name="Actividad y Notificaciones" />;
      case 'saved':
        return features.saved ? <SavedView /> : <DisabledFeatureFallback name="Elementos Guardados" />;
      case 'tasks':
        return features.tasks ? <TasksView /> : <DisabledFeatureFallback name="Tablero de Tareas Kanban" />;
      case 'calendar':
        return features.calendar ? <CalendarView /> : <DisabledFeatureFallback name="Calendario Corporativo" />;
      case 'meeting':
        return (features.calls || features.videoCalls) ? (
          activeMeeting ? <MeetingRoom /> : <CallsView />
        ) : (
          <DisabledFeatureFallback name="Llamadas y Videollamadas" />
        );
      case 'files':
        return features.files ? <FilesView /> : <DisabledFeatureFallback name="Archivos y Documentos" />;
      case 'admin':
        return <AdminView />;
      default:
        return <ChatArea />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 antialiased overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Real-time Offline Warning Banner */}
      <OfflineBanner />

      {/* Top Header */}
      <Header />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Center Stage */}
        <main className="flex-1 flex overflow-hidden relative min-w-0 bg-slate-950">
          {renderActiveView()}
        </main>

        {/* Right Slide-over Thread Panel */}
        {activeThreadParent && <ThreadDrawer />}
      </div>

      {/* Modals & Dialogs */}
      <SearchModal />
      <CreateChannelModal />
      <InviteModal />
      <UserProfileModal />
      <PinnedMessagesModal />
      <SettingsModal />
      <QuickActionModal />
      <StartDmModal />
      <CreateGroupModal />

      {/* Call Modals (completely unmounted if calls are disabled) */}
      {(features.calls || features.videoCalls) && (
        <>
          <IncomingCallModal />
          <OutgoingCallModal />
          <CallWindow />
        </>
      )}

      {/* Global Toast Notification System */}
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <CallProvider>
        <MainLayout />
      </CallProvider>
    </AppProvider>
  );
}

