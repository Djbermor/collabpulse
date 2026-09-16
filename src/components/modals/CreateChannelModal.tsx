import React, { useState } from 'react';
import { X, Hash, Lock, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

export const CreateChannelModal: React.FC = () => {
  const { isCreateChannelOpen, setIsCreateChannelOpen, refreshChannels, selectChannel } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isCreateChannelOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const res = await api.createChannel({
      name: slug,
      description: description.trim(),
      topic: topic.trim(),
      isPrivate
    });

    setLoading(false);
    if (res.success && res.data) {
      await refreshChannels();
      selectChannel(res.data.id);
      setIsCreateChannelOpen(false);
      setName('');
      setDescription('');
      setTopic('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none text-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-slate-100 text-sm">Crear un nuevo canal</h3>
          </div>
          <button
            onClick={() => setIsCreateChannelOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Nombre del canal</label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-slate-500 font-bold">#</span>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej: lanzamientos-q3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Los nombres se normalizan en minúsculas y sin espacios.
            </span>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Tema / Propósito (Opcional)</label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="ej: Coordinación del equipo de ingeniería"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Descripción</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="¿De qué trata este canal?"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Private Channel Toggle */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">Hacer canal privado</div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  Solo los miembros invitados podrán ver este canal y su historial.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateChannelOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Canal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
