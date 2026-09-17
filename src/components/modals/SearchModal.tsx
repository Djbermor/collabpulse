import React, { useState, useEffect } from 'react';
import { Search, X, Hash, MessageSquare, CheckSquare, FileText, ArrowRight, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    selectChannel,
    selectConversation,
    refreshConversations,
    setActiveView,
    addToast
  } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ messages: [], channels: [], tasks: [], files: [], users: [] });
  const [loading, setLoading] = useState(false);

  // Keyboard shortcut Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ messages: [], channels: [], tasks: [], files: [], users: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const [searchRes, directoryRes] = await Promise.all([
        api.globalSearch(query.trim()),
        api.searchDirectory(query.trim())
      ]);

      const usersMap = new Map();
      if (directoryRes.success && directoryRes.data) {
        directoryRes.data.forEach((u: any) => usersMap.set(u.id, u));
      }
      if (searchRes.success && searchRes.data?.users) {
        searchRes.data.users.forEach((u: any) => {
          if (!usersMap.has(u.id)) usersMap.set(u.id, u);
        });
      }

      setResults({
        messages: searchRes.data?.messages || [],
        channels: searchRes.data?.channels || [],
        tasks: searchRes.data?.tasks || [],
        files: searchRes.data?.files || [],
        users: Array.from(usersMap.values())
      });
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleOpenUserDm = async (u: any) => {
    try {
      const res = await api.startConversation({ targetUserId: u.id });
      if (res.success && res.data) {
        await refreshConversations();
        selectConversation(res.data.id);
        setActiveView('conversation');
        setIsSearchOpen(false);
        addToast(`Chat abierto con ${u.displayName || u.firstName}`, 'success');
      }
    } catch (err) {
      console.error('Error starting conversation from search:', err);
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-start justify-center pt-20 p-4 z-50 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar mensajes, canales, colaboradores de Nexora, archivos..."
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none text-sm"
          />
          <button
            onClick={() => setIsSearchOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {loading && <div className="py-8 text-center text-slate-500">Buscando en Nexora...</div>}

          {!loading && !query && (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <p>Escribe para buscar instantáneamente en todos los canales, colaboradores y mensajes.</p>
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">from:nombre</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">in:canal</span>
              </div>
            </div>
          )}

          {!loading && query && (
            <>
              {/* Colaboradores encontrados (Directorio Global) */}
              {results.users.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Directorio de Colaboradores ({results.users.length})
                  </div>
                  <div className="space-y-1">
                    {results.users.map((u: any) => (
                      <div
                        key={u.id}
                        onClick={() => handleOpenUserDm(u)}
                        className="p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                            className="w-7 h-7 rounded-full object-cover border border-slate-700"
                            alt=""
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200 group-hover:text-indigo-300">
                                {u.displayName || `${u.firstName} ${u.lastName}`}
                              </span>
                              {u.organizations && u.organizations.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {u.organizations.map((org: any) => (
                                    <span key={org.id} className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300">
                                      {org.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-slate-500 text-[11px]">
                              {u.jobTitle || 'Colaborador'} • {u.email}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800 text-indigo-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          Mensaje directo
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canales encontrados */}
              {results.channels.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-indigo-400" />
                    Canales ({results.channels.length})
                  </div>
                  <div className="space-y-1">
                    {results.channels.map((ch: any) => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          selectChannel(ch.id);
                          setIsSearchOpen(false);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400" />
                          <span className="font-semibold text-slate-200">{ch.name}</span>
                          <span className="text-slate-500">{ch.topic}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensajes encontrados */}
              {results.messages.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    Mensajes ({results.messages.length})
                  </div>
                  <div className="space-y-1">
                    {results.messages.map((msg: any) => (
                      <div
                        key={msg.id}
                        onClick={() => {
                          if (msg.channelId) selectChannel(msg.channelId);
                          setIsSearchOpen(false);
                        }}
                        className="p-2.5 rounded-lg hover:bg-slate-800/80 cursor-pointer transition-colors border border-slate-800/60"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-200">{msg.senderName}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-300 line-clamp-2 leading-relaxed">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tareas encontradas */}
              {results.tasks.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    Tareas ({results.tasks.length})
                  </div>
                  <div className="space-y-1">
                    {results.tasks.map((t: any) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveView('tasks');
                          setIsSearchOpen(false);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <span className="font-semibold text-slate-200">{t.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archivos encontrados */}
              {results.files.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    Archivos ({results.files.length})
                  </div>
                  <div className="space-y-1">
                    {results.files.map((f: any) => (
                      <div
                        key={f.id}
                        onClick={() => {
                          setActiveView('files');
                          setIsSearchOpen(false);
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer flex items-center justify-between group transition-colors"
                      >
                        <span className="font-semibold text-slate-200">{f.name}</span>
                        <span className="text-[10px] text-slate-500">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
