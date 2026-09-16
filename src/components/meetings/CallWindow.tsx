import React, { useState, useRef, useEffect } from 'react';
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
  UserPlus,
  Volume2
} from 'lucide-react';
import { useCall, PeerState } from '../../context/CallContext';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';

// Video tile component for a single peer or local user
const VideoTile: React.FC<{
  stream?: MediaStream | null;
  name: string;
  avatarUrl?: string;
  isLocal?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isScreenShare?: boolean;
  connectionState?: RTCPeerConnectionState;
}> = ({
  stream,
  name,
  avatarUrl,
  isLocal,
  isAudioMuted,
  isVideoOff,
  isSpeaking,
  isScreenShare,
  connectionState
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Bind video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.warn('[CallWindow] Video play prevented:', err);
      });
    }
  }, [stream]);

  // Bind audio stream for remote peers
  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(err => {
        if (err.name === 'NotAllowedError') {
          setAutoplayBlocked(true);
        }
        console.warn('[CallWindow] Audio autoplay prevented:', err);
      });
    }
  }, [stream, isLocal]);

  const handleManualPlayAudio = async () => {
    if (audioRef.current && stream) {
      try {
        await audioRef.current.play();
        setAutoplayBlocked(false);
      } catch (err) {
        console.warn('[CallWindow] Manual play failed:', err);
      }
    }
  };

  const hasVideoTrack = stream && stream.getVideoTracks().some(t => t.enabled);
  const showVideo = stream && !isVideoOff && hasVideoTrack;

  return (
    <div
      className={`relative w-full h-full rounded-2xl bg-slate-900/90 border overflow-hidden shadow-lg flex items-center justify-center transition-all duration-300 ${
        isSpeaking
          ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-emerald-950/40'
          : 'border-slate-800'
      }`}
    >
      {/* Remote Audio output element: ALWAYS mounted for remote participants */}
      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
        />
      )}

      {/* Autoplay blocked banner */}
      {autoplayBlocked && !isLocal && (
        <button
          onClick={handleManualPlayAudio}
          className="absolute top-3 left-3 right-3 z-30 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all animate-bounce"
        >
          <Volume2 className="w-4 h-4" />
          <span>Pulsa para activar audio</span>
        </button>
      )}

      {/* Connection state badge on remote tiles */}
      {!isLocal && connectionState && connectionState !== 'connected' && (
        <div className="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700 text-[10px] flex items-center gap-1.5 shadow-md">
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionState === 'connecting' ? 'bg-amber-400 animate-pulse' :
            connectionState === 'failed' ? 'bg-rose-500' : 'bg-slate-400'
          }`} />
          <span className="text-slate-300 font-medium">
            {connectionState === 'connecting' ? 'Conectando...' :
             connectionState === 'failed' ? 'Error de red' : connectionState}
          </span>
        </div>
      )}

      {/* Video Element: Kept mounted to preserve stream attachment during camera toggles */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || !isLocal}
        className={`w-full h-full object-cover ${isLocal && !isScreenShare ? 'transform scale-x-[-1]' : ''} ${
          showVideo ? 'block' : 'hidden'
        }`}
      />

      {/* Fallback Avatar Placeholder when video is off */}
      {!showVideo && (
        <div className="flex flex-col items-center gap-3 p-4 select-none">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-2 ring-indigo-500/40 shadow-xl"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-indigo-900 to-slate-800 border-2 border-indigo-700/60 flex items-center justify-center text-indigo-200 font-bold text-xl sm:text-2xl shadow-xl">
                {name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {isSpeaking && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white shadow">
                <Volume2 className="w-3 h-3" />
              </span>
            )}
          </div>
          <span className="text-slate-200 font-medium text-xs sm:text-sm text-center max-w-[140px] truncate">
            {name} {isLocal && '(Tú)'}
          </span>
        </div>
      )}

      {/* Bottom Info Badge */}
      <div className="absolute bottom-2.5 left-2.5 bg-slate-950/75 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-2 border border-slate-800/80 text-[11px] text-slate-200 shadow-md z-10">
        <span className="font-medium truncate max-w-[120px]">{name} {isLocal && '(Tú)'}</span>
        {isAudioMuted && <MicOff className="w-3 h-3 text-rose-400" />}
        {isScreenShare && <Monitor className="w-3 h-3 text-cyan-400" />}
        {isSpeaking && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
      </div>
    </div>
  );
};

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
    chatMessages,
    showInCallChat,
    showAddParticipant,
    endCall,
    toggleMic,
    toggleVideo,
    toggleScreenShare,
    setWindowMode,
    setShowInCallChat,
    setShowAddParticipant,
    sendInCallMessage,
    escalateToGroup
  } = useCall();

  const { currentUser } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Load potential participants for invite
  useEffect(() => {
    if (showAddParticipant) {
      setLoadingUsers(true);
      api.getUsers()
        .then(res => {
          if (res.success && res.data) {
            setWorkspaceUsers(res.data.filter((u: any) => u.id !== currentUser?.id));
          }
        })
        .finally(() => setLoadingUsers(false));
    }
  }, [showAddParticipant, currentUser?.id]);

  if (callState === 'idle' || !roomId) {
    return null;
  }

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

  // 1. MINIMIZED FLOATING PILL (Pumble / Teams style)
  if (windowMode === 'minimized') {
    return (
      <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl shadow-2xl p-3 flex items-center gap-3 animate-in slide-in-from-bottom-5">
        <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-100 max-w-[130px] truncate">{callTitle}</span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold">{formattedDuration}</span>
          </div>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMic}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              isAudioMuted ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isAudioMuted ? 'Activar micrófono' : 'Silenciar'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              isVideoOff ? 'bg-rose-600/30 text-rose-400 hover:bg-rose-600/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isVideoOff ? 'Encender cámara' : 'Apagar cámara'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setWindowMode('normal')}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors cursor-pointer"
            title="Expandir llamada"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            onClick={endCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs transition-colors cursor-pointer"
            title="Colgar llamada"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Calculate layout grid according to total participants (Local + Peers)
  const totalParticipants = 1 + peers.length;
  let gridColsClass = 'grid-cols-1';
  if (totalParticipants === 2) gridColsClass = 'grid-cols-1 md:grid-cols-2';
  else if (totalParticipants === 3 || totalParticipants === 4) gridColsClass = 'grid-cols-2';
  else if (totalParticipants >= 5) gridColsClass = 'grid-cols-2 md:grid-cols-3';

  const containerClasses = windowMode === 'fullscreen'
    ? 'fixed inset-0 z-50 bg-slate-950 flex flex-col'
    : 'fixed inset-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[780px] sm:h-[560px] z-50 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95';

  return (
    <div className={containerClasses}>
      {/* Window Header */}
      <div className="h-14 bg-slate-900/90 border-b border-slate-800 px-5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-100 text-sm max-w-[200px] sm:max-w-[280px] truncate">{callTitle}</span>
          </div>

          <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
            {formattedDuration}
          </span>

          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700">
            <Users className="w-3 h-3 text-slate-400" />
            <span>{totalParticipants} {totalParticipants === 1 ? 'persona' : 'personas'}</span>
          </span>
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

          {/* Minimize */}
          <button
            onClick={() => setWindowMode('minimized')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimizar a ventana flotante"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setWindowMode(windowMode === 'fullscreen' ? 'normal' : 'fullscreen')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={windowMode === 'fullscreen' ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video & Chat Stage */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid */}
        <div className={`flex-1 p-3 sm:p-4 grid ${gridColsClass} gap-3 sm:gap-4 overflow-y-auto items-center justify-center`}>
          {/* Local User Tile */}
          <VideoTile
            stream={isScreenSharing ? screenStream : localStream}
            name={currentUser ? (currentUser.displayName || currentUser.firstName) : 'Tú'}
            avatarUrl={currentUser?.avatarUrl}
            isLocal={true}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            isSpeaking={activeSpeakerId === 'local' || activeSpeakerId === currentUser?.id}
            isScreenShare={isScreenSharing}
          />

          {/* Remote Peers Tiles */}
          {peers.map((peer: PeerState) => (
            <VideoTile
              key={peer.userId}
              stream={peer.stream}
              name={peer.userName}
              avatarUrl={peer.userAvatar}
              isLocal={false}
              isAudioMuted={peer.isAudioMuted}
              isVideoOff={peer.isVideoOff}
              isSpeaking={peer.isSpeaking || activeSpeakerId === peer.userId}
              connectionState={peer.connectionState}
            />
          ))}

          {/* Empty state if waiting for peer */}
          {peers.length === 0 && (
            <div className="aspect-video rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                <Users className="w-7 h-7 text-indigo-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Esperando a que otros se unan...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Invita a más personas con el botón '+' o comparte el enlace de la llamada.
              </p>
            </div>
          )}
        </div>

        {/* In-Call Chat Drawer */}
        {showInCallChat && (
          <div className="w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 flex flex-col h-full animate-in slide-in-from-right shrink-0">
            <div className="p-3 border-b border-slate-800 font-bold text-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Chat de la llamada</span>
              </span>
              <button
                onClick={() => setShowInCallChat(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {chatMessages.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  No hay mensajes en esta llamada todavía.
                </div>
              ) : (
                chatMessages.map(m => (
                  <div key={m.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-indigo-300">{m.senderName}</span>
                      <span className="font-mono">{m.time}</span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Escribe en la llamada..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Add Participant Modal / Drawer */}
        {showAddParticipant && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-20 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span>Invitar a la llamada</span>
                </span>
                <button
                  onClick={() => setShowAddParticipant(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 mt-3 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <div className="max-h-56 overflow-y-auto mt-3 space-y-1.5">
                {loadingUsers ? (
                  <div className="text-center py-6 text-xs text-slate-500">Cargando colaboradores...</div>
                ) : (
                  workspaceUsers
                    .filter(u => {
                      const full = `${u.displayName} ${u.email}`.toLowerCase();
                      return full.includes(searchFilter.toLowerCase());
                    })
                    .map(u => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/70 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <span className="text-xs font-semibold text-slate-200 block">{u.displayName}</span>
                            <span className="text-[10px] text-slate-500">{u.jobTitle || u.email}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => escalateToGroup(u.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
                        >
                          Invitar
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Control Bar */}
      <div className="h-18 bg-slate-900/90 border-t border-slate-800 px-6 flex items-center justify-center gap-3 sm:gap-4 shrink-0">
        {/* Mic */}
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

        {/* Video Camera */}
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            isVideoOff
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isVideoOff ? 'Encender cámara' : 'Apagar cámara'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            isScreenSharing
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isScreenSharing ? 'Detener compartir pantalla' : 'Compartir pantalla'}
        >
          <Monitor className="w-5 h-5" />
        </button>

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

        {/* Add Participant */}
        <button
          onClick={() => setShowAddParticipant(!showAddParticipant)}
          className={`p-3 rounded-2xl transition-all shadow-md cursor-pointer ${
            showAddParticipant
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Agregar participante (Escalar a llamada grupal)"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        {/* End / Hangup Call */}
        <button
          onClick={endCall}
          className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 ml-2 cursor-pointer"
          title="Finalizar llamada"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline text-xs font-semibold">Finalizar</span>
        </button>
      </div>
    </div>
  );
};
