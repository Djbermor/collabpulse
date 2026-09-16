import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, LogOut, Edit3, X, EyeOff, Shield } from 'lucide-react';
import { Conversation, User } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface Props {
  conversation: Conversation;
  isOpen: boolean;
  onClose: () => void;
}

export const ConversationSettingsModal: React.FC<Props> = ({ conversation, isOpen, onClose }) => {
  const { currentUser, refreshConversations, selectChannel, channels, addToast } = useApp();

  const [groupName, setGroupName] = useState(conversation.name || '');
  const [members, setMembers] = useState<User[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedNewUserId, setSelectedNewUserId] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGroupName(conversation.name || '');
      loadMembersAndDirectory();
    }
  }, [isOpen, conversation.id]);

  const loadMembersAndDirectory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getWorkspaceUsers();
      if (res.success && res.data) {
        const allUsers: User[] = res.data;
        const currentMemberIds = conversation.memberIds || [];
        setMembers(allUsers.filter(u => currentMemberIds.includes(u.id)));
        setAvailableUsers(allUsers.filter(u => !currentMemberIds.includes(u.id)));
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isMe = (uid: string) => uid === currentUser?.id;
  const isGroup = conversation.isGroup || (conversation.memberIds && conversation.memberIds.length > 2);

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setIsRenaming(true);
    try {
      const res = await api.renameConversation(conversation.id, groupName.trim());
      if (res.success) {
        addToast('Nombre del grupo actualizado', 'success');
        refreshConversations();
      } else {
        addToast(res.message || 'Error al renombrar', 'error');
      }
    } catch {
      addToast('Error al renombrar', 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedNewUserId) return;
    try {
      const res = await api.addConversationMember(conversation.id, selectedNewUserId);
      if (res.success) {
        addToast('Miembro agregado al grupo', 'success');
        setSelectedNewUserId('');
        refreshConversations();
        loadMembersAndDirectory();
      } else {
        addToast(res.message || 'Error al agregar miembro', 'error');
      }
    } catch {
      addToast('Error al agregar miembro', 'error');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const res = await api.removeConversationMember(conversation.id, userId);
      if (res.success) {
        addToast('Miembro removido del grupo', 'info');
        refreshConversations();
        loadMembersAndDirectory();
      } else {
        addToast(res.message || 'Error al remover miembro', 'error');
      }
    } catch {
      addToast('Error al remover miembro', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('¿Estás seguro de que deseas salir de este grupo?')) return;
    try {
      const res = await api.leaveConversation(conversation.id);
      if (res.success) {
        addToast('Has salido del grupo', 'info');
        onClose();
        refreshConversations();
        if (channels && channels.length > 0) {
          selectChannel(channels[0].id);
        }
      } else {
        addToast(res.message || 'Error al salir del grupo', 'error');
      }
    } catch {
      addToast('Error al salir del grupo', 'error');
    }
  };

  const handleHideConversation = async () => {
    try {
      const res = await api.hideConversation(conversation.id);
      if (res.success) {
        addToast('Conversación oculta', 'info');
        onClose();
        refreshConversations();
        if (channels && channels.length > 0) {
          selectChannel(channels[0].id);
        }
      }
    } catch {
      addToast('Error al ocultar conversación', 'error');
    }
  };

  const handleDeleteConversation = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta conversación para todos? Esta acción no se puede deshacer.')) return;
    try {
      const res = await api.deleteConversation(conversation.id);
      if (res.success) {
        addToast('Conversación eliminada definitivamente', 'success');
        onClose();
        refreshConversations();
        if (channels && channels.length > 0) {
          selectChannel(channels[0].id);
        }
      } else {
        addToast(res.message || 'Error al eliminar', 'error');
      }
    } catch {
      addToast('Error al eliminar conversación', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">
                {isGroup ? 'Ajustes del Grupo' : 'Ajustes de la Conversación'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {members.length} {members.length === 1 ? 'participante' : 'participantes'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Rename section (for groups) */}
          {isGroup && (
            <form onSubmit={handleRename} className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Nombre del grupo</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Escribe el nombre del grupo..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isRenaming || !groupName.trim() || groupName === conversation.name}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}

          {/* Add member selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              {isGroup ? 'Agregar personas al grupo' : 'Agregar personas (convertir a grupo)'}
            </label>
            <div className="flex gap-2">
              <select
                value={selectedNewUserId}
                onChange={e => setSelectedNewUserId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Seleccionar colaborador...</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName || `${u.firstName} ${u.lastName}`} ({u.jobTitle || u.email})
                  </option>
                ))}
              </select>

              <button
                onClick={handleAddMember}
                disabled={!selectedNewUserId}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Current Members List */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Miembros actuales</label>
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl divide-y divide-slate-850 overflow-hidden">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">Cargando miembros...</div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">No hay miembros registrados</div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={member.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={member.displayName}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-800"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-slate-200 truncate">
                          {member.displayName || `${member.firstName} ${member.lastName}`}
                          {isMe(member.id) && <span className="text-indigo-400 ml-1 font-normal">(Tú)</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{member.jobTitle || member.email}</div>
                      </div>
                    </div>

                    {isGroup && !isMe(member.id) && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 text-xs transition-colors cursor-pointer"
                        title="Remover del grupo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger zone actions */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            {isGroup && (
              <button
                onClick={handleLeaveGroup}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Salir de este grupo</span>
              </button>
            )}

            <button
              onClick={handleHideConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <EyeOff className="w-4 h-4" />
              <span>Ocultar conversación de mi lista</span>
            </button>

            <button
              onClick={handleDeleteConversation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Eliminar conversación para todos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
