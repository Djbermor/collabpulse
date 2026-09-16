import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { sound } from '../services/sound';
import { callLog, callWarn, callError } from '../services/callDebug';
import { desktopNotifications } from '../services/desktopNotifications';
import { localMediaController } from '../services/call/LocalMediaController';
import { signalingClient, SignalingMessage } from '../services/call/SignalingClient';
import { peerConnectionManager } from '../services/call/PeerConnectionManager';
import { CallSession, CallState, CallMediaType, CallDirection, CallOrigin } from '../types';

export interface PeerState {
  userId: string;
  userName: string;
  userAvatar?: string;
  stream?: MediaStream;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isSpeaking: boolean;
  connectionState?: RTCPeerConnectionState | 'reconnecting';
}

export interface InCallChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  time: string;
}

export type WindowMode = 'normal' | 'minimized' | 'fullscreen';

export interface StartCallParams {
  roomId?: string;
  title: string;
  callType: 'video' | 'audio';
  conversationId?: string;
  channelId?: string;
  targetUserId?: string;
  targetName?: string;
  targetAvatar?: string;
  isInitiator?: boolean;
}

interface CallManagerContextType {
  // Call Engine Core State
  sessions: Map<string, CallSession>;
  activeSession: CallSession | null;
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

  // Media Streams & Peers
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  peers: PeerState[];
  activeSpeakerId: string | null;

  // Modals & In-Call Utilities
  incomingCall: CallSession | any | null;
  outgoingCall: CallSession | any | null;
  chatMessages: InCallChatMessage[];
  showInCallChat: boolean;
  showAddParticipant: boolean;

  // Core Actions
  startCall: (params: StartCallParams) => Promise<void>;
  joinCall: (params: StartCallParams) => Promise<void>;
  acceptCall: (callId?: string) => Promise<void>;
  rejectCall: (callId?: string, reason?: string) => Promise<void>;
  cancelOutgoingCall: () => Promise<void>;
  endCall: (reason?: string) => Promise<void>;

  // Controls
  toggleMic: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setWindowMode: (mode: WindowMode) => void;
  setShowInCallChat: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowAddParticipant: (show: boolean | ((prev: boolean) => boolean)) => void;
  sendInCallMessage: (text: string) => Promise<void>;
  escalateToGroup: (newUserId: string) => Promise<void>;
}

const CallContext = createContext<CallManagerContextType | null>(null);

