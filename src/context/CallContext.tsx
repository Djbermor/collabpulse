import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { signalR } from '../services/signalr';
import { sound } from '../services/sound';
import { callLog } from '../services/callDebug';
import { useApp } from './AppContext';

export interface PeerState {
  userId: string;
  userName: string;
  userAvatar?: string;
  stream?: MediaStream;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  connectionState?: RTCPeerConnectionState;
}

export interface InCallChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  time: string;
}

export type CallState = 'idle' | 'calling' | 'connected';
export type WindowMode = 'normal' | 'minimized' | 'fullscreen';

export interface StartCallParams {
  roomId: string;
  title: string;
  callType: 'video' | 'audio';
  conversationId?: string;
  channelId?: string;
  targetUserId?: string;
  isInitiator?: boolean;
}

interface PeerContext {
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  pendingIceCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
  remoteUserId: string;
}

interface CallContextType {
  callState: CallState;
  windowMode: WindowMode;
  roomId: string | null;
  callTitle: string;
  callType: 'video' | 'audio';
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  duration: number;
  formattedDuration: string;
  parentConversationId: string | null;
  parentChannelId: string | null;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  peers: PeerState[];
  activeSpeakerId: string | null;
  chatMessages: InCallChatMessage[];
  showInCallChat: boolean;
  showAddParticipant: boolean;

