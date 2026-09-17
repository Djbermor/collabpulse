import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Users,
  MessageSquare,
  Copy,
  Check,
  Send,
  Minimize2,
  Maximize2,
  Volume2,
  AlertCircle,
  Pause,
  Play,
  ArrowLeftRight
} from 'lucide-react';
import { useCall, PeerState } from '../../context/CallContext';
import { useApp } from '../../context/AppContext';
import { formatMediaError, FormattedMediaError } from '../../utils/mediaErrors';
import { ParticipantGrid } from './ParticipantGrid';
import { ParticipantTileProps } from './ParticipantTile';
import { InCallChatPanel } from './InCallChatPanel';

export const CallWindow: React.FC = () => {
  const {
    callState,
    windowMode,
    roomId,
    callTitle,
    callType,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    formattedDuration,
    localStream,
    screenStream,
    peers,
    activeSpeakerId,
    activeSession,
    heldSession,
    heldSessions,
    isHeldLocally,
    isHeldRemotely,
    incomingCall,
    holdCall,
    resumeCall,
    swapCalls,
    acceptCall,
    rejectCall,
    sfuPeers,
    isHost,
    endGroupCall,
    leaveGroupCall,
    chatMessages,
    showInCallChat,
    callConversationId,
    endCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
    setWindowMode,
    setShowInCallChat,
    sendInCallMessage
  } = useCall();

  const { currentUser, activeView, activeMeeting } = useApp();

  // Local state
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [mediaError, setMediaError] = useState<FormattedMediaError | null>(null);

  // Dedicated media elements refs
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Active remote peer for current active session
  const activeRemoteUserId = activeSession ? (
    activeSession.direction === 'inbound'
      ? activeSession.callerId
      : (activeSession.calleeId || activeSession.participantIds?.find(id => id !== activeSession.callerId) || activeSession.participantIds?.[0])
  ) : undefined;

  const remotePeer: PeerState | undefined = activeRemoteUserId
    ? peers.find(p => p.userId === activeRemoteUserId)
    : peers[0];

  // 1. Bind remote video stream (only when not on hold)
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remotePeer?.stream && !isHeldLocally && callState !== 'held') {
        remoteVideoRef.current.srcObject = remotePeer.stream;
        remoteVideoRef.current.play().catch(err => {
          console.warn('[CallWindow] Remote video play prevented:', err);
        });
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remotePeer?.stream, isHeldLocally, callState]);

  // 2. Bind remote audio stream (ALWAYS bound independently of video)
  // Strict Audio Isolation: Silenced when call is held locally or when callState is 'held'!
  useEffect(() => {
    if (remoteAudioRef.current) {
      if (remotePeer?.stream && !isHeldLocally && callState !== 'held') {
        remoteAudioRef.current.srcObject = remotePeer.stream;
        remoteAudioRef.current.play()
          .then(() => {
            setAutoplayBlocked(false);
          })
          .catch(err => {
            if (err.name === 'NotAllowedError' || err.name === 'AutoplayError') {
              setAutoplayBlocked(true);
            }
            console.warn('[CallWindow] Audio autoplay restricted by browser:', err);
          });
      } else {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
    }
  }, [remotePeer?.stream, isHeldLocally, callState]);

  // 3. Bind local video stream for Self-View PIP
  useEffect(() => {
    if (localVideoRef.current) {
      const activeStream = isScreenSharing ? screenStream : localStream;
      if (activeStream) {
        localVideoRef.current.srcObject = activeStream;
        localVideoRef.current.play().catch(err => {
          console.warn('[CallWindow] Local video play prevented:', err);
        });
      }
    }
  }, [localStream, screenStream, isScreenSharing]);

  // If call is idle or ended, don't render floating window
  if (callState === 'idle' || !roomId) {
    return null;
  }

  // If inside the full group MeetingRoom view and activeMeeting is set, avoid duplicate window
  if (activeView === 'meeting' && activeMeeting) {
    return null;
  }

  const handleManualUnlockAudio = async () => {
    if (remoteAudioRef.current && remotePeer?.stream) {
      try {
        await remoteAudioRef.current.play();
        setAutoplayBlocked(false);
      } catch (err) {
        console.warn('[CallWindow] Manual audio play failed:', err);
      }
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/meet/${roomId}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendInCallMessage(chatInput);
    setChatInput('');
  };

  const handleSafeToggleVideo = async () => {
    try {
      setMediaError(null);
      await toggleVideo();
    } catch (err: any) {
      const formatted = formatMediaError(err);
      setMediaError(formatted);
      setTimeout(() => setMediaError(null), 5000);
    }
  };

  const handleSafeToggleScreenShare = async () => {
    try {
      setMediaError(null);
      await toggleScreenShare();
    } catch (err: any) {
      const formatted = formatMediaError(err);
      setMediaError(formatted);
      setTimeout(() => setMediaError(null), 5000);
    }
  };

  // Status text and badge color
  const getConnectionStatusInfo = () => {
    if (callState === 'held' || isHeldLocally) {
      return { text: 'En espera', color: 'bg-amber-500', border: 'border-amber-500/40 text-amber-300' };
    }
    if (isHeldRemotely) {
      return { text: 'Pausada por usuario', color: 'bg-amber-500', border: 'border-amber-500/40 text-amber-300' };
    }
    if (callState === 'reconnecting' || remotePeer?.connectionState === 'reconnecting') {
      return { text: 'Reconectando...', color: 'bg-amber-500 animate-pulse', border: 'border-amber-500/40 text-amber-300' };
    }
    if (callState === 'connecting' || remotePeer?.connectionState === 'connecting') {
      return { text: 'Conectando...', color: 'bg-yellow-400 animate-pulse', border: 'border-yellow-500/40 text-yellow-300' };
    }
    if (callState === 'failed' || remotePeer?.connectionState === 'failed') {
      return { text: 'Conexión perdida', color: 'bg-rose-500', border: 'border-rose-500/40 text-rose-300' };
    }
    return { text: 'Conectado', color: 'bg-emerald-500 animate-pulse', border: 'border-emerald-500/40 text-emerald-300' };
  };

  const statusInfo = getConnectionStatusInfo();

  const localVideoTrack = isScreenSharing && screenStream
    ? screenStream.getVideoTracks()[0]
    : localStream?.getVideoTracks()[0];

  const localParticipantTile: ParticipantTileProps = {
    id: 'local',
    name: 'Tú',
    role: isHost ? 'host' : 'participant',
    isLocal: true,
    videoTrack: localVideoTrack,
    isAudioMuted,
    isVideoOff,
    isSpeaking: false,
    isScreenSharing
  };

  const remoteParticipantTiles: ParticipantTileProps[] = sfuPeers.map(p => ({
    id: p.identity,
    name: p.name,
    role: p.metadata?.role || 'participant',
    isLocal: false,
    videoTrack: p.screenTrack || p.videoTrack,
    audioTrack: p.audioTrack,
    isAudioMuted: p.isAudioMuted,
    isVideoOff: p.isVideoOff,
    isSpeaking: p.isSpeaking,
    isScreenSharing: p.isScreenSharing
  }));

  // ==========================================
  // MODE 1: MINIMIZED FLOATING PILL
  // ==========================================
  if (windowMode === 'minimized') {
    return (
      <aside
        aria-label="Llamada minimizada"
        className="fixed bottom-5 right-5 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-5 selection:bg-none select-none"
      >
        {/* Dedicated Audio Element for Minimized mode */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
          <span className={`w-2.5 h-2.5 rounded-full ${callState === 'held' || isHeldLocally ? 'bg-amber-400' : statusInfo.color}`} />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-100 max-w-[130px] truncate">
              {remotePeer?.userName || callTitle}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-indigo-400 font-semibold">
                {formattedDuration}
              </span>
              {(callState === 'held' || isHeldLocally) && (
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300 font-medium">
                  En espera
                </span>
              )}
              {heldSession && activeSession && activeSession.id !== heldSession.id && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-900 border border-indigo-700/60 text-indigo-200 font-bold">
                  +1 espera
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick controls in minimized mode */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMic}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              isAudioMuted
                ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/40'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isAudioMuted ? 'Activar micrófono' : 'Silenciar'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={handleSafeToggleVideo}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              isVideoOff
                ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/40'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isVideoOff ? 'Encender cámara' : 'Apagar cámara'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setWindowMode('normal')}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors cursor-pointer"
            title="Restaurar llamada"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => endCall('completed')}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs transition-colors cursor-pointer"
            title="Finalizar llamada"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // ==========================================
  // MODE 2 & 3: NORMAL FLOATING CARD & FULLSCREEN
  // ==========================================
  const containerClasses = windowMode === 'fullscreen'
    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col selection:bg-none select-none'
    : 'fixed inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[780px] sm:h-[540px] z-50 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 selection:bg-none select-none';

  const hasRemoteVideo = remotePeer?.stream && remotePeer.stream.getVideoTracks().some(t => t.enabled);
  const showRemoteVideo = hasRemoteVideo && !remotePeer?.isVideoOff;

  const hasLocalVideo = localStream && localStream.getVideoTracks().some(t => t.enabled);
  const showLocalVideo = isScreenSharing || (!isVideoOff && hasLocalVideo);

  return (
    <div className={containerClasses}>
      {/* Remote Audio output element: ALWAYS mounted and playing */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Autoplay blocked banner fallback */}
      {autoplayBlocked && (
        <div className="absolute top-16 left-4 right-4 z-40 p-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            <span>El navegador bloqueó la reproducción de audio. Pulsa el botón para activarlo:</span>
          </div>
          <button
            onClick={handleManualUnlockAudio}
            className="px-3 py-1 rounded-xl bg-slate-950 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer transition-colors"
          >
            Activar audio
          </button>
        </div>
      )}

      {/* Media Error Notification Banner */}
      {mediaError && (
        <div className="absolute top-16 left-4 right-4 z-40 p-3 rounded-2xl bg-rose-600/90 backdrop-blur-md text-white font-medium text-xs shadow-2xl flex items-center gap-2.5 border border-rose-400/40 animate-in slide-in-from-top-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-200" />
          <div className="flex-1">
            <span className="font-bold block">{mediaError.title}</span>
            <span>{mediaError.message}</span>
          </div>
          <button
            onClick={() => setMediaError(null)}
            className="text-rose-200 hover:text-white text-xs cursor-pointer p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Window Header */}
      <div className="h-14 bg-slate-900/90 border-b border-slate-800 px-5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.color}`} />
            <span className="font-bold text-slate-100 text-sm max-w-[140px] sm:max-w-[200px] truncate">
              {remotePeer?.userName || callTitle}
            </span>
          </div>

          <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
            {formattedDuration}
          </span>

          <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg border bg-slate-900/80 ${statusInfo.border}`}>
            <span>{statusInfo.text}</span>
          </span>

          {/* Held Call Switcher Tab in Header */}
          {heldSession && activeSession && activeSession.id !== heldSession.id && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-amber-950/70 border border-amber-800/80 text-xs text-amber-300 animate-in fade-in">
              <Pause className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="max-w-[80px] sm:max-w-[110px] truncate text-[11px] font-medium">
                {heldSession.callerName || heldSession.calleeName || 'Llamada'}
              </span>
              <span className="text-[10px] text-amber-400/80 hidden sm:inline">(Espera)</span>
              <button
                onClick={() => resumeCall(heldSession.id)}
                className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer transition-colors shadow"
                title="Reanudar esta llamada"
              >
                Reanudar
              </button>
              <button
                onClick={() => endCall(heldSession.id, 'completed')}
                className="p-1 rounded-lg bg-rose-900/60 hover:bg-rose-700 text-rose-200 text-[10px] cursor-pointer transition-colors"
                title="Colgar llamada en espera"
              >
                <PhoneOff className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
            title="Copiar enlace de la llamada"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedLink ? 'Copiado' : 'Enlace'}</span>
          </button>

          {/* Minimize Button */}
          <button
            onClick={() => setWindowMode('minimized')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimizar a ventana flotante"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setWindowMode(windowMode === 'fullscreen' ? 'normal' : 'fullscreen')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={windowMode === 'fullscreen' ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video & Content Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* In-Call Incoming Call Overlay Banner */}
        {incomingCall && (
          <div className="absolute top-3 left-4 right-4 z-40 p-3 rounded-2xl bg-indigo-950/95 backdrop-blur-md border border-indigo-500/50 shadow-2xl flex items-center justify-between animate-in slide-in-from-top-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow animate-pulse">
                {incomingCall.caller?.avatarUrl ? (
                  <img src={incomingCall.caller.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  (incomingCall.caller?.displayName || 'C').substring(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    Llamada entrante de {incomingCall.caller?.displayName || 'Colaborador'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-800 text-indigo-200">
                    {incomingCall.isVideo ? 'Video' : 'Audio'}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-300">
                  Aceptar pondrá tu llamada actual en espera.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => rejectCall(incomingCall.callId, 'declined')}
                className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600 text-rose-200 hover:text-white text-xs font-semibold border border-rose-500/40 transition-all cursor-pointer"
              >
                Rechazar
              </button>
              <button
                onClick={() => acceptCall(incomingCall.callId)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950 transition-all cursor-pointer"
              >
                Aceptar y poner en espera
              </button>
            </div>
          </div>
        )}

        {/* Stage Container */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {activeSession?.type === 'group' ? (
            <ParticipantGrid
              localParticipant={localParticipantTile}
              remoteParticipants={remoteParticipantTiles}
              isScreenSharingActive={isScreenSharing || sfuPeers.some(p => p.isScreenSharing)}
            />
          ) : (
            <>
              {/* Held Overlay when locally held */}
          {(isHeldLocally || callState === 'held') && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
                <Pause className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-100 mb-1">Llamada en espera</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Has puesto la llamada en espera. El audio y video están temporalmente pausados.
              </p>
              <button
                onClick={() => {
                  const idToResume = activeSession?.id || heldSession?.id;
                  if (idToResume) resumeCall(idToResume);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950 cursor-pointer transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Reanudar llamada</span>
              </button>
            </div>
          )}

          {/* Remote Peer Held Overlay */}
          {isHeldRemotely && !isHeldLocally && callState !== 'held' && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-amber-950/90 border border-amber-700/60 shadow-xl flex items-center gap-2 text-amber-300 text-xs font-medium animate-in slide-in-from-top-2">
              <Pause className="w-4 h-4 text-amber-400" />
              <span>El otro colaborador ha puesto la llamada en espera</span>
            </div>
          )}

          {/* Remote Video Element */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${showRemoteVideo ? 'block' : 'hidden'}`}
          />

          {/* Fallback when Remote Video is Off / Audio Only */}
          {!showRemoteVideo && (
            <div className="flex flex-col items-center gap-4 p-6 select-none animate-in fade-in">
              <div className="relative">
                {remotePeer?.userAvatar ? (
                  <img
                    src={remotePeer.userAvatar}
                    alt={remotePeer.userName}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-indigo-500/40 shadow-2xl"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-indigo-900 to-slate-800 border-2 border-indigo-700/60 flex items-center justify-center text-indigo-200 font-bold text-3xl shadow-2xl">
                    {(remotePeer?.userName || callTitle).substring(0, 2).toUpperCase()}
                  </div>
                )}
                {remotePeer?.isSpeaking && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white shadow">
                    <Volume2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div className="text-center">
                <h3 className="text-slate-100 font-bold text-base sm:text-lg">
                  {remotePeer?.userName || callTitle}
                </h3>
                <span className="text-slate-500 text-xs mt-0.5 block">
                  {callType === 'audio' ? 'Llamada de voz' : 'Cámara apagada'}
                </span>
              </div>
            </div>
          )}

          {/* Empty state if waiting for peer */}
          {!remotePeer && (
            <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400 mb-3 shadow-inner">
                <Users className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Esperando respuesta...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Conectando llamada con el colaborador.
              </p>
            </div>
          )}

          {/* ==========================================
              SELF-VIEW PIP (Picture-In-Picture)
              ========================================== */}
          <div className="absolute bottom-4 right-4 z-20 w-40 h-28 sm:w-48 sm:h-32 rounded-2xl bg-slate-900/90 border border-slate-700/80 shadow-2xl overflow-hidden flex items-center justify-center group">
            {/* Local Video Element */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isScreenSharing ? 'transform scale-x-[-1]' : ''} ${
                showLocalVideo ? 'block' : 'hidden'
              }`}
            />

            {/* Local Camera Off / Audio-Only Self Placeholder */}
            {!showLocalVideo && (
              <div className="flex flex-col items-center justify-center gap-1.5 p-2 text-center select-none">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-800 to-slate-800 flex items-center justify-center text-indigo-200 font-bold text-xs border border-indigo-600/50 shadow">
                  {currentUser ? (currentUser.displayName || currentUser.firstName).substring(0, 2).toUpperCase() : 'TÚ'}
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Cámara apagada</span>
              </div>
            )}

            {/* Badge overlay on Self-view */}
            <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-white/90 bg-slate-950/75 backdrop-blur-xs px-2 py-0.5 rounded-lg">
              <span className="font-semibold truncate max-w-[80px]">
                {isScreenSharing ? 'Tu pantalla' : 'Tú'}
              </span>
              <div className="flex items-center gap-1">
                {isAudioMuted && <MicOff className="w-3 h-3 text-rose-400" />}
                {isScreenSharing && <Monitor className="w-3 h-3 text-cyan-400" />}
              </div>
            </div>
          </div>
            </>
          )}
        </div>

        {/* In-Call Chat Panel (FASE 6 — real persistence) */}
        <InCallChatPanel />
      </div>

      {/* Footer Control Bar */}
      <div className="h-18 bg-slate-900/90 border-t border-slate-800 px-6 flex items-center justify-center gap-3 sm:gap-4 shrink-0">
        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isAudioMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Video Camera toggle (supports audio -> video dynamic promotion) */}
        <button
          onClick={handleSafeToggleVideo}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            isVideoOff
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isVideoOff ? 'Encender cámara / Activar video' : 'Apagar cámara'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen share toggle with replaceTrack */}
        <button
          onClick={handleSafeToggleScreenShare}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            isScreenSharing
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isScreenSharing ? 'Detener compartir pantalla' : 'Compartir pantalla'}
        >
          <Monitor className="w-5 h-5" />
        </button>

        {/* Hold / Resume Toggle */}
        <button
          onClick={() => {
            if (callState === 'held' || isHeldLocally) {
              const idToResume = activeSession?.id || heldSession?.id;
              if (idToResume) resumeCall(idToResume);
            } else {
              holdCall();
            }
          }}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            callState === 'held' || isHeldLocally
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={callState === 'held' || isHeldLocally ? 'Reanudar llamada' : 'Poner en espera'}
        >
          {callState === 'held' || isHeldLocally ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
        </button>

        {/* Swap Calls Button */}
        {activeSession && heldSession && activeSession.id !== heldSession.id && (
          <button
            onClick={swapCalls}
            className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            title="Intercambiar con la llamada en espera"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="hidden sm:inline">Swap</span>
          </button>
        )}

        {/* In-Call Chat Drawer Toggle */}
        <button
          onClick={() => setShowInCallChat(!showInCallChat)}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer relative ${
            showInCallChat
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Chat de la llamada"
        >
          <MessageSquare className="w-5 h-5" />
          {chatMessages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
              {chatMessages.length}
            </span>
          )}
        </button>

        {/* End / Hangup Call (Idempotent) */}
        <button
          onClick={() => {
            if (activeSession?.type === 'group') {
              if (isHost) {
                endGroupCall();
              } else {
                leaveGroupCall();
              }
            } else {
              endCall(activeSession?.id, 'completed');
            }
          }}
          className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 ml-2 cursor-pointer"
          title={activeSession?.type === 'group' ? (isHost ? 'Finalizar conferencia para todos' : 'Abandonar conferencia') : 'Finalizar llamada'}
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-semibold">
            {activeSession?.type === 'group' ? (isHost ? 'Finalizar sala' : 'Salir') : 'Finalizar'}
          </span>
        </button>
      </div>
    </div>
  );
};
