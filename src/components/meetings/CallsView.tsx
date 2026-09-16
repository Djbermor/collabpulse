import React, { useState, useEffect } from 'react';
import { Phone, Video, Users, Hash, Plus, ArrowRight, Sparkles, Shield, UserCheck, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { User, Channel } from '../../types';

export const CallsView: React.FC = () => {
  const {
    currentUser,
    channels,
    startCall,
    startOrJoinMeeting,
    addToast
  } = useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [customRoomCode, setCustomRoomCode] = useState('');

  useEffect(() => {
    async function loadDirectory() {
      try {
        setLoadingUsers(true);
        const res = await api.getWorkspaceUsers();
        if (res.success && res.data) {
          setUsers(res.data.filter((u: User) => u.id !== currentUser?.id));
        }
      } catch (err) {
        console.error('Error fetching users for calls directory:', err);
      } finally {
        setLoadingUsers(false);
      }
    }
    loadDirectory();
  }, [currentUser?.id]);

  const handleStartInstantMeeting = (isVideo: boolean) => {
    const code = 'sala-' + Math.random().toString(36).substring(2, 8);
    startOrJoinMeeting(code, `Reunión Instantánea (${isVideo ? 'Video' : 'Voz'})`, isVideo ? 'video' : 'audio');
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = customRoomCode.trim();
    if (!cleanCode) return;
    startOrJoinMeeting(cleanCode, `Sala ${cleanCode}`, 'video');
  };

  const filteredUsers = users.filter(u => {
    const name = (u.displayName || `${u.firstName} ${u.lastName}`).toLowerCase();
    const email = (u.email || '').toLowerCase();
    const query = searchTerm.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto select-none p-6 md:p-8">
      {/* Header Banner */}
      <div className="max-w-5xl mx-auto w-full mb-8">
        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Comunicaciones de Alta Fidelidad</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Llamadas y Videollamadas
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Comunícate en tiempo real con miembros del equipo en privado, en grupo o en salas de canal, con audio ultra-nítido y video HD.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleStartInstantMeeting(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-lg shadow-emerald-950/50 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Iniciar llamada de voz</span>
              </button>

              <button
                onClick={() => handleStartInstantMeeting(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-950/50 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Iniciar videollamada</span>
              </button>

              <form onSubmit={handleJoinByCode} className="flex items-center gap-1.5 ml-auto w-full sm:w-auto">
                <input
                  type="text"
                  value={customRoomCode}
                  onChange={e => setCustomRoomCode(e.target.value)}
                  placeholder="Código de sala..."
                  className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
                />
                <button
                  type="submit"
                  disabled={!customRoomCode.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-semibold text-xs transition-colors cursor-pointer border border-slate-700"
                >
                  Unirse
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        {/* Left Column: Direct Call Directory */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h2 className="font-bold text-slate-100 text-sm">Directorio de Colaboradores</h2>
              <span className="text-[11px] text-slate-400 font-mono">({filteredUsers.length})</span>
            </div>

            {/* Quick Filter */}
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar colega..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="py-12 text-center text-slate-500 text-xs">Cargando directorio...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 text-xs text-slate-500">
              No se encontraron colaboradores coincidentes.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredUsers.map(user => {
                const name = user.displayName || `${user.firstName} ${user.lastName}`;
                const isOnline = user.status === 'Online';
                return (
                  <div
                    key={user.id}
                    className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition-all flex items-center justify-between group shadow-sm hover:shadow-indigo-950/30"
                  >
                    <div className="flex items-center gap-3 min-w-0 mr-2">
                      <div className="relative">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={name}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-800"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-bold text-xs flex items-center justify-center">
                            {name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                            isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-200 truncate group-hover:text-white">
                          {name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {user.jobTitle || user.department || user.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          startCall({
                            targetUserId: user.id,
                            isVideo: false,
                            title: name
                          })
                        }
                        className="p-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer"
                        title={`Llamar por voz a ${name}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() =>
                          startCall({
                            targetUserId: user.id,
                            isVideo: true,
                            title: name
                          })
                        }
                        className="p-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 transition-all cursor-pointer"
                        title={`Videollamada con ${name}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Channels Calling */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-indigo-400" />
            <h2 className="font-bold text-slate-100 text-sm">Llamadas de Canales</h2>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2.5">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Inicia una llamada grupal abierta directamente en cualquier canal de tu organización.
            </p>

            <div className="space-y-1.5 pt-2">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <Hash className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-300 truncate">
                      {channel.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() =>
                        startCall({
                          channelId: channel.id,
                          isVideo: false,
                          title: `#${channel.name}`
                        })
                      }
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                      title="Llamar canal por voz"
                    >
                      <Phone className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() =>
                        startCall({
                          channelId: channel.id,
                          isVideo: true,
                          title: `#${channel.name}`
                        })
                      }
                      className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                      title="Videollamada en canal"
                    >
                      <Video className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
