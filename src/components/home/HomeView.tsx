import React from 'react';
import {
  Building2,
  MessageSquare,
  Hash,
  Users,
  Search,
  Plus,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Clock,
  Briefcase
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const HomeView: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    channels,
    conversations,
    selectChannel,
    selectConversation,
    setActiveView,
    setIsStartDmOpen,
    setIsCreateChannelOpen,
    setIsSearchOpen
  } = useApp();

  const activeChannels = channels.filter(c => !c.isArchived);
  const recentChannels = activeChannels.slice(0, 5);
  const recentConversations = conversations.slice(0, 5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 p-6 md:p-8 select-none">
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-6 md:p-8 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Nexora Enterprise Hub</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {getGreeting()}, {currentUser?.firstName || 'Colaborador'}
              </h1>
              <p className="text-sm text-slate-300 max-w-xl">
                Bienvenido al centro de colaboración empresarial. Gestiona tus conversaciones, canales y actividades en un único espacio unificado.
              </p>
              <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{currentUser?.jobTitle || 'Colaborador'}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rol: {currentUser?.role || 'Member'}</span>
                </div>
              </div>
            </div>

            {/* Current Organization Card */}
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-4 min-w-[240px] flex flex-col gap-2 shadow-lg">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Organización Activa
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-100 truncate">
                    {currentTenant?.name || 'Gestión Salud IPS'}
                  </h4>
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Estado Activo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setIsStartDmOpen(true)}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 transition-all text-left group shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                  Nuevo mensaje
                </h4>
                <p className="text-[11px] text-slate-400">Iniciar conversación 1:1</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => {
              if (activeChannels.length > 0) {
                selectChannel(activeChannels[0].id);
                setActiveView('channel');
              } else {
                setIsCreateChannelOpen(true);
              }
            }}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 transition-all text-left group shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                  Explorar canales
                </h4>
                <p className="text-[11px] text-slate-400">Ver y unirse a salas</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800/80 hover:border-indigo-500/40 transition-all text-left group shadow-sm cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100 group-hover:text-purple-400 transition-colors">
                  Directorio global
                </h4>
                <p className="text-[11px] text-slate-400">Buscar colaboradores</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        {/* Content Columns: Recent Channels & Direct Conversations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Recent Channels */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-slate-200 text-xs tracking-wide">
                  Canales en {currentTenant?.name || 'la organización'} ({activeChannels.length})
                </h3>
              </div>
              <button
                onClick={() => setIsCreateChannelOpen(true)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                title="Crear canal"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {recentChannels.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No hay canales disponibles en esta organización.
                </div>
              ) : (
                recentChannels.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      selectChannel(ch.id);
                      setActiveView('channel');
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <Hash className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-xs text-slate-200 group-hover:text-indigo-400 transition-colors truncate">
                          #{ch.name}
                        </div>
                        {ch.description && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {ch.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Recent Direct Conversations */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-slate-200 text-xs tracking-wide">
                  Mensajes Directos Recientes
                </h3>
              </div>
              <button
                onClick={() => setIsStartDmOpen(true)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-purple-400 transition-colors cursor-pointer"
                title="Nuevo mensaje directo"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {recentConversations.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No tienes conversaciones activas aún. Inicia un nuevo chat con un colaborador.
                </div>
              ) : (
                recentConversations.map(conv => {
                  const otherUser = conv.members?.find((m: any) => m.id !== currentUser?.id) || conv.members?.[0];
                  const name = otherUser?.displayName || otherUser?.firstName || 'Colaborador';
                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        selectConversation(conv.id);
                        setActiveView('conversation');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors text-left group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={otherUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                          alt={name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                        <div className="truncate">
                          <div className="font-semibold text-xs text-slate-200 group-hover:text-purple-400 transition-colors truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {otherUser?.jobTitle || 'Colaborador'}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
