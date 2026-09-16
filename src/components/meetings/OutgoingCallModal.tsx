import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useCall } from '../../context/CallContext';

export const OutgoingCallModal: React.FC = () => {
  const { outgoingCall, cancelOutgoingCall } = useCall();

  if (!outgoingCall) return null;

  const targetName = outgoingCall.targetName || 'Colaborador';
  const isVideo = outgoingCall.isVideo;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/10 via-emerald-600/10 to-transparent pointer-events-none" />

        {/* Pulsing Calling Rings */}
        <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping duration-1000" />
          <div className="absolute -inset-2 rounded-full bg-emerald-500/15 animate-pulse duration-700" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-700 to-slate-800 border-2 border-indigo-500/40 text-white font-bold text-2xl flex items-center justify-center relative z-10 shadow-lg">
            {targetName.substring(0, 2).replace('#', '').toUpperCase()}
          </div>
        </div>

        {/* Title and Calling status */}
        <h3 className="text-lg font-bold text-slate-100 mb-1 truncate px-2">{targetName}</h3>
        <p className="text-xs text-indigo-400 font-medium flex items-center justify-center gap-1.5 mb-2">
          {isVideo ? (
            <Video className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          ) : (
            <Phone className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          )}
          <span>{isVideo ? 'Iniciando videollamada...' : 'Llamando por voz...'}</span>
        </p>
        <p className="text-[11px] text-slate-500 mb-8">
          Esperando que respondan la llamada...
        </p>

        {/* Cancel Call Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={cancelOutgoingCall}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-xl shadow-rose-950/80 hover:scale-105 active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 group-hover:text-rose-300">
              Cancelar llamada
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
