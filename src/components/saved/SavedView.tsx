import React from 'react';
import {
  Bookmark,
  MessageSquare,
  FileText,
  CheckSquare,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SavedItem } from '../../types';

export const SavedView: React.FC = () => {
  const { savedItems, unsaveItem, selectChannel, setActiveView } = useApp();

  return (
    <div id="saved-view" className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="h-14 border-b border-slate-800/80 px-6 flex items-center justify-between shrink-0 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-100 text-sm">Elementos Guardados para Después</h2>
            <p className="text-[11px] text-slate-400">Mensajes, archivos y tareas destacados para consulta rápida</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
          {savedItems.length} guardados
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {savedItems.length === 0 ? (
          <div className="py-24 text-center text-slate-500 space-y-2 max-w-sm mx-auto">
            <Bookmark className="w-10 h-10 mx-auto text-slate-600/70" />
            <p className="font-semibold text-slate-300 text-sm">Nada guardado por ahora</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Pasa el cursor sobre cualquier mensaje, archivo o tarea y selecciona el icono de marcador para tenerlo siempre a mano aquí.
            </p>
          </div>
        ) : (
          savedItems.map(item => {
            let Icon = MessageSquare;
            let iconBg = 'bg-indigo-950/80 text-indigo-400 border-indigo-800/50';

            if (item.type === 'file') {
              Icon = FileText;
              iconBg = 'bg-cyan-950/80 text-cyan-400 border-cyan-800/50';
            } else if (item.type === 'task') {
              Icon = CheckSquare;
              iconBg = 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50';
            }

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:border-slate-700 transition-all flex items-start justify-between gap-4 group"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-xs truncate">{item.title}</span>
                      <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-mono">
                        {item.subtitle}
                      </span>
                    </div>

                    {item.content && (
                      <p className="text-slate-300 text-xs leading-relaxed line-clamp-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                        {item.content}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>Guardado el {new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      if (item.type === 'message') setActiveView('channel');
                      if (item.type === 'file') setActiveView('files');
                      if (item.type === 'task') setActiveView('tasks');
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-300 border border-slate-700/60 transition-colors"
                    title="Ir a este elemento"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => unsaveItem(item.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/30 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
                    title="Quitar de guardados"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
