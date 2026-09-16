import React, { useState, useRef, useEffect } from 'react';
import {
  MicOff,
  Monitor,
  Volume2
} from 'lucide-react';

export interface VideoTileProps {
  stream?: MediaStream | null;
  name: string;
  avatarUrl?: string;
  isLocal?: boolean;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isSpeaking?: boolean;
  isScreenShare?: boolean;
  connectionState?: RTCPeerConnectionState;
}

export const VideoTile: React.FC<VideoTileProps> = ({
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
        console.warn('[VideoTile] Video play prevented:', err);
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
        console.warn('[VideoTile] Audio autoplay prevented:', err);
      });
    }
  }, [stream, isLocal]);

  const handleManualPlayAudio = async () => {
    if (audioRef.current && stream) {
      try {
        await audioRef.current.play();
        setAutoplayBlocked(false);
      } catch (err) {
        console.warn('[VideoTile] Manual play failed:', err);
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
