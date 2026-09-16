import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Clock,
  User,
  Calendar,
  X,
  MessageSquare,
  Send,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Task, TaskComment, TaskStatus } from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { signalR } from '../../services/signalr';

interface Props {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const TaskDetailModal: React.FC<Props> = ({ task, isOpen, onClose, onStatusChange }) => {
  const { currentUser, addToast } = useApp();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadComments();
    }
  }, [isOpen, task.id]);

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await api.getTaskComments(task.id);
      if (res.success && res.data) {
        setComments(res.data);
      }
    } catch (err) {
      console.error('Error loading task comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleCommentAdded = (data: { taskId: string; comment: TaskComment }) => {
      if (data.taskId === task.id) {
        setComments(prev => {
          if (prev.some(c => c.id === data.comment.id)) return prev;
          return [...prev, data.comment];
        });
      }
    };

    const handleCommentDeleted = (data: { taskId: string; commentId: string }) => {
      if (data.taskId === task.id) {
        setComments(prev => prev.filter(c => c.id !== data.commentId));
      }
    };

    signalR.on('TaskCommentAdded', handleCommentAdded);
    signalR.on('TaskCommentDeleted', handleCommentDeleted);

    return () => {
      signalR.off('TaskCommentAdded', handleCommentAdded);
      signalR.off('TaskCommentDeleted', handleCommentDeleted);
    };
  }, [isOpen, task.id]);

  if (!isOpen) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await api.addTaskComment(task.id, newComment.trim());
      if (res.success && res.data) {
        setComments(prev => [...prev, res.data]);
        setNewComment('');
      } else {
        addToast(res.message || 'Error al agregar comentario', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error al conectar', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await api.deleteTaskComment(task.id, commentId);
      if (res.success) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        addToast('Comentario eliminado', 'info');
      }
    } catch {
      addToast('Error al eliminar comentario', 'error');
    }
  };

  const statuses: { id: TaskStatus; label: string }[] = [
    { id: 'Pending', label: 'Pendiente' },
    { id: 'InProgress', label: 'En Curso' },
    { id: 'Completed', label: 'Completada' },
    { id: 'Cancelled', label: 'Cancelada' }
  ];

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 leading-snug">{task.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-slate-400">ID: {task.id}</span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Límite: {new Date(task.dueDate).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status quick switcher */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Estado de la tarea
            </label>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => {
                const isSelected = task.status === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => onStatusChange(task.id, s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/50'
                        : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Descripción
              </label>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {task.description}
              </div>
            </div>
          )}

          {/* Assignee & Priority Details */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Asignado a:</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                {task.assignedUserAvatar ? (
                  <img src={task.assignedUserAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>{task.assignedUserName || 'Sin asignar'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Prioridad:</span>
              <span className="font-semibold text-indigo-300">{task.priority}</span>
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                Comentarios ({comments.length})
              </h4>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {loadingComments ? (
                <div className="text-center py-6 text-xs text-slate-500">Cargando comentarios...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60">
                  No hay comentarios en esta tarea aún.
                </div>
              ) : (
                comments.map(c => {
                  const isAuthor = c.userId === currentUser?.id;
                  const canDelete = isAuthor || currentUser?.role === 'Owner' || currentUser?.role === 'Admin';
                  return (
                    <div key={c.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 space-y-1 group">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {c.userAvatar ? (
                            <img src={c.userAvatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-indigo-900 text-[9px] text-indigo-200 flex items-center justify-center font-bold">
                              {c.userName.substring(0, 1)}
                            </div>
                          )}
                          <span className="font-semibold text-slate-200">{c.userName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 transition-opacity"
                              title="Eliminar comentario"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-6">{c.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario sobre esta tarea..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
