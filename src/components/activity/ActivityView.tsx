import React, { useState } from 'react';
import {
  Bell,
  AtSign,
  MessageSquare,
  CheckSquare,
  Video,
  CheckCheck,
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const ActivityView: React.FC = () => {
  const { notifications, refreshNotifications, selectChannel, setActiveView, addToast } = useApp();
  const [filter, setFilter] = useState<'all' | 'mentions' | 'messages' | 'tasks' | 'meetings'>('all');

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    refreshNotifications();
    addToast('Todas las notificaciones marcadas como leídas', 'success');
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'mentions') return notif.type === 'Mention';
    if (filter === 'messages') return notif.type === 'DirectMessage' || notif.type === 'ChannelMessage';
    if (filter === 'tasks') return notif.type === 'TaskAssigned' || notif.type === 'TaskDue';
    if (filter === 'meetings') return notif.type === 'Invitation';
    return true;
  });

  return (
    <div id="activity-view" className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm">Centro de Actividad & Notificaciones</h2>
            <p className="text-[11px] text-slate-400">Menciones, asignaciones de tareas y novedades del equipo</p>
          </div>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Marcar todo como leído</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-2.5 border-b border-slate-800/60 bg-slate-900/20 flex gap-2 overflow-x-auto shrink-0">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'all' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('mentions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'mentions' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AtSign className="w-3.5 h-3.5" />
          <span>Menciones</span>
        </button>
        <button
          onClick={() => setFilter('messages')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'messages' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Mensajes</span>
        </button>
        <button
          onClick={() => setFilter('tasks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            filter === 'tasks' ? 'bg-indigo-600 text-white font-semibold shadow-xs' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Tareas</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
        {filteredNotifications.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-2">
            <Bell className="w-10 h-10 mx-auto text-slate-600/70" />
            <p className="font-medium text-slate-400">Estás al día</p>
            <p className="text-[11px]">No tienes notificaciones pendientes en esta categoría.</p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            let Icon = Bell;
            let iconBg = 'bg-slate-800 text-slate-400';

            if (notif.type === 'Mention') {
              Icon = AtSign;
              iconBg = 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/50';
            } else if (notif.type === 'TaskAssigned' || notif.type === 'TaskDue') {
              Icon = CheckSquare;
              iconBg = 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50';
            } else if (notif.type === 'Invitation') {
              Icon = Video;
              iconBg = 'bg-amber-950/80 text-amber-400 border border-amber-800/50';
            }

            return (
              <div
                key={notif.id}
                onClick={async () => {
                  if (!notif.isRead) {
                    await api.markNotificationRead(notif.id);
                    refreshNotifications();
                  }
                  if (notif.linkUrl?.includes('/channels/')) {
                    const match = notif.linkUrl.match(/channels\/([^/]+)/);
                    if (match) selectChannel(match[1]);
                  } else if (notif.type === 'TaskAssigned') {
                    setActiveView('tasks');
                  }
                }}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all cursor-pointer group ${
                  notif.isRead
                    ? 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                    : 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/50 shadow-xs'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-100 text-xs truncate group-hover:text-indigo-300 transition-colors">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed text-xs">
                    {notif.message}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all self-center" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
