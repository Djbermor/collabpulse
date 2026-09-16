import React, { useState } from 'react';
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
  UserPlus,
  Volume2
} from 'lucide-react';
import { useCall, PeerState } from '../../context/CallContext';
import { useApp } from '../../context/AppContext';

export const MeetingRoom: React.FC = () => {
  const {
    callState,
    roomId,
    callTitle,
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
    setShowInCallChat,
    setShowAddParticipant,
    sendInCallMessage
  } = useCall();

  const { currentUser } = useApp();

  const [copiedLink, setCopiedLink] = useState(false);
  const [newChatText, setNewChatText] = useState('');

  const handleCopyLink = () => {
    if (roomId) {
      navigator.clipboard.writeText(window.location.origin + `/meet/${roomId}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatText.trim()) return;
    sendInCallMessage(newChatText);
    setNewChatText('');
  };

  const totalParticipants = 1 + peers.length;
  let gridColsClass = 'grid-cols-1';
  if (totalParticipants === 2) gridColsClass = 'grid-cols-1 md:grid-cols-2';
  else if (totalParticipants === 3 || totalParticipants === 4) gridColsClass = 'grid-cols-2';
  else if (totalParticipants >= 5) gridColsClass = 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden select-none relative">
      {/* Header */}
      <div className="h-14 bg-slate-900/80 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-100 text-sm">{callTitle || 'Reunión en curso'}</span>
          </div>
          <span className="font-mono text-xs text-indigo-300 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
            {formattedDuration}
          </span>
          <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {roomId || 'sala'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace'}</span>
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 p-4 grid ${gridColsClass} gap-4 overflow-y-auto items-center justify-center`}>
          {/* Local User Video Tile */}
          <div
            className={`relative aspect-video rounded-2xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center group ${
              activeSpeakerId === 'local' || activeSpeakerId === currentUser?.id
                ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                : 'border-slate-800 ring-1 ring-indigo-500/30'
            }`}
          >
            {isVideoOff && !isScreenSharing ? (
              <div className="flex flex-col items-center gap-2 select-none">
                <img
                  src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt="Tú"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-indigo-500"
                />
                <span className="text-slate-300 font-semibold text-sm">{currentUser?.firstName} (Tú)</span>
              </div>
            ) : (
              <video
                ref={el => {
                  if (el) {
                    el.srcObject = isScreenSharing ? screenStream : localStream;
                  }
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isScreenSharing ? 'transform scale-x-[-1]' : ''}`}
              />
            )}

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg flex items-center gap-2 text-white text-xs">
              <span className="font-medium">{currentUser?.firstName || 'Tú'} (Tú)</span>
              {isAudioMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
              {isScreenSharing && <Monitor className="w-3.5 h-3.5 text-cyan-400" />}
            </div>
          </div>

          {/* Remote Peers */}
          {peers.map((peer: PeerState) => (
            <div
              key={peer.userId}
              className={`relative aspect-video rounded-2xl bg-slate-900 border overflow-hidden shadow-2xl flex items-center justify-center ${
                peer.isSpeaking || activeSpeakerId === peer.userId
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50'
                  : 'border-slate-800'
              }`}
            >
              {peer.stream && !peer.isVideoOff ? (
                <video
                  ref={el => {
                    if (el && peer.stream) {
                      el.srcObject = peer.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center p-4">
                  {peer.userAvatar ? (
                    <img
                      src={peer.userAvatar}
                      alt={peer.userName}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-lg">
                      {peer.userName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-slate-300 font-semibold text-sm">{peer.userName}</span>
                </div>
              )}

              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg flex items-center gap-2 text-white text-xs">
                <span className="font-medium">{peer.userName}</span>
                {peer.isAudioMuted && <MicOff className="w-3.5 h-3.5 text-rose-400" />}
              </div>
            </div>
          ))}

          {/* Empty state if waiting for peer */}
          {peers.length === 0 && (
            <div className="aspect-video rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
                <Users className="w-7 h-7 text-indigo-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Esperando a que otros se unan...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                La sala está lista. Puedes compartir el enlace con tus compañeros.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Meeting In-Call Chat */}
        {showInCallChat && (
          <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full animate-in slide-in-from-right">
            <div className="p-3 border-b border-slate-800 font-bold text-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Chat de la reunión</span>
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

            <form onSubmit={handleSendChat} className="p-2.5 border-t border-slate-800 bg-slate-950/70 flex gap-1.5">
              <input
                type="text"
                value={newChatText}
                onChange={e => setNewChatText(e.target.value)}
                placeholder="Escribe en la llamada..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newChatText.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="h-20 bg-slate-900/90 border-t border-slate-800 px-6 flex items-center justify-center gap-4 shrink-0">
        <button
          onClick={toggleMic}
          className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
            isAudioMuted ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isAudioMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
            isVideoOff ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title={isVideoOff ? 'Activar cámara' : 'Apagar cámara'}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
            isScreenSharing ? 'bg-cyan-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Compartir pantalla"
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowInCallChat(!showInCallChat)}
          className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
            showInCallChat ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Abrir chat de la reunión"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowAddParticipant(!showAddParticipant)}
          className={`p-3.5 rounded-2xl transition-all shadow-md cursor-pointer ${
            showAddParticipant ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }`}
          title="Invitar participante"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        <button
          onClick={endCall}
          className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30 ml-4 cursor-pointer"
          title="Finalizar llamada"
        >
          <PhoneOff className="w-5 h-5" />
          <span>Finalizar</span>
        </button>
      </div>
    </div>
  );
};