// Deterministic State Machine Transition Rules
const VALID_STATE_TRANSITIONS: Record<CallState, CallState[]> = {
  idle: ['initiating', 'ringing_incoming'],
  initiating: ['ringing_outgoing', 'connecting', 'ended', 'failed'],
  ringing_outgoing: ['connecting', 'ended', 'failed'],
  ringing_incoming: ['connecting', 'ended', 'failed'],
  connecting: ['active', 'reconnecting', 'ended', 'failed'],
  active: ['reconnecting', 'held', 'ended', 'failed'],
  held: ['active', 'ended', 'failed'],
  reconnecting: ['active', 'failed', 'ended'],
  ended: ['idle'],
  failed: ['idle']
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Call Engine Core States
  const [sessions, setSessions] = useState<Map<string, CallSession>>(new Map());
  const [activeSession, setActiveSession] = useState<CallSession | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [incomingCall, setIncomingCall] = useState<CallSession | any | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<CallSession | any | null>(null);

  // Presentation States
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

  // Streams & Peers
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peersMap, setPeersMap] = useState<Map<string, PeerState>>(new Map());
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // Chat & Participants in call
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([]);
  const [showInCallChat, setShowInCallChat] = useState<boolean>(false);
  const [showAddParticipant, setShowAddParticipant] = useState<boolean>(false);

  // Mutable refs to prevent stale closures
  const sessionsRef = useRef<Map<string, CallSession>>(new Map());
  sessionsRef.current = sessions;
  const activeSessionRef = useRef<CallSession | null>(null);
  activeSessionRef.current = activeSession;
  const callStateRef = useRef<CallState>('idle');
  callStateRef.current = callState;
  const incomingCallRef = useRef<any | null>(null);
  incomingCallRef.current = incomingCall;
  const outgoingCallRef = useRef<any | null>(null);
  outgoingCallRef.current = outgoingCall;
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const peersMapRef = useRef<Map<string, PeerState>>(new Map());
  peersMapRef.current = peersMap;
  const timerIntervalRef = useRef<any>(null);

  // Formatted duration MM:SS or HH:MM:SS
  const formattedDuration = useMemo(() => {
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = duration % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  /**
   * Deterministic State Transition Validator
   */
  const transitionCallState = useCallback((targetState: CallState): boolean => {
    const currentState = callStateRef.current;
    if (currentState === targetState) return true;

    const allowed = VALID_STATE_TRANSITIONS[currentState] || [];
    if (!allowed.includes(targetState)) {
      callWarn(`CallManager: Illegal state transition attempted: [${currentState}] -> [${targetState}]. Allowed:`, allowed);
      return false;
    }

    callLog(`CallManager: Transition state [${currentState}] -> [${targetState}]`);
    setCallState(targetState);

    // Update activeSession state
    if (activeSessionRef.current) {
      const updated = { ...activeSessionRef.current, state: targetState };
      setActiveSession(updated);
      setSessions(prev => {
        const next = new Map(prev);
        next.set(updated.id, updated);
        return next;
      });
    }

    return true;
  }, []);

  /**
   * Initialize PeerConnectionManager callbacks
   */
  useEffect(() => {
    peerConnectionManager.setCallbacks(
      (remoteUserId: string, remoteStream: MediaStream) => {
        callLog(`CallManager: Remote stream extracted for peer ${remoteUserId}`, {
          audioTracks: remoteStream.getAudioTracks().length,
          videoTracks: remoteStream.getVideoTracks().length
        });

        setPeersMap((prev: Map<string, PeerState>) => {
          const next = new Map<string, PeerState>(prev);
          const existing = next.get(remoteUserId);
          next.set(remoteUserId, {
            userId: remoteUserId,
            userName: existing ? existing.userName : 'Colaborador',
            userAvatar: existing ? existing.userAvatar : undefined,
            stream: remoteStream,
            isAudioMuted: false,
            isVideoOff: remoteStream.getVideoTracks().length === 0,
            isSpeaking: false,
            connectionState: 'connected'
          });
          return next;
        });
      },
      (remoteUserId: string, state: RTCPeerConnectionState | 'reconnecting') => {
        callLog(`CallManager: Peer ${remoteUserId} connection state -> ${state}`);

        if (state === 'connected') {
          transitionCallState('active');
        } else if (state === 'reconnecting') {
          transitionCallState('reconnecting');
        } else if (state === 'failed') {
          callWarn(`CallManager: Peer connection failed for ${remoteUserId}`);
        }

        setPeersMap((prev: Map<string, PeerState>) => {
          const next = new Map<string, PeerState>(prev);
          const existing = next.get(remoteUserId);
          if (existing) {
            next.set(remoteUserId, {
              ...existing,
              connectionState: state as RTCPeerConnectionState
            });
          }
          return next;
        });
      }
    );
  }, [transitionCallState]);

  /**
   * Cleanup timer when active call ends
   */
  useEffect(() => {
    if (callState === 'active') {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setDuration(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (callState === 'idle') {
        setDuration(0);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [callState]);

  /**
   * Centralized Signaling Subscriptions
   */
  useEffect(() => {
    // 1. Incoming Call Invitation
    const unsubIncoming = signalingClient.onIncomingCall((callData: any) => {
      callLog('CallManager: Incoming call received', callData);

      // Don't ring if already in active call (can support busy or queue)
      if (callStateRef.current === 'active' || callStateRef.current === 'connecting') {
        callWarn('CallManager: Busy! Already in an active call. Declining secondary incoming call.');
        signalingClient.respondCall(callData.caller?.id, callData.callId, false, 'busy', callData.roomId).catch(() => {});
        return;
      }

      setIncomingCall(callData);
      transitionCallState('ringing_incoming');
      sound.playIncomingRing();

      desktopNotifications.showNotification(`Llamada entrante de ${callData.caller?.displayName || 'Colaborador'}`, {
        body: callData.isVideo ? 'Videollamada entrante' : 'Llamada de voz entrante',
        requireInteraction: true,
        onClick: () => window.focus()
      });
    });

    // 2. Multi-Tab Call Claimed Broadcast
    const unsubClaimed = signalingClient.onCallClaimed(({ callId, claimedByTabId }) => {
      callLog('CallManager: Call claimed broadcast received', { callId, claimedByTabId });
      if (claimedByTabId !== signalingClient.getTabId()) {
        // Another tab claimed the call! Stop ringing and dismiss modal
        sound.stopAllRings();
        if (incomingCallRef.current?.callId === callId) {
          setIncomingCall(null);
          transitionCallState('idle');
          callLog('CallManager: Dismissed incoming call modal because call was claimed by another tab.');
        }
      }
    });

    // 3. Call Response (Caller receives Callee's answer)
    const unsubResponse = signalingClient.onCallResponse(async (respData: any) => {
      callLog('CallManager: Received call response', respData);
      sound.stopAllRings();

      const out = outgoingCallRef.current;
      setOutgoingCall(null);

      if (!respData.accepted) {
        sound.playHangupTone();
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 1500);
        return;
      }

      // Callee accepted! Proceed to WebRTC negotiation
      transitionCallState('connecting');

      const targetUserId = respData.callee?.id || out?.targetUserId;
      const targetRoomId = respData.roomId || out?.roomId;
      const callId = respData.callId || out?.callId;

      if (!targetUserId || !targetRoomId) {
        callError('CallManager: Missing targetUserId or roomId in CallResponse');
        return;
      }

      try {
        // Acquire local stream if not already active
        const stream = await localMediaController.getLocalMedia({
          video: out?.callType === 'video',
          audio: true
        });
        setLocalStream(stream);

        // Caller creates and signals SDP offer to Callee
        await peerConnectionManager.createAndSendOffer(targetUserId, callId, targetRoomId, stream);
      } catch (err: any) {
        callError('CallManager: Failed to initiate WebRTC offer after accept', err);
        transitionCallState('failed');
      }
    });

    // 4. Call Cancelled
    const unsubCancelled = signalingClient.onCallCancelled(({ callId, roomId }) => {
      sound.stopAllRings();
      const currentIn = incomingCallRef.current;
      if (currentIn && (!callId || currentIn.callId === callId || currentIn.roomId === roomId)) {
        setIncomingCall(null);
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 1000);
      }
    });

    // 5. Call Timeout
    const unsubTimeout = signalingClient.onCallTimeout(({ callId }) => {
      sound.stopAllRings();
      if (outgoingCallRef.current?.callId === callId) {
        setOutgoingCall(null);
        sound.playHangupTone();
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 1500);
      }
      if (incomingCallRef.current?.callId === callId) {
        setIncomingCall(null);
        transitionCallState('idle');
      }
    });

    // 6. Call Ended
    const unsubEnded = signalingClient.onCallEnded(({ callId, roomId, endedBy }) => {
      callLog('CallManager: Remote peer ended the call', { callId, roomId, endedBy });
      sound.stopAllRings();
      sound.playHangupTone();

      // Clean resources
      peerConnectionManager.closeAll();
      localMediaController.releaseLocalMedia();
      setLocalStream(null);
      setPeersMap(new Map());
      setActiveSession(null);
      setIncomingCall(null);
      setOutgoingCall(null);
      transitionCallState('ended');
      setTimeout(() => transitionCallState('idle'), 1200);
    });

    // 7. WebRTC Signaling (Offers, Answers, ICE candidates, ICE restart)
    const unsubSignal = signalingClient.onSignal(async (signal: SignalingMessage) => {
      const senderId = signal.senderId;
      const act = activeSessionRef.current;
      const callId = signal.callId || act?.id || '';
      const targetRoomId = signal.roomId || act?.roomId || '';

      switch (signal.signalType) {
        case 'offer': {
          callLog(`CallManager: Handling remote SDP offer from ${senderId}`);
          try {
            const stream = localStreamRef.current || await localMediaController.getLocalMedia({
              video: act?.mediaType !== 'audio',
              audio: true
            });
            setLocalStream(stream);

            await peerConnectionManager.handleRemoteOffer(
              senderId,
              callId,
              targetRoomId,
              signal.data,
              stream
            );
          } catch (err: any) {
            callError('CallManager: Error handling remote offer', err);
          }
          break;
        }

        case 'answer': {
          callLog(`CallManager: Handling remote SDP answer from ${senderId}`);
          try {
            await peerConnectionManager.handleRemoteAnswer(senderId, signal.data);
          } catch (err: any) {
            callError('CallManager: Error handling remote answer', err);
          }
          break;
        }

        case 'ice-candidate': {
          try {
            await peerConnectionManager.handleRemoteIceCandidate(senderId, signal.data);
          } catch (err: any) {
            callError('CallManager: Error handling ICE candidate', err);
          }
          break;
        }

        case 'ice-restart': {
          callLog(`CallManager: Handling ICE restart request from ${senderId}`);
          try {
            await peerConnectionManager.restartIce(senderId, callId, targetRoomId);
          } catch (err: any) {
            callError('CallManager: Error executing ICE restart', err);
          }
          break;
        }

        case 'call-ended': {
          callLog('CallManager: Received call-ended signal');
          peerConnectionManager.closeAll();
          localMediaController.releaseLocalMedia();
          setLocalStream(null);
          setPeersMap(new Map());
          setActiveSession(null);
          transitionCallState('ended');
          setTimeout(() => transitionCallState('idle'), 1000);
          break;
        }
      }
    });

    return () => {
      unsubIncoming();
      unsubClaimed();
      unsubResponse();
      unsubCancelled();
      unsubTimeout();
      unsubEnded();
      unsubSignal();
    };
  }, [transitionCallState]);

  /**
   * Start an outgoing 1:1 call
   */
  const startCall = useCallback(async (params: StartCallParams) => {
    callLog('CallManager: startCall initiated', params);

    sound.playOutgoingRing();
    transitionCallState('initiating');

    const mediaType: CallMediaType = params.callType === 'audio' ? 'audio' : 'video';

    // Optimistically create outgoing call UI state
    const outPayload = {
      targetUserId: params.targetUserId,
      targetName: params.targetName || params.title,
      targetAvatar: params.targetAvatar || '',
      isVideo: mediaType !== 'audio',
      callType: mediaType,
      conversationId: params.conversationId,
      channelId: params.channelId,
      roomId: params.roomId
    };
    setOutgoingCall(outPayload);
    setCallTitle(params.title);
    setCallType(params.callType);
    setParentConversationId(params.conversationId || null);
    setParentChannelId(params.channelId || null);

    try {
      // 1. Acquire local media stream
      const stream = await localMediaController.getLocalMedia({
        audio: true,
        video: mediaType !== 'audio'
      });
      setLocalStream(stream);

      // 2. Dispatch call invite through backend
      const res = await signalingClient.inviteCall({
        targetUserId: params.targetUserId,
        conversationId: params.conversationId,
        channelId: params.channelId,
        roomId: params.roomId,
        mediaType,
        title: params.title
      });

      if (res.success && res.data) {
        const session: CallSession = res.data.call;
        setRoomId(session.roomId);
        setActiveSession(session);
        setOutgoingCall({ ...outPayload, callId: session.id, roomId: session.roomId });
        transitionCallState('ringing_outgoing');

        // Request ephemeral session token
        signalingClient.fetchSessionToken(session.id, session.roomId).catch(() => {});
      } else {
        throw new Error(res.message || 'Error al iniciar llamada');
      }
    } catch (err: any) {
      callError('CallManager: startCall failed', err);
      sound.stopAllRings();
      setOutgoingCall(null);
      transitionCallState('failed');
      setTimeout(() => transitionCallState('idle'), 2000);
      throw err;
    }
  }, [transitionCallState]);

  /**
   * Join an ongoing room or session
   */
  const joinCall = useCallback(async (params: StartCallParams) => {
    callLog('CallManager: joinCall initiated', params);
    sound.stopAllRings();

    const targetRoomId = params.roomId || `room-${Date.now()}`;
    const mediaType: CallMediaType = params.callType === 'audio' ? 'audio' : 'video';

    setRoomId(targetRoomId);
    setCallTitle(params.title);
    setCallType(params.callType);
    setParentConversationId(params.conversationId || null);
    setParentChannelId(params.channelId || null);
    transitionCallState('connecting');

    try {
      const stream = await localMediaController.getLocalMedia({
        audio: true,
        video: mediaType !== 'audio'
      });
      setLocalStream(stream);

      const callId = `call-room-${targetRoomId}`;
      const session: CallSession = {
        id: callId,
        roomId: targetRoomId,
        tenantId: '',
        workspaceId: '',
        type: '1:1',
        mediaType,
        direction: params.isInitiator ? 'outbound' : 'inbound',
        origin: params.conversationId ? 'conversation' : params.channelId ? 'channel' : 'direct',
        state: 'connecting',
        callerId: '',
        participantIds: params.targetUserId ? [params.targetUserId] : [],
        createdAt: new Date().toISOString()
      };
      setActiveSession(session);

      if (params.targetUserId) {
        if (params.isInitiator) {
          await peerConnectionManager.createAndSendOffer(params.targetUserId, callId, targetRoomId, stream);
        }
      }
    } catch (err: any) {
      callError('CallManager: joinCall failed', err);
      transitionCallState('failed');
      setTimeout(() => transitionCallState('idle'), 2000);
    }
  }, [transitionCallState]);

  // Handle global custom events for backwards compatibility (e.g. from chat click)
  useEffect(() => {
    const handleJoinCallEvent = (e: any) => {
      if (e.detail) {
        joinCall(e.detail);
      }
    };
    const handleStartCallEvent = (e: any) => {
      if (e.detail) {
        startCall(e.detail);
      }
    };
    window.addEventListener('collabpulse:join-call', handleJoinCallEvent);
    window.addEventListener('collabpulse:start-call', handleStartCallEvent);
    return () => {
      window.removeEventListener('collabpulse:join-call', handleJoinCallEvent);
      window.removeEventListener('collabpulse:start-call', handleStartCallEvent);
    };
  }, [joinCall, startCall]);

  /**
   * Callee Accepts Incoming Call with Atomic Multi-Tab Claim
   */
  const acceptCall = useCallback(async (callId?: string) => {
    const callData = incomingCallRef.current;
    const targetCallId = callId || callData?.callId;

    if (!callData || !targetCallId) {
      callWarn('CallManager: No incoming call to accept');
      return;
    }

    sound.stopAllRings();

    // 1. Atomic backend claim: verify this tab is the first to accept
    try {
      const claimResult = await signalingClient.claimCall(targetCallId);
      if (!claimResult.claimed) {
        callWarn('CallManager: Call already claimed by another tab/device');
        setIncomingCall(null);
        transitionCallState('idle');
        return;
      }
    } catch (err: any) {
      callWarn('CallManager: Claim error:', err.message);
    }

    setIncomingCall(null);
    transitionCallState('connecting');

    const caller = callData.caller || {};
    const callerId = caller.id;
    const callerRoomId = callData.roomId;
    const isVideo = !!callData.isVideo;

    setRoomId(callerRoomId);
    setCallTitle(`Llamada con ${caller.displayName || 'Colaborador'}`);
    setCallType(isVideo ? 'video' : 'audio');
    setParentConversationId(callData.conversationId || null);
    setParentChannelId(callData.channelId || null);

    try {
      // 2. Acquire local media stream
      const stream = await localMediaController.getLocalMedia({
        audio: true,
        video: isVideo
      });
      setLocalStream(stream);

      const session: CallSession = {
        id: targetCallId,
        roomId: callerRoomId,
        tenantId: '',
        workspaceId: '',
        type: '1:1',
        mediaType: isVideo ? 'video' : 'audio',
        direction: 'inbound',
        origin: 'direct',
        state: 'connecting',
        callerId,
        participantIds: [callerId],
        createdAt: new Date().toISOString()
      };
      setActiveSession(session);

      // 3. Pre-create PeerConnection
      await peerConnectionManager.getOrCreatePeerConnection(callerId, targetCallId, callerRoomId, stream);

      // 4. Send positive CallResponse to caller
      await signalingClient.respondCall(callerId, targetCallId, true, undefined, callerRoomId);

      // Ephemeral token
      signalingClient.fetchSessionToken(targetCallId, callerRoomId).catch(() => {});
    } catch (err: any) {
      callError('CallManager: Failed to accept call', err);
      transitionCallState('failed');
      setTimeout(() => transitionCallState('idle'), 2000);
    }
  }, [transitionCallState]);

  /**
   * Callee Rejects Incoming Call
   */
  const rejectCall = useCallback(async (callId?: string, reason?: string) => {
    sound.stopAllRings();
    const callData = incomingCallRef.current;
    const targetCallId = callId || callData?.callId;

    if (callData && targetCallId) {
      setIncomingCall(null);
      transitionCallState('ended');
      try {
        await signalingClient.respondCall(callData.caller?.id, targetCallId, false, reason || 'declined', callData.roomId);
      } catch (err: any) {
        callWarn('CallManager: Error declining call:', err.message);
      }
      setTimeout(() => transitionCallState('idle'), 500);
    }
  }, [transitionCallState]);

  /**
   * Caller Cancels Outgoing Call before answer
   */
  const cancelOutgoingCall = useCallback(async () => {
    sound.stopAllRings();
    const out = outgoingCallRef.current;
    setOutgoingCall(null);
    transitionCallState('ended');

    if (out) {
      try {
        await signalingClient.cancelCall(out.callId, out.targetUserId, out.roomId);
      } catch (err: any) {
        callWarn('CallManager: Error cancelling call:', err.message);
      }
    }

    localMediaController.releaseLocalMedia();
    setLocalStream(null);
    setTimeout(() => transitionCallState('idle'), 500);
  }, [transitionCallState]);

  /**
   * Explicit Call Termination (Hang up button)
   * UI route changes and navigation DO NOT call this!
   */
  const endCall = useCallback(async (reason?: string) => {
    callLog('CallManager: Explicit endCall requested', { reason });
    sound.stopAllRings();
    sound.playHangupTone();

    const act = activeSessionRef.current;
    const currentRoomId = roomId;

    try {
      await signalingClient.endCall(act?.id, currentRoomId || undefined, act?.callerId, reason || 'completed');
    } catch (err: any) {
      callWarn('CallManager: End call error:', err.message);
    }

    // Full cleanup of hardware and WebRTC peer connections
    peerConnectionManager.closeAll();
    localMediaController.releaseLocalMedia();

    setLocalStream(null);
    setScreenStream(null);
    setPeersMap(new Map());
    setActiveSession(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setRoomId(null);
    setIsScreenSharing(false);
    transitionCallState('ended');
    setTimeout(() => transitionCallState('idle'), 1000);
  }, [roomId, transitionCallState]);

  /**
   * Microphone toggle
   */
  const toggleMic = useCallback(() => {
    if (isAudioMuted) {
      localMediaController.enableMicrophone();
      setIsAudioMuted(false);
    } else {
      localMediaController.disableMicrophone();
      setIsAudioMuted(true);
    }
  }, [isAudioMuted]);

  /**
   * Camera toggle
   */
  const toggleVideo = useCallback(async () => {
    try {
      if (isVideoOff) {
        await localMediaController.enableCamera();
        setIsVideoOff(false);
      } else {
        localMediaController.disableCamera();
        setIsVideoOff(true);
      }
    } catch (err) {
      callError('CallManager: Failed to toggle video', err);
    }
  }, [isVideoOff]);

  /**
   * Screen Share toggle
   */
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(stream);
        setIsScreenSharing(true);
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
      } catch (err: any) {
        callWarn('CallManager: Screen sharing cancelled or rejected', err.message);
      }
    }
  }, [isScreenSharing, screenStream]);

  const sendInCallMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const newMsg: InCallChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: 'current-user',
      senderName: 'Yo',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMsg]);
  }, []);

  const escalateToGroup = useCallback(async (newUserId: string) => {
    callLog('CallManager: escalateToGroup requested for user:', newUserId);
    if (roomId) {
      await signalingClient.inviteCall({
        targetUserId: newUserId,
        roomId,
        mediaType: callType === 'audio' ? 'audio' : 'video',
        title: callTitle
      });
    }
  }, [roomId, callType, callTitle]);

  const peers = useMemo(() => Array.from(peersMap.values()), [peersMap]);

  return (
    <CallContext.Provider
      value={{
        sessions,
        activeSession,
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
        peers,
        activeSpeakerId,
        incomingCall,
        outgoingCall,
        chatMessages,
        showInCallChat,
        showAddParticipant,
        startCall,
        joinCall,
        acceptCall,
        rejectCall,
        cancelOutgoingCall,
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