  // Actions
  joinCall: (params: StartCallParams) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setWindowMode: (mode: WindowMode) => void;
  setShowInCallChat: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowAddParticipant: (show: boolean | ((prev: boolean) => boolean)) => void;
  sendInCallMessage: (text: string) => Promise<void>;
  escalateToGroup: (newUserId: string) => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, addToast } = useApp();

  const [callState, setCallState] = useState<CallState>('idle');
  const [windowMode, setWindowMode] = useState<WindowMode>('normal');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [callTitle, setCallTitle] = useState<string>('Llamada');
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [parentConversationId, setParentConversationId] = useState<string | null>(null);
  const [parentChannelId, setParentChannelId] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peersMap, setPeersMap] = useState<Map<string, PeerState>>(new Map());
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([]);
  const [showInCallChat, setShowInCallChat] = useState<boolean>(false);
  const [showAddParticipant, setShowAddParticipant] = useState<boolean>(false);

  // Mutable refs to prevent stale closures in async callbacks
  const peerContextsRef = useRef<Map<string, PeerContext>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const screenStreamRef = useRef<MediaStream | null>(null);
  screenStreamRef.current = screenStream;
  const roomIdRef = useRef<string | null>(null);
  roomIdRef.current = roomId;
  const callStateRef = useRef<CallState>('idle');
  callStateRef.current = callState;
  const peersMapRef = useRef<Map<string, PeerState>>(new Map());
  peersMapRef.current = peersMap;

  // Audio Analyser for Active Speaker Detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const speakerIntervalRef = useRef<any>(null);

  // Timer interval ref
  const timerIntervalRef = useRef<any>(null);

  // Duration formatting (MM:SS or HH:MM:SS)
  const formattedDuration = React.useMemo(() => {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  // Cleanly attach audio analyser to track speaking levels
  const attachAudioAnalyser = (id: string, stream: MediaStream) => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodesRef.current.set(id, analyser);
    } catch (err) {
      console.warn('[CallContext] Could not attach audio analyser:', err);
    }
  };

  // Check audio levels periodically
  useEffect(() => {
    if (callState !== 'connected') {
      if (speakerIntervalRef.current) {
        clearInterval(speakerIntervalRef.current);
        speakerIntervalRef.current = null;
      }
      return;
    }

    speakerIntervalRef.current = setInterval(() => {
      let maxVol = 0;
      let dominantSpeaker: string | null = null;

      analyserNodesRef.current.forEach((analyser, id) => {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const isSpeaking = avg > 18;

        if (id === 'local') {
          // Local user speaking
          if (isSpeaking && avg > maxVol) {
            maxVol = avg;
            dominantSpeaker = currentUser?.id || 'local';
          }
        } else {
          // Remote peer speaking
          setPeersMap(prev => {
            const peer = prev.get(id);
            if (peer && peer.isSpeaking !== isSpeaking) {
              const updated = new Map(prev);
              updated.set(id, { ...peer, isSpeaking });
              return updated;
            }
            return prev;
          });
          if (isSpeaking && avg > maxVol) {
            maxVol = avg;
            dominantSpeaker = id;
          }
        }
      });

      setActiveSpeakerId(dominantSpeaker);
    }, 200);

    return () => {
      if (speakerIntervalRef.current) {
        clearInterval(speakerIntervalRef.current);
        speakerIntervalRef.current = null;
      }
    };
  }, [callState, currentUser?.id]);

  // Robust Media Capture with Descriptive Error Messages & Fallback
  const acquireLocalMedia = async (type: 'video' | 'audio'): Promise<MediaStream> => {
    callLog('GET USER MEDIA', { type });
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      callLog('LOCAL STREAM', {
        id: stream.id,
        audioTracks: stream.getAudioTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled })),
        videoTracks: stream.getVideoTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled }))
      });
      return stream;
    } catch (err: any) {
      callLog('GET USER MEDIA ERROR', { name: err.name, message: err.message });
      let userMsg = 'Error al acceder a los dispositivos de llamada.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userMsg = 'Micrófono o cámara bloqueados. Permita el acceso en el navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        userMsg = 'No se encontró micrófono o cámara en este equipo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        userMsg = 'Dispositivo ocupado: otra aplicación está usando el micrófono o la cámara.';
      } else if (err.name === 'OverconstrainedError') {
        userMsg = 'La resolución de video solicitada no es soportada por la cámara.';
      } else if (err.name === 'SecurityError') {
        userMsg = 'Acceso a medios no permitido en este contexto de seguridad.';
      }

      // If video failed, attempt audio-only fallback automatically
      if (type === 'video') {
        try {
          callLog('GET USER MEDIA FALLBACK TO AUDIO');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          addToast(userMsg + ' Iniciando en modo solo audio.', 'warning');
          setIsVideoOff(true);
          return audioStream;
        } catch (audioErr: any) {
          addToast(userMsg, 'error');
          throw audioErr;
        }
      } else {
        addToast(userMsg, 'error');
        throw err;
      }
    }
  };

  // Drain pending ICE candidates once remoteDescription is safely set
  const drainPendingIce = async (peerCtx: PeerContext) => {
    if (peerCtx.pendingIceCandidates.length > 0 && peerCtx.pc.remoteDescription) {
      callLog('DRAINING PENDING ICE', {
        count: peerCtx.pendingIceCandidates.length,
        remoteUserId: peerCtx.remoteUserId
      });
      const candidates = [...peerCtx.pendingIceCandidates];
      peerCtx.pendingIceCandidates = [];
      for (const cand of candidates) {
        try {
          await peerCtx.pc.addIceCandidate(new RTCIceCandidate(cand));
          callLog('ICE CANDIDATE ADDED FROM QUEUE', { remoteUserId: peerCtx.remoteUserId });
        } catch (err) {
          console.warn('[CallContext] Error adding queued ICE candidate:', err);
        }
      }
    }
  };

  // Create or retrieve PeerContext for a specific remote participant
  const getOrCreatePeerContext = useCallback((remoteUserId: string, targetRoomId: string): PeerContext => {
    if (peerContextsRef.current.has(remoteUserId)) {
      return peerContextsRef.current.get(remoteUserId)!;
    }

    callLog('PEER CREATED', { remoteUserId, targetRoomId });
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const remoteStream = new MediaStream();

    const peerCtx: PeerContext = {
      pc,
      remoteStream,
      pendingIceCandidates: [],
      hasRemoteDescription: false,
      remoteUserId
    };

    peerContextsRef.current.set(remoteUserId, peerCtx);

    // Add local media tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
        callLog('TRACK ADDED', { kind: track.kind, id: track.id, remoteUserId });
      });
    }

    // Remote tracks handler - accumulate tracks into persistent MediaStream
    pc.ontrack = (event) => {
      callLog('REMOTE TRACK', {
        kind: event.track.kind,
        id: event.track.id,
        remoteUserId,
        streamsCount: event.streams.length
      });

      if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      callLog('REMOTE STREAM', {
        remoteUserId,
        tracks: remoteStream.getTracks().map(t => ({ kind: t.kind, id: t.id, enabled: t.enabled }))
      });

      attachAudioAnalyser(remoteUserId, remoteStream);

      setPeersMap(prev => {
        const existing = prev.get(remoteUserId) || {
          userId: remoteUserId,
          userName: 'Colaborador',
          isAudioMuted: false,
          isVideoOff: false,
          isSpeaking: false
        };
        const updated = new Map(prev);
        updated.set(remoteUserId, {
          ...existing,
          stream: remoteStream,
          connectionState: pc.connectionState
        });
        return updated;
      });
    };

    // ICE candidates generation
    pc.onicecandidate = (event) => {
      if (event.candidate && roomIdRef.current) {
        callLog('ICE SENT', {
          remoteUserId,
          candidate: event.candidate.candidate.substring(0, 35) + '...',
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });

        api.sendSignal(remoteUserId, roomIdRef.current, 'webrtc-ice', event.candidate.toJSON ? event.candidate.toJSON() : {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment
        });
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      callLog('CONNECTION STATE', { remoteUserId, state: pc.connectionState });
      setPeersMap(prev => {
        const peer = prev.get(remoteUserId);
        if (!peer) return prev;
        const updated = new Map(prev);
        updated.set(remoteUserId, {
          ...peer,
          connectionState: pc.connectionState
        });
        return updated;
      });

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        callLog('PEER DISCONNECTED OR FAILED', { remoteUserId, state: pc.connectionState });
      }
    };

    pc.oniceconnectionstatechange = () => {
      callLog('ICE CONNECTION STATE', { remoteUserId, state: pc.iceConnectionState });
    };

    pc.onsignalingstatechange = () => {
      callLog('SIGNALING STATE', { remoteUserId, state: pc.signalingState });
    };

    return peerCtx;
  }, []);

  // Initiate SDP Offer to a remote peer (Caller flow)
  const initiateOffer = async (targetUserId: string, targetRoomId: string) => {
    try {
      const peerCtx = getOrCreatePeerContext(targetUserId, targetRoomId);
      callLog('OFFER CREATED START', { targetUserId });

      const offer = await peerCtx.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      callLog('OFFER CREATED', { targetUserId, type: offer.type });

      await peerCtx.pc.setLocalDescription(offer);
      callLog('LOCAL DESCRIPTION SET', { type: 'offer', targetUserId });

      api.sendSignal(targetUserId, targetRoomId, 'webrtc-offer', offer);
      callLog('OFFER SENT', { targetUserId, roomId: targetRoomId });
    } catch (err) {
      console.error('[CallContext] Error creating/sending offer:', err);
    }
  };

  // Central WebRTC Signal Handler
  useEffect(() => {
    if (!currentUser?.id) return;

    const handleSignal = async (payload: any) => {
      if (payload.senderId === currentUser.id) return; // Ignore own echoes
      const activeRoom = roomIdRef.current;
      if (!activeRoom || payload.roomId !== activeRoom) return;

      const senderId = payload.senderId;

      try {
        switch (payload.signalType) {
          case 'peer-joined': {
            callLog('PEER JOINED EVENT', { senderId, senderName: payload.senderName });
            setPeersMap(prev => {
              const updated = new Map(prev);
              if (!updated.has(senderId)) {
                updated.set(senderId, {
                  userId: senderId,
                  userName: payload.senderName || payload.data?.userName || 'Colaborador',
                  userAvatar: payload.senderAvatar || payload.data?.userAvatar,
                  isAudioMuted: false,
                  isVideoOff: false,
                  isSpeaking: false
                });
              }
              return updated;
            });

            // If local stream is ready and peer context doesn't exist yet, initiate offer to newcomer
            if (localStreamRef.current && !peerContextsRef.current.has(senderId)) {
              await initiateOffer(senderId, activeRoom);
            }
            break;
          }

          case 'webrtc-offer': {
            callLog('OFFER RECEIVED', { fromUserId: senderId });

            // Ensure peer appears in UI
            setPeersMap(prev => {
              const existing = prev.get(senderId);
              const updated = new Map(prev);
              updated.set(senderId, {
                userId: senderId,
                userName: payload.senderName || existing?.userName || 'Colaborador',
                userAvatar: payload.senderAvatar || existing?.userAvatar,
                stream: existing?.stream,
                isAudioMuted: existing?.isAudioMuted || false,
                isVideoOff: existing?.isVideoOff || false,
                isSpeaking: false
              });
              return updated;
            });

            // If local media not ready yet, acquire it
            if (!localStreamRef.current) {
              try {
                const stream = await acquireLocalMedia(callType);
                localStreamRef.current = stream;
                setLocalStream(stream);
              } catch (err) {
                console.error('[CallContext] Failed to acquire media on offer received:', err);
                return;
              }
            }

            const peerCtx = getOrCreatePeerContext(senderId, activeRoom);

            // Set Remote Description (Offer)
            await peerCtx.pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            peerCtx.hasRemoteDescription = true;
            callLog('REMOTE DESCRIPTION SET', { type: 'offer', fromUserId: senderId });

            // Drain queued ICE candidates
            await drainPendingIce(peerCtx);

            // Create and send Answer
            const answer = await peerCtx.pc.createAnswer();
            callLog('ANSWER CREATED', { targetUserId: senderId });

            await peerCtx.pc.setLocalDescription(answer);
            callLog('LOCAL DESCRIPTION SET', { type: 'answer', targetUserId: senderId });

            api.sendSignal(senderId, activeRoom, 'webrtc-answer', answer);
            callLog('ANSWER SENT', { targetUserId: senderId });
            break;
          }

          case 'webrtc-answer': {
            callLog('ANSWER RECEIVED', { fromUserId: senderId });
            const peerCtx = peerContextsRef.current.get(senderId);
            if (peerCtx) {
              await peerCtx.pc.setRemoteDescription(new RTCSessionDescription(payload.data));
              peerCtx.hasRemoteDescription = true;
              callLog('REMOTE DESCRIPTION SET', { type: 'answer', fromUserId: senderId });

              // Drain queued ICE candidates
              await drainPendingIce(peerCtx);
            }
            break;
          }

          case 'webrtc-ice': {
            callLog('ICE RECEIVED', { fromUserId: senderId });
            const peerCtx = peerContextsRef.current.get(senderId);
            if (peerCtx) {
              const candidateInit = payload.data;
              if (peerCtx.hasRemoteDescription && peerCtx.pc.remoteDescription) {
                try {
                  await peerCtx.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
                  callLog('ICE CANDIDATE ADDED', { fromUserId: senderId });
                } catch (err) {
                  console.warn('[CallContext] Error adding immediate ICE candidate:', err);
                }
              } else {
                peerCtx.pendingIceCandidates.push(candidateInit);
                callLog('ICE CANDIDATE QUEUED', { fromUserId: senderId, queueLength: peerCtx.pendingIceCandidates.length });
              }
            }
            break;
          }

          case 'media-state': {
            setPeersMap(prev => {
              const peer = prev.get(senderId);
              if (!peer) return prev;
              const updated = new Map(prev);
              updated.set(senderId, {
                ...peer,
                isAudioMuted: payload.data?.isAudioMuted ?? peer.isAudioMuted,
                isVideoOff: payload.data?.isVideoOff ?? peer.isVideoOff
              });
              return updated;
            });
            break;
          }

          case 'chat-message': {
            if (payload.data) {
              setChatMessages(prev => [...prev, payload.data]);
            }
            break;
          }

          case 'peer-left': {
            const peerCtx = peerContextsRef.current.get(senderId);
            if (peerCtx) {
              peerCtx.pc.close();
              peerContextsRef.current.delete(senderId);
            }
            analyserNodesRef.current.delete(senderId);
            setPeersMap(prev => {
              const updated = new Map(prev);
              updated.delete(senderId);
              return updated;
            });
            addToast(`${payload.senderName || 'Un participante'} salió de la llamada`, 'info');
            break;
          }

          case 'call-ended': {
            callLog('CALL ENDED SIGNAL RECEIVED');
            addToast('La llamada ha finalizado', 'info');
            cleanupCallState();
            break;
          }
        }
      } catch (err) {
        console.error('[CallContext] Signaling error:', err);
      }
    };

    signalR.on('WebRTCSignal', handleSignal);

    return () => {
      signalR.off('WebRTCSignal', handleSignal);
    };
  }, [currentUser?.id, getOrCreatePeerContext, addToast, callType]);

  // Clean up all local media, peer connections, timers, and audio contexts
  const cleanupCallState = useCallback(() => {
    callLog('CLEANUP CALL STATE');
    sound.stopAllRings();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (speakerIntervalRef.current) {
      clearInterval(speakerIntervalRef.current);
      speakerIntervalRef.current = null;
    }

    // Stop local camera/mic tracks cleanly
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        t.stop();
        callLog('LOCAL TRACK STOPPED', { kind: t.kind, id: t.id });
      });
      setLocalStream(null);
      localStreamRef.current = null;
    }

    // Stop screen share tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      screenStreamRef.current = null;
    }

    // Close all peer connections
    peerContextsRef.current.forEach((peerCtx, id) => {
      try {
        peerCtx.pc.close();
        callLog('PEER CLOSED', { peerId: id });
      } catch {}
    });
    peerContextsRef.current.clear();

    // Clear analysers
    analyserNodesRef.current.clear();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Leave SignalR meeting group
    if (roomIdRef.current && currentUser?.id) {
      signalR.leaveGroup(`meeting:${roomIdRef.current}`, currentUser.id);
    }

    setRoomId(null);
    setCallState('idle');
    setPeersMap(new Map());
    setChatMessages([]);
    setDuration(0);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setShowInCallChat(false);
    setShowAddParticipant(false);
    setActiveSpeakerId(null);
  }, [currentUser?.id]);

  // Join or Start Call Method
  const joinCall = async ({
    roomId: targetRoomId,
    title,
    callType: initialCallType,
    conversationId,
    channelId,
    targetUserId,
    isInitiator
  }: StartCallParams) => {
    callLog('CALL START', {
      roomId: targetRoomId,
      title,
      callType: initialCallType,
      targetUserId,
      isInitiator
    });

    sound.stopAllRings();

    // If already in a call, cleanup first
    if (callStateRef.current !== 'idle') {
      cleanupCallState();
    }

    setRoomId(targetRoomId);
    setCallTitle(title);
    setCallType(initialCallType);
    setParentConversationId(conversationId || null);
    setParentChannelId(channelId || null);
    setCallState('connected');
    setWindowMode('normal');

    // 1. Acquire Local Media
    let stream: MediaStream | null = null;
    try {
      stream = await acquireLocalMedia(initialCallType);
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoOff(initialCallType === 'audio');
      attachAudioAnalyser('local', stream);
    } catch (err) {
      console.error('[CallContext] Could not acquire local media for call:', err);
      // Clean up and abort call
      cleanupCallState();
      return;
    }

    // 2. Join SignalR Meeting Group
    if (currentUser?.id) {
      signalR.joinGroup(`meeting:${targetRoomId}`, currentUser.id);

      // Announce arrival to room
      api.sendSignal(undefined, targetRoomId, 'peer-joined', {
        userId: currentUser.id,
        userName: currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`,
        userAvatar: currentUser.avatarUrl
      });
    }

    // 3. If Initiator (Caller) in 1:1 call, initiate offer to target user
    if (isInitiator && targetUserId) {
      // Add target user to initial peers map in connecting state
      setPeersMap(prev => {
        const updated = new Map(prev);
        updated.set(targetUserId, {
          userId: targetUserId,
          userName: title.replace('Llamada con ', ''),
          isAudioMuted: false,
          isVideoOff: false,
          isSpeaking: false,
          connectionState: 'connecting'
        });
        return updated;
      });

      await initiateOffer(targetUserId, targetRoomId);
    }

    // 4. Start Timer
    setDuration(0);
    timerIntervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  };

  // Listen for global join-call events dispatched from modals or AppContext
  useEffect(() => {
    const handleJoinEvent = (e: Event) => {
      const customEvt = e as CustomEvent<StartCallParams>;
      if (customEvt.detail) {
        joinCall(customEvt.detail);
      }
    };

    window.addEventListener('collabpulse:join-call', handleJoinEvent);
    return () => {
      window.removeEventListener('collabpulse:join-call', handleJoinEvent);
    };
  }, []);

  // Explicit End Call
  const endCall = async () => {
    callLog('END CALL REQUESTED');
    sound.stopAllRings();
    sound.playHangupTone();

    const activeRoom = roomIdRef.current;
    if (activeRoom) {
      try {
        await api.endCall({ roomId: activeRoom });
        await api.leaveMeeting(activeRoom);
      } catch (e) {
        console.error('[CallContext] Error ending call on server:', e);
      }
      api.sendSignal(undefined, activeRoom, 'call-ended', {
        userId: currentUser?.id,
        senderName: currentUser?.displayName || currentUser?.firstName
      });
    }

    cleanupCallState();
  };

  // Toggle Audio Mute
  const toggleMic = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !next;
        callLog('MIC TOGGLE', { trackId: t.id, enabled: t.enabled });
      });
    }
    if (roomIdRef.current) {
      api.sendSignal(undefined, roomIdRef.current, 'media-state', { isAudioMuted: next });
    }
  };

  // Toggle Video Camera
  const toggleVideo = async () => {
    const next = !isVideoOff;
    setIsVideoOff(next);

    if (localStreamRef.current) {
      const vTracks = localStreamRef.current.getVideoTracks();
      if (vTracks.length === 0 && !next) {
        try {
          callLog('ACQUIRING NEW VIDEO TRACK ON TOGGLE');
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = vStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          // Add to all active peer connections
          peerContextsRef.current.forEach(async (peerCtx, peerId) => {
            peerCtx.pc.addTrack(newTrack, localStreamRef.current!);
            callLog('TRACK ADDED ON VIDEO TOGGLE', { peerId });
            if (roomIdRef.current) {
              const offer = await peerCtx.pc.createOffer();
              await peerCtx.pc.setLocalDescription(offer);
              api.sendSignal(peerId, roomIdRef.current, 'webrtc-offer', offer);
            }
          });
        } catch (e: any) {
          console.warn('[CallContext] Error acquiring camera video track:', e);
          addToast('No se pudo acceder a la cámara', 'error');
          setIsVideoOff(true);
          return;
        }
      } else {
        vTracks.forEach(t => {
          t.enabled = !next;
          callLog('CAMERA TOGGLE', { trackId: t.id, enabled: t.enabled });
        });
      }
    }

    if (roomIdRef.current) {
      api.sendSignal(undefined, roomIdRef.current, 'media-state', { isVideoOff: next });
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const scrStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setScreenStream(scrStream);
          screenStreamRef.current = scrStream;
          setIsScreenSharing(true);

          const screenTrack = scrStream.getVideoTracks()[0];

          // Replace track in all peer connections
          peerContextsRef.current.forEach(peerCtx => {
            const sender = peerCtx.pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(screenTrack);
            }
          });

          screenTrack.onended = () => {
            stopScreenShare();
          };
        }
      } catch (err) {
        console.warn('[CallContext] Screen share cancelled or not allowed:', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    setIsScreenSharing(false);
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      screenStreamRef.current = null;
    }

    // Revert to camera track
    if (localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0] || null;
      peerContextsRef.current.forEach(peerCtx => {
        const sender = peerCtx.pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
        }
      });
    }
  };

  // Send In-Call Message with PostgreSQL DB persistence
  const sendInCallMessage = async (text: string) => {
    if (!text.trim() || !currentUser) return;

    const messagePayload: InCallChatMessage = {
      id: `call-msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.displayName || `${currentUser.firstName} ${currentUser.lastName}`,
      senderAvatar: currentUser.avatarUrl,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Update local state and broadcast WebRTC signal
    setChatMessages(prev => [...prev, messagePayload]);
    if (roomIdRef.current) {
      api.sendSignal(undefined, roomIdRef.current, 'chat-message', messagePayload);
    }

    // Persist to PostgreSQL if tied to a parent conversation or channel
    try {
      if (parentConversationId) {
        await api.sendMessage({
          conversationId: parentConversationId,
          content: text.trim()
        });
      } else if (parentChannelId) {
        await api.sendMessage({
          channelId: parentChannelId,
          content: text.trim()
        });
      }
    } catch (err) {
      console.warn('[CallContext] Message DB persistence note:', err);
    }
  };

  // Escalate 1:1 call to group call without leaking private 1:1 history
  const escalateToGroup = async (newUserId: string) => {
    if (!currentUser || !roomIdRef.current) return;

    try {
      const otherPeers = Array.from(peersMapRef.current.keys());

      if (parentConversationId && otherPeers.length === 1) {
        const existingPeerId = otherPeers[0];
        // Create an isolated group conversation so new user cannot see old 1:1 history
        const newGroupRes = await api.createConversation({
          memberIds: [currentUser.id, existingPeerId, newUserId],
          isGroup: true,
          name: `Llamada grupal (${callTitle})`
        });

        if (newGroupRes.success && newGroupRes.data) {
          setParentConversationId(newGroupRes.data.id);
        }
      }

      // Send call invitation to new participant
      await api.inviteCall({
        targetUserId: newUserId,
        roomId: roomIdRef.current,
        isVideo: !isVideoOff,
        title: callTitle
      });

      addToast('Invitación enviada al nuevo participante', 'success');
      setShowAddParticipant(false);
    } catch (err: any) {
      addToast('Error al invitar: ' + (err.message || 'Error'), 'error');
    }
  };

  const peersArray = React.useMemo(() => Array.from(peersMap.values()), [peersMap]);

  return (
    <CallContext.Provider
      value={{
        callState,
        windowMode,
        roomId,
        callTitle,
        callType,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        duration,
        formattedDuration,
        parentConversationId,
        parentChannelId,
        localStream,
        screenStream,
        peers: peersArray,
        activeSpeakerId,
        chatMessages,
        showInCallChat,
        showAddParticipant,

        joinCall,
        endCall,
        toggleMic,
        toggleVideo,
        toggleScreenShare,
        setWindowMode,
        setShowInCallChat,
        setShowAddParticipant,
        sendInCallMessage,
        escalateToGroup
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
