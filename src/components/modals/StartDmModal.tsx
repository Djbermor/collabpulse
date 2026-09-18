import React, { useState, useEffect } from 'react';
import { X, Search, MessageSquare, UserPlus, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const StartDmModal: React.FC = () => {
  const {
    isStartDmOpen,
    setIsStartDmOpen,
    currentUser,
    refreshConversations,
    selectConversation,
    setActiveView,
    setIsInviteOpen,
    addToast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingUserId, setStartingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isStartDmOpen) return;

    let isMounted = true;
    setLoading(true);

    const q = searchQuery.trim();
    Promise.allSettled([
      api.searchDirectory(q),
      api.getWorkspaceUsers(q)
    ]).then(([dirRes, wsRes]) => {
      if (!isMounted) return;
      const combined = new Map<string, any>();
      if (dirRes.status === 'fulfilled' && dirRes.value.success && Array.isArray(dirRes.value.data)) {
        dirRes.value.data.forEach((u: any) => combined.set(u.id, u));
      }
      if (wsRes.status === 'fulfilled' && wsRes.value.success && Array.isArray(wsRes.value.data)) {
        wsRes.value.data.forEach((u: any) => {
          if (!combined.has(u.id)) combined.set(u.id, u);
        });
      }
      const filtered = Array.from(combined.values()).filter((u: any) => u.id !== currentUser?.id);
      setUsers(filtered);
    }).catch(err => {
      console.error('Error fetching directory users for DM:', err);
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isStartDmOpen, searchQuery, currentUser?.id]);

  if (!isStartDmOpen) return null;

  const handleStartDm = async (targetUser: any) => {
    if (startingUserId) return;
    setStartingUserId(targetUser.id);

    try {
      const res = await api.startConversation({ targetUserId: targetUser.id });
      if (res.success && res.data) {
        await refreshConversations();
        selectConversation(res.data.id);
        setActiveView('conversation');
        setIsStartDmOpen(false);
        const name = targetUser.displayName || `${targetUser.firstName} ${targetUser.lastName}`;
        addToast(`Conversación abierta con ${name}`, 'success');
      } else {
        addToast(res.message || 'No se pudo iniciar la conversación', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al conectar con el servidor', 'error');
    } finally {
      setStartingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none text-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Nuevo Mensaje Directo</h3>
          </div>
          <button
            onClick={() => setIsStartDmOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador por nombre, cargo o correo..."
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Cargando colaboradores...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-2">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-slate-300 font-medium mb-1">
                {searchQuery.trim() ? 'No se encontraron colaboradores' : 'Directorio de colaboradores'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                {searchQuery.trim()
                  ? 'Intenta buscar con otro nombre, cargo o correo.'
                  : 'Busca a cualquier colaborador por nombre o cargo para iniciar una conversación 1:1.'}
              </p>
            </div>
          ) : (
            users.map(u => {
              const displayName = u.displayName || `${u.firstName} ${u.lastName}`;
              const isStarting = startingUserId === u.id;

              return (
                <button
                  key={u.id}
                  onClick={() => handleStartDm(u)}
                  disabled={isStarting}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors text-left cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-semibold flex items-center justify-center text-xs">
                          {displayName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                          u.status === 'Online'
                            ? 'bg-emerald-500'
                            : u.status === 'Away'
                            ? 'bg-amber-500'
                            : u.status === 'Busy'
                            ? 'bg-rose-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                        {displayName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {u.jobTitle || u.role || 'Miembro'} {u.email ? `• ${u.email}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isStarting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="px-2 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-[10px] font-medium">
                        Iniciar chat
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-center text-[11px] text-slate-500">
          Selecciona un colaborador para iniciar una conversación 1:1 directa y segura.
        </div>
      </div>
    </div>
  );
};
