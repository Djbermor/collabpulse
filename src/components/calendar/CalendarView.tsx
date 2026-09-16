import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Plus, Trash2, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CalendarEvent } from '../../types';
import { api } from '../../services/api';

export const CalendarView: React.FC = () => {
  const { currentUser, addToast } = useApp();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const loadEvents = async () => {
    const res = await api.getCalendarEvents();
    if (res.success && res.data) {
      setEvents(res.data);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newStart) return;

    const res = await api.createCalendarEvent({
      title: newTitle.trim(),
      description: newDescription.trim(),
      startAt: new Date(newStart).toISOString(),
      endAt: newEnd ? new Date(newEnd).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      location: newLocation.trim()
    });

    if (res.success && res.data) {
      setEvents(prev => [...prev, res.data]);
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewStart('');
      setNewEnd('');
      setNewLocation('');
      addToast('Evento programado con éxito', 'success');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    await api.deleteCalendarEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    addToast('Evento eliminado del calendario', 'info');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900/60 overflow-hidden text-xs">
      {/* Header */}
      <div className="h-14 bg-slate-950/70 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-slate-100 text-sm">Calendario de Equipo & Eventos</h2>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shadow-md shadow-amber-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Evento</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              No hay eventos programados en este momento.
            </div>
          ) : (
            events.map(evt => (
              <div
                key={evt.id}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition-all shadow-sm space-y-3 group"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
                      {new Date(evt.startAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                    <h3 className="font-bold text-slate-100 text-sm mt-0.5">{evt.title}</h3>
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                    title="Eliminar evento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {evt.description && (
                  <p className="text-slate-400 text-xs leading-relaxed">{evt.description}</p>
                )}

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {new Date(evt.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(evt.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {evt.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span className="truncate">{evt.location}</span>
                    </div>
                  )}
                  {evt.attendees && evt.attendees.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{evt.attendees.length} asistentes invitados</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 text-sm">Programar Evento de Equipo</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-4 space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Título</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ej: Sprint Planning Sprint 25"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Objetivos de la reunión..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Inicio</label>
                  <input
                    type="datetime-local"
                    required
                    value={newStart}
                    onChange={e => setNewStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Fin</label>
                  <input
                    type="datetime-local"
                    value={newEnd}
                    onChange={e => setNewEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Ubicación / Sala</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={e => setNewLocation(e.target.value)}
                  placeholder="Ej: Sala Virtual CollabPulse o Oficina Principal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 shadow-md shadow-amber-600/30"
                >
                  Programar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
