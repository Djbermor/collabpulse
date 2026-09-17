import React, { useState, useEffect } from 'react';
import { X, Users, Search, Check, Loader2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { User } from '../../types';

export const CreateGroupModal: React.FC = () => {
  const {
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    currentUser,
    refreshConversations,
    selectConversation,
    setActiveView,
    addToast
  } = useApp();

  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isCreateGroupOpen) {
      setGroupName('');
      setSearchQuery('');
      setSelectedUserIds([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api.getWorkspaceUsers()
      .then(res => {
        if (isMounted && res.success && res.data) {
          const others = res.data.filter((u: User) => u.id !== currentUser?.id);
          setUsers(others);
        }
      })
      .catch(err => console.error('Error fetching users for group:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isCreateGroupOpen, currentUser?.id]);

  if (!isCreateGroupOpen) return null;

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      addToast('Por favor ingrese un nombre para el grupo', 'warning');
      return;
    }
    if (selectedUserIds.length === 0) {
      addToast('Selecciona al menos un participante para el grupo', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // Creator + selected members
      const allMembers = Array.from(new Set([currentUser!.id, ...selectedUserIds]));
      const res = await api.createConversation({
        name: groupName.trim(),
        memberIds: allMembers,
        isGroup: true
      });

      if (res.success && res.data) {
        await refreshConversations();
        selectConversation(res.data.id);
        setActiveView('conversation');
        setIsCreateGroupOpen(false);
        addToast(`Grupo "${groupName.trim()}" creado exitosamente`, 'success');
      } else {
        addToast(res.message || 'Error al crear el grupo', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error de conexión al crear grupo', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.userName && u.userName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none text-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Nuevo Grupo de Chat</h3>
              <p className="text-[11px] text-slate-400">Crea un espacio de conversación con múltiples colegas</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateGroupOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-3 border-b border-slate-800 bg-slate-900">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nombre del Grupo *
              </label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Ej. Equipo de Proyecto, Coordinación..."
                required
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Selected members pills */}
            {selectedUserIds.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400">
                  Miembros seleccionados ({selectedUserIds.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-20 overflow-y-auto">
                  {selectedUserIds.map(uid => {
                    const u = users.find(usr => usr.id === uid);
                    if (!u) return null;
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px]"
                      >
                        <span>{u.displayName || u.email}</span>
                        <button
                          type="button"
                          onClick={() => toggleUser(uid)}
                          className="hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* User selector list */}
          <div className="p-3 bg-slate-950/40 border-b border-slate-800">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filtrar colaboradores..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/40">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                <span>Cargando colaboradores...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 italic text-[11px]">
                No se encontraron usuarios disponibles
              </div>
            ) : (
              filteredUsers.map(user => {
                const isSelected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer text-left ${
                      isSelected ? 'bg-indigo-600/15 border border-indigo-500/30' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                          {(user.displayName || user.email || 'U').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{user.displayName || user.userName}</div>
                        <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'border-slate-700 bg-slate-800/60 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {selectedUserIds.length} seleccionado(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateGroupOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !groupName.trim() || selectedUserIds.length === 0}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Crear Grupo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
