import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCall } from '../../context/CallContext';
import { api } from '../../services/api';
import { sound } from '../../services/sound';
import { desktopNotifications } from '../../services/desktopNotifications';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, setIncomingCall } = useApp();
  const { joinCall } = useCall();

  useEffect(() => {
    if (incomingCall) {
      sound.playIncomingRing();
      desktopNotifications.showNotification(`Llamada entrante de ${incomingCall.caller?.displayName || 'Colaborador'}`, {
        body: incomingCall.isVideo ? 'Videollamada entrante' : 'Llamada de voz entrante',
        requireInteraction: true,
        onClick: () => {
          window.focus();
        }
      });
      // Auto dismiss after 30 seconds if unanswered
      const timer = setTimeout(() => {
        handleReject('timeout');
      }, 30000);
      return () => {
        clearTimeout(timer);
        sound.stopAllRings();
      };
    } else {
      sound.stopAllRings();
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const caller = incomingCall.caller || {};
  const callerName = caller.displayName || 'Colaborador';

  const handleAccept = async () => {
    sound.stopAllRings();
    const callData = incomingCall;
    setIncomingCall(null);
    try {
      await api.respondCall(caller.id, callData.callId, true, undefined, callData.roomId);
    } catch (err) {
      console.error('Error responding to call:', err);
    }
    await joinCall({
      roomId: callData.roomId,
      title: `Llamada con ${callerName}`,
      callType: callData.isVideo ? 'video' : 'audio',
      conversationId: callData.conversationId,
      channelId: callData.channelId,
      targetUserId: caller.id,
      isInitiator: false
    });
  };

  const handleReject = async (reason = 'declined') => {
    sound.stopAllRings();
    sound.playHangupTone();
    const callData = incomingCall;
    setIncomingCall(null);
    try {
      if (caller.id) {
        await api.respondCall(caller.id, callData.callId, false, reason, callData.roomId);
      }
    } catch (err) {
      console.error('Error rejecting call:', err);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
        {/* Animated ring glow background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/10 via-rose-600/10 to-transparent pointer-events-none" />

        {/* Pulse effect rings */}
        <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
          <div className="absolute -inset-2 rounded-full bg-indigo-500/10 animate-pulse" />
          {caller.avatarUrl ? (
            <img
              src={caller.avatarUrl}
              alt={callerName}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-slate-800 relative z-10 shadow-lg"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-indigo-950 border-2 border-indigo-700 text-indigo-200 font-bold text-xl flex items-center justify-center relative z-10 shadow-lg">
              {callerName.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <h3 className="text-lg font-bold text-slate-100 mb-1">{callerName}</h3>
        <p className="text-xs text-indigo-400 font-medium flex items-center justify-center gap-1.5 mb-2">
          {incomingCall.isVideo ? <Video className="w-3.5 h-3.5 text-indigo-400" /> : <Phone className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{incomingCall.isVideo ? 'Videollamada entrante...' : 'Llamada de voz entrante...'}</span>
        </p>
        <p className="text-[11px] text-slate-500 mb-8">
          {caller.jobTitle || 'Colaborador de tu espacio de trabajo'}
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => handleReject('declined')}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600/20 group-hover:bg-rose-600 border border-rose-500/40 group-hover:border-rose-600 text-rose-400 group-hover:text-white flex items-center justify-center transition-all shadow-lg shadow-rose-950">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 group-hover:text-rose-300">Rechazar</span>
          </button>

          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 group-hover:bg-emerald-500 border border-emerald-500 text-white flex items-center justify-center transition-all shadow-lg shadow-emerald-950 animate-bounce">
              <Phone className="w-6 h-6" />
            </div>
            <span className="text-[11px] font-semibold text-slate-300 group-hover:text-emerald-300">Aceptar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
