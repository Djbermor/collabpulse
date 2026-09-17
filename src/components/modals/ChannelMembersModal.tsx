import React, { useState, useEffect } from 'react';
import { X, Users, UserPlus, Trash2, Shield, Search, Loader2 } from 'lucide-react';
import { Channel, User } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface Props {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

export const ChannelMembersModal: React.FC<Props> = ({ channel, isOpen, onClose }) => {
  const { currentUser, addToast } = useApp();
  const [members, setMembers] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        api.getChannelMembers(channel.id),
        api.getWorkspaceUsers()
      ]);

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
        const memberUserIds = new Set(membersRes.data.map((m: any) => m.userId));
        if (usersRes.success && usersRes.data) {
          setAvailableUsers(usersRes.data.filter((u: User) => !memberUserIds.has(u.id)));
        }
      }
    } catch (err: any) {
      console.error('Error loading channel members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, channel.id]);

  if (!isOpen) return null;

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setIsSubmitting(true);
    try {
      const res = await api.addChannelMember(channel.id, selectedUserId);
      if (res.success) {
        addToast('Miembro agregado al canal', 'success');
        setSelectedUserId('');
        await loadData();
      } else {
        addToast(res.message || 'Error al agregar miembro', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al conectar', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await api.removeChannelMember(channel.id, userId);
      if (res.success) {
        addToast('Miembro eliminado del canal', 'info');
        await loadData();
      } else {
        addToast(res.message || 'Error al eliminar miembro', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al conectar', 'error');
    }
  };

  const filteredMembers = members.filter((m: any) => {
    const name = m.user?.displayName || m.user?.firstName || 'Usuario';
    const email = m.user?.email || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) || email.toLowerCase().includes(searchQuery.toLowerCase());
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
              <h3 className="font-bold text-slate-100 text-sm">Miembros de #{channel.name}</h3>
              <p className="text-[11px] text-slate-400">{members.length} colaboradores en este canal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add Member Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2">
          <select
            value={selectedUserId}
            onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Seleccionar colaborador para agregar...</option>
            {availableUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.displayName || u.email} ({u.role || 'Member'})
              </option>
            ))}
          </select>
          <button
            onClick={handleAddMember}
            disabled={!selectedUserId || isSubmitting}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Agregar</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-2.5 border-b border-slate-800 bg-slate-950/20">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar entre los miembros..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Members List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-800/40">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              <span>Cargando miembros...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 italic text-[11px]">
              No hay miembros que coincidan con la búsqueda
            </div>
          ) : (
            filteredMembers.map((m: any) => {
              const u = m.user;
              const isMe = u?.id === currentUser?.id;
              return (
                <div
                  key={m.id || m.userId}
                  className="p-2 flex items-center justify-between rounded-xl hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u?.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                        {((u?.displayName || 'U').substring(0, 2)).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <span className="truncate">{u?.displayName || 'Usuario'}</span>
                        {isMe && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{u?.email || u?.jobTitle || 'Miembro'}</div>
                    </div>
                  </div>

                  {!isMe && (
                    <button
                      onClick={() => handleRemoveMember(m.userId)}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Quitar del canal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
