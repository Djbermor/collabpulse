import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Crown, Monitor } from 'lucide-react';
import { RemoteTrack } from 'livekit-client';

export interface ParticipantTileProps {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: 'host' | 'participant';
  isLocal?: boolean;
  videoTrack?: RemoteTrack | MediaStreamTrack;
  audioTrack?: RemoteTrack | MediaStreamTrack;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  isScreenSharing?: boolean;
}

export const ParticipantTile: React.FC<ParticipantTileProps> = ({
  name,
  avatarUrl,
  role,
  isLocal = false,
  videoTrack,
  isAudioMuted,
  isVideoOff,
  isSpeaking,
  isScreenSharing = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    if (videoTrack) {
      if ('attach' in videoTrack && typeof videoTrack.attach === 'function') {
        // LiveKit RemoteTrack
        videoTrack.attach(videoRef.current);
      } else if (videoTrack instanceof MediaStreamTrack) {
        // Native MediaStreamTrack (e.g. local stream)
        const stream = new MediaStream([videoTrack]);
        videoRef.current.srcObject = stream;
      }
    } else {
      videoRef.current.srcObject = null;
    }
  }, [videoTrack, isVideoOff]);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';

  return (
    <div
      className={`relative w-full h-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 select-none ${
        isSpeaking ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' : 'ring-1 ring-slate-800'
      }`}
    >
      {/* Video Element */}
      {!isVideoOff && videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${
            isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''
          }`}
        />
      ) : (
        /* Avatar Placeholder when video is off */
        <div className="flex flex-col items-center justify-center p-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-700 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white text-2xl font-bold shadow-md border-2 border-indigo-500/30">
              {initials}
            </div>
          )}
          <span className="text-slate-300 font-medium text-sm mt-2">{name} {isLocal && '(Tú)'}</span>
        </div>
      )}

      {/* Top Left Badges: Role and Screen Sharing */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
        {role === 'host' && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 backdrop-blur-md">
            <Crown className="w-3 h-3 text-amber-400" /> Host
          </span>
        )}
        {isScreenSharing && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md">
            <Monitor className="w-3 h-3" /> Pantalla
          </span>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 max-w-[70%]">
          <span className="text-white text-xs font-medium truncate drop-shadow-sm">
            {name} {isLocal && '(Tú)'}
          </span>
          {isSpeaking && (
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-[10px] text-emerald-400 font-medium hidden sm:inline">Hablando</span>
            </span>
          )}
        </div>

        {/* Audio / Video Status Icons */}
        <div className="flex items-center gap-1.5">
          <div
            className={`p-1 rounded-md text-xs ${
              isAudioMuted
                ? 'bg-rose-500/80 text-white'
                : 'bg-slate-800/80 text-slate-300'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
          </div>

          <div
            className={`p-1 rounded-md text-xs ${
              isVideoOff
                ? 'bg-rose-500/80 text-white'
                : 'bg-slate-800/80 text-slate-300'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5 text-emerald-400" />}
          </div>
        </div>
      </div>
    </div>
  );
};
