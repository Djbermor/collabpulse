import React from 'react';
import {
  X,
  MessageSquare,
  Hash,
  CheckSquare,
  Video,
  Upload,
  UserPlus,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const QuickActionModal: React.FC = () => {
  const {
    isQuickActionOpen,
    setIsQuickActionOpen,
    setIsCreateChannelOpen,
    setIsInviteOpen,
    setActiveView,
    startOrJoinMeeting,
    addToast
  } = useApp();

  if (!isQuickActionOpen) return null;

  return (
    <div
      id="quick-action-modal-overlay"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 p-4 z-50 select-none animate-in fade-in"
      onClick={() => setIsQuickActionOpen(false)}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-4 text-slate-100 space-y-2"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Crear nuevo elemento</h3>
          </div>
          <button
            onClick={() => setIsQuickActionOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1.5 pt-1 text-xs">
          <button
            onClick={() => {
              setIsQuickActionOpen(false);
              setIsCreateChannelOpen(true);
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">Nuevo Canal de Comunicación</div>
              <div className="text-[11px] text-slate-400">Público o privado para el equipo</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsQuickActionOpen(false);
              setActiveView('tasks');
              addToast('Abre el tablero de tareas para añadir una nueva tarjeta', 'info');
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">Nueva Tarea Kanban</div>
              <div className="text-[11px] text-slate-400">Asigna prioridad, responsable y fecha límite</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsQuickActionOpen(false);
              startOrJoinMeeting(undefined, 'Reunión rápida espontánea');
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-600/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">Iniciar Videollamada Instantánea</div>
              <div className="text-[11px] text-slate-400">Sala interactiva con audio, video y pantalla</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsQuickActionOpen(false);
              setActiveView('files');
              addToast('Accede al repositorio corporativo de archivos', 'info');
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">Subir Archivo o Documento</div>
              <div className="text-[11px] text-slate-400">PDFs, código, especificaciones técnicas</div>
            </div>
          </button>

          <button
            onClick={() => {
              setIsQuickActionOpen(false);
              setIsInviteOpen(true);
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 text-left transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-100">Invitar Miembro a la Organización</div>
              <div className="text-[11px] text-slate-400">Genera enlace o invitación por correo</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
