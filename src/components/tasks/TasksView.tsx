import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Filter,
  User,
  Calendar,
  X,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { api } from '../../services/api';
import { TaskDetailModal } from './TaskDetailModal';

export const TasksView: React.FC = () => {
  const { currentUser, currentWorkspace, addToast } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');


  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const loadTasks = async () => {
    const res = await api.getTasks({
      priority: filterPriority || undefined,
      assignedTo: filterAssignee || undefined
    });
    if (res.success && res.data) {
      setTasks(res.data);
    }
  };

  useEffect(() => {
    loadTasks();
    api.getWorkspaceMembers().then(res => {
      if (res.success && res.data) setMembers(res.data);
    });
  }, [filterPriority, filterAssignee]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = await api.createTask({
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
      assignedTo: newAssignee || undefined,
      dueDate: newDueDate || undefined
    });

    if (res.success && res.data) {
      setTasks(prev => [res.data, ...prev]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const res = await api.updateTask(taskId, { status: newStatus });
    if (res.success && res.data) {
      setTasks(prev => prev.map(t => (t.id === taskId ? res.data : t)));

      if (newStatus === 'Completed') {
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 }
          });
        } catch {}
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    await api.deleteTask(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    addToast('Tarea eliminada correctamente', 'info');
  };

  const columns: { id: TaskStatus; label: string; color: string; border: string }[] = [
    { id: 'Pending', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/30' },
    { id: 'InProgress', label: 'En Curso', color: 'bg-indigo-500/10 text-indigo-400', border: 'border-indigo-500/30' },
    { id: 'Completed', label: 'Completada', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/30' },
    { id: 'Cancelled', label: 'Cancelada', color: 'bg-slate-500/10 text-slate-400', border: 'border-slate-500/30' }
  ];

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent':
        return <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800 text-[10px] font-bold">Urgente</span>;
      case 'High':
        return <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800 text-[10px] font-medium">Alta</span>;
      case 'Medium':
        return <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800 text-[10px]">Media</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">Baja</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden text-xs">
      {/* Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          <h2 className="font-bold text-slate-100 text-sm">Tablero de Tareas y Sprint</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter by Priority */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">Todas las prioridades</option>
            <option value="Urgent">Urgente</option>
            <option value="High">Alta</option>
            <option value="Medium">Media</option>
            <option value="Low">Baja</option>
          </select>

          {/* New Task Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-md shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Tarea</span>
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-[900px]">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div
                key={col.id}
                className="flex-1 flex flex-col bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-hidden"
              >
                {/* Column Header */}
                <div className={`p-3 border-b flex items-center justify-between ${col.border}`}>
                  <span className={`font-bold px-2 py-0.5 rounded-md ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-slate-500 font-mono font-bold text-[11px]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards Stream */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="py-8 text-center text-slate-600">Sin tareas</div>
                  ) : (
                    colTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-2.5 group cursor-pointer hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-200 leading-snug">{task.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTask(task.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 transition-opacity cursor-pointer"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <div className="flex items-center gap-1.5">
                            {getPriorityBadge(task.priority)}
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            {task.commentsCount !== undefined && task.commentsCount > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                                {task.commentsCount} com
                              </span>
                            )}
                          </div>

                          {task.assignedUserName && (
                            <div className="flex items-center gap-1" title={task.assignedUserName}>
                              <img
                                src={task.assignedUserAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                alt={task.assignedUserName}
                                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-800"
                              />
                            </div>
                          )}
                        </div>

                        {/* Fast Status Transition */}
                        <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400" onClick={e => e.stopPropagation()}>
                          <span>Mover a:</span>
                          <div className="flex gap-1">
                            {columns
                              .filter(c => c.id !== task.status)
                              .map(c => (
                                <button
                                  key={c.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(task.id, c.id);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                                >
                                  {c.label.substring(0, 4)}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    ))

                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm">Nueva Tarea de Proyecto</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Título de la tarea</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ej: Implementar pipeline de CI/CD para Docker"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Detalles técnicos, criterios de aceptación..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Prioridad</label>
                  <select
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="Low">Baja</option>
                    <option value="Medium">Media</option>
                    <option value="High">Alta</option>
                    <option value="Urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Asignar a</label>
                  <select
                    value={newAssignee}
                    onChange={e => setNewAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none"
                  >
                    <option value="">Sin asignar</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Fecha Límite</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  Crear Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail & Comments Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

