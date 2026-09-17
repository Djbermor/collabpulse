import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { sound } from '../services/sound';
import { callLog, callWarn, callError } from '../services/callDebug';
import { desktopNotifications } from '../services/desktopNotifications';
import { localMediaController } from '../services/call/LocalMediaController';
import { signalingClient, SignalingMessage } from '../services/call/SignalingClient';
import { peerConnectionManager } from '../services/call/PeerConnectionManager';
import { sfuManager, SfuPeerState } from '../services/call/SfuManager';
import { signalR } from '../services/signalr';
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
  conversationId?: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string; // kept for backward compatibility with CallWindow
  content?: string; // from API
  messageType?: 'text' | 'file' | 'system' | 'image' | 'audio';
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  time: string;
  createdAt?: string;
  isSystem?: boolean;
}

export type WindowMode = 'normal' | 'minimized' | 'fullscreen';

export interface StartCallParams {
  roomId?: string;
  title: string;
  callType?: 'video' | 'audio';
  isVideo?: boolean;
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
  endCall: (callId?: string, reason?: string) => Promise<void>;

  // Multi-Call Management (Fase 3)
  heldSession: CallSession | null;
  heldSessions: CallSession[];
  isHeldLocally: boolean;
  isHeldRemotely: boolean;
  holdCall: (callId?: string) => Promise<void>;
  resumeCall: (callId: string) => Promise<void>;
  swapCalls: () => Promise<void>;

  // Group Call / SFU (Fase 4 & 5)
  groupSession: CallSession | null;
  sfuPeers: SfuPeerState[];
  isHost: boolean;
  startGroupCall: (params?: { title?: string; mediaType?: 'video' | 'audio' }) => Promise<string | undefined>;
  joinGroupCall: (groupCallId: string) => Promise<void>;
  leaveGroupCall: () => Promise<void>;
  endGroupCall: () => Promise<void>;
  pauseGroupCall: () => void;
  resumeGroupCall: () => void;

  // Controls
  toggleMic: () => void;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setWindowMode: (mode: WindowMode) => void;
  setShowInCallChat: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowAddParticipant: (show: boolean | ((prev: boolean) => boolean)) => void;
  sendInCallMessage: (text: string) => Promise<void>;
  escalateToGroup: (newUserId: string) => Promise<void>;
  // FASE 6: in-call chat conversation ID
  callConversationId: string | null;
}

const CallContext = createContext<CallManagerContextType | null>(null);

// Deterministic State Machine Transition Rules
const VALID_STATE_TRANSITIONS: Record<CallState, CallState[]> = {
  idle: ['initiating', 'ringing_incoming', 'connecting', 'active'],
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
  const [isHeldLocally, setIsHeldLocally] = useState<boolean>(false);
  const [isHeldRemotely, setIsHeldRemotely] = useState<boolean>(false);

  const heldSessions = useMemo(() => {
    return Array.from<CallSession>(sessions.values()).filter((s: CallSession) => s.state === 'held');
  }, [sessions]);

  const heldSession = useMemo(() => {
    return heldSessions[0] || null;
  }, [heldSessions]);

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

  // Group Call (Fase 4 & 5)
  const [sfuPeers, setSfuPeers] = useState<SfuPeerState[]>([]);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [pausedGroupSession, setPausedGroupSession] = useState<CallSession | null>(null);
  const pausedGroupSessionRef = useRef<CallSession | null>(null);
  pausedGroupSessionRef.current = pausedGroupSession;

  // Chat & Participants in call
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([]);
  const [showInCallChat, setShowInCallChat] = useState<boolean>(false);
  const [showAddParticipant, setShowAddParticipant] = useState<boolean>(false);
  // FASE 6: conversation linked to the current call for in-call chat persistence
  const [callConversationId, setCallConversationId] = useState<string | null>(null);
  const callConversationIdRef = useRef<string | null>(null);
  callConversationIdRef.current = callConversationId;

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
  const screenStreamRef = useRef<MediaStream | null>(null);
  screenStreamRef.current = screenStream;
  const peersMapRef = useRef<Map<string, PeerState>>(new Map());
  peersMapRef.current = peersMap;
  const timerIntervalRef = useRef<any>(null);
  const isTerminatingRef = useRef<boolean>(false);

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

      // Check system capacity (1 active + 1 held max for Phase 3)
      const currentActive = activeSessionRef.current && activeSessionRef.current.state === 'active' ? 1 : 0;
      const currentHeld = Array.from<CallSession>(sessionsRef.current.values()).filter((s: CallSession) => s.state === 'held').length;

      if (currentActive + currentHeld >= 2) {
        callWarn('CallManager: Busy! Maximum capacity reached (1 active + 1 held). Responding busy.');
        signalingClient.respondCall(callData.caller?.id, callData.callId, false, 'busy', callData.roomId).catch(() => {});
        return;
      }

      setIncomingCall(callData);

      // Only transition global state to ringing_incoming if no active call is present
      if (!activeSessionRef.current || activeSessionRef.current.state === 'idle') {
        transitionCallState('ringing_incoming');
      }

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

      if (callId) {
        setSessions(prev => {
          const next = new Map(prev);
          const s = next.get(callId) as CallSession | undefined;
          if (s) {
            next.set(callId, { ...s, state: 'connecting' });
          }
          return next;
        });
      }

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

      if (callId) {
        const session = sessionsRef.current.get(callId) || activeSessionRef.current;
        const peerUserId = session ? (session.direction === 'inbound' ? session.callerId : session.calleeId) : undefined;
        if (peerUserId) {
          peerConnectionManager.closePeer(peerUserId);
        }

        setSessions(prev => {
          const next = new Map(prev);
          next.delete(callId);
          return next;
        });

        // If it was the active call, check if there is a held call left!
        if (activeSessionRef.current?.id === callId) {
          const remainingHeld = Array.from<CallSession>(sessionsRef.current.values()).find((sess: CallSession) => sess.id !== callId && sess.state === 'held');
          if (remainingHeld) {
            callLog(`CallManager: Active call ended by peer, held call [${remainingHeld.id}] remains available`);
            setActiveSession(null);
            setCallState('held');
            setIsHeldLocally(false);
            setIsHeldRemotely(false);
            return;
          }
        }
      }

      // If no remaining sessions, teardown
      const remainingCount = Array.from<CallSession>(sessionsRef.current.values()).filter((sess: CallSession) => sess.id !== callId && sess.state !== 'ended').length;
      if (remainingCount === 0) {
        peerConnectionManager.closeAll();
        localMediaController.releaseLocalMedia();

        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => {
            try { t.stop(); } catch (e) {}
          });
          setScreenStream(null);
          setIsScreenSharing(false);
        }

        setLocalStream(null);
        setPeersMap(new Map());
        setActiveSession(null);
        setIncomingCall(null);
        setOutgoingCall(null);
        setIsHeldLocally(false);
        setIsHeldRemotely(false);
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 1200);
      }
    });

    // 7. Call Held
    const unsubHeld = signalingClient.onCallHeld(({ callId, heldBy }) => {
      callLog(`CallManager: Received CallHeld event for ${callId} by ${heldBy}`);
      setIsHeldRemotely(true);
      setSessions(prev => {
        const next = new Map(prev);
        const s = next.get(callId) as CallSession | undefined;
        if (s) next.set(callId, { ...s, state: 'held' });
        return next;
      });
    });

    // 8. Call Resumed
    const unsubResumed = signalingClient.onCallResumed(({ callId, resumedBy }) => {
      callLog(`CallManager: Received CallResumed event for ${callId} by ${resumedBy}`);
      setIsHeldRemotely(false);
      setSessions(prev => {
        const next = new Map(prev);
        const s = next.get(callId) as CallSession | undefined;
        if (s) next.set(callId, { ...s, state: 'active' });
        return next;
      });
    });

    // 9. WebRTC Signaling (Offers, Answers, ICE candidates, ICE restart, State sync)
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

        case 'call-held': {
          callLog(`CallManager: Received call-held signal from ${senderId}`);
          setIsHeldRemotely(true);
          break;
        }

        case 'call-resumed': {
          callLog(`CallManager: Received call-resumed signal from ${senderId}`);
          setIsHeldRemotely(false);
          break;
        }

        case 'call-ended': {
          callLog('CallManager: Received call-ended signal');
          peerConnectionManager.closeAll();
          localMediaController.releaseLocalMedia();

          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => {
              try { t.stop(); } catch (e) {}
            });
            setScreenStream(null);
            setIsScreenSharing(false);
          }

          setLocalStream(null);
          setPeersMap(new Map());
          setActiveSession(null);
          setIsHeldLocally(false);
          setIsHeldRemotely(false);
          transitionCallState('ended');
          setTimeout(() => transitionCallState('idle'), 1000);
          break;
        }
      }
    });

    const handleInCallMessage = (payload: any) => {
      if (!payload) return;
      const convId = callConversationIdRef.current;
      if (convId && payload.conversationId === convId) {
        setChatMessages(prev => {
          if (prev.some(m => m.id === payload.id || (m.id.startsWith('cmi-') && m.text === payload.content))) {
            return prev.map(m => (m.id.startsWith('cmi-') && m.text === payload.content ? { ...m, id: payload.id, status: 'sent' } : m));
          }
          return [...prev, {
            id: payload.id,
            conversationId: payload.conversationId,
            senderId: payload.senderId,
            senderName: payload.sender?.displayName || payload.senderName || 'Participante',
            text: payload.content || '',
            content: payload.content || '',
            messageType: payload.type || payload.messageType || 'text',
            status: 'delivered',
            time: new Date(payload.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: payload.createdAt || new Date().toISOString()
          }];
        });
      }
    };

    signalR.on('MessageCreated', handleInCallMessage);
    signalR.on('MessageReceived', handleInCallMessage);

    return () => {
      signalR.off('MessageCreated', handleInCallMessage);
      signalR.off('MessageReceived', handleInCallMessage);
      unsubIncoming();
      unsubClaimed();
      unsubResponse();
      unsubCancelled();
      unsubTimeout();
      unsubEnded();
      unsubSignal();
      unsubHeld();
      unsubResumed();
    };
  }, [transitionCallState]);

  /**
   * Start an outgoing 1:1 call
   */
  const startCall = useCallback(async (params: StartCallParams) => {
    callLog('CallManager: startCall initiated', params);

    sound.playOutgoingRing();
    transitionCallState('initiating');

    const mediaType: CallMediaType = (params.callType === 'audio' || params.isVideo === false) ? 'audio' : 'video';

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
    setCallType(mediaType);
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
        setSessions(prev => {
          const next = new Map(prev);
          next.set(session.id, session);
          return next;
        });
        setOutgoingCall({ ...outPayload, callId: session.id, roomId: session.roomId });
        transitionCallState('ringing_outgoing');

        // FASE 6: capture the conversation linked to this call for in-call chat
        const callConvId = res.data.callConversationId || res.data.call?.conversationId;
        if (callConvId) {
          setCallConversationId(callConvId);
        }

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
      setSessions(prev => {
        const next = new Map(prev);
        next.set(session.id, session);
        return next;
      });

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


  /**
   * Helper to resolve remote peer user ID for a session
   */
  const getRemoteUserId = (session: CallSession): string | undefined => {
    if (session.direction === 'inbound') {
      return session.callerId;
    }
    return session.calleeId || session.participantIds?.find(id => id !== session.callerId) || session.participantIds?.[0];
  };

  /**
   * Put Call On Hold
   * Silences media transmission via setPeerMediaEnabled without tearing down WebRTC or hardware.
   */
  const holdCall = useCallback(async (callId?: string) => {
    const act = activeSessionRef.current;
    const targetCallId = callId || act?.id;
    if (!targetCallId) {
      callWarn('CallManager: holdCall called with no active call');
      return;
    }

    const session = sessionsRef.current.get(targetCallId) || (act?.id === targetCallId ? act : null);
    if (!session) {
      callWarn(`CallManager: holdCall session [${targetCallId}] not found`);
      return;
    }

    callLog(`CallManager: Putting call [${targetCallId}] on HOLD`);
    const peerUserId = getRemoteUserId(session);

    // 1. Mute media to this peer via WebRTC senders
    if (peerUserId) {
      peerConnectionManager.setPeerMediaEnabled(peerUserId, false, false);
    }

    // 2. Notify backend & remote peer
    try {
      await signalingClient.sendHold(targetCallId, peerUserId, session.roomId);
    } catch (err: any) {
      callWarn('CallManager: Error dispatching hold signal:', err.message);
    }

    // 3. Update session state to 'held'
    const updated: CallSession = { ...session, state: 'held' };
    setSessions(prev => {
      const next = new Map(prev);
      next.set(targetCallId, updated);
      return next;
    });

    if (activeSessionRef.current?.id === targetCallId) {
      setActiveSession(updated);
      setIsHeldLocally(true);
      transitionCallState('held');
    }
  }, [transitionCallState]);

  /**
   * Resume Call from Hold
   * Restores media transmission via setPeerMediaEnabled.
   * If another call is active, auto-holds the active call first.
   */
  const resumeCall = useCallback(async (callId: string) => {
    callLog(`CallManager: Resuming call [${callId}]`);
    const session = sessionsRef.current.get(callId);
    if (!session) {
      callWarn(`CallManager: Cannot resume call [${callId}], not found`);
      return;
    }

    const currentAct = activeSessionRef.current;
    // If another call is currently active, hold it first
    if (currentAct && currentAct.id !== callId && (currentAct.state === 'active' || currentAct.state === 'connecting')) {
      callLog(`CallManager: Auto-holding active call [${currentAct.id}] before resuming [${callId}]`);
      await holdCall(currentAct.id);
    }

    const peerUserId = getRemoteUserId(session);

    // 1. Unmute media to this peer
    if (peerUserId) {
      peerConnectionManager.setPeerMediaEnabled(peerUserId, true, true);
    }

    // 2. Notify backend & remote peer
    try {
      await signalingClient.sendResume(callId, peerUserId, session.roomId);
    } catch (err: any) {
      callWarn('CallManager: Error dispatching resume signal:', err.message);
    }

    // 3. Update session state to 'active'
    const updated: CallSession = { ...session, state: 'active' };
    setSessions(prev => {
      const next = new Map(prev);
      next.set(callId, updated);
      return next;
    });

    setActiveSession(updated);
    setRoomId(session.roomId);
    setIsHeldLocally(false);
    setIsHeldRemotely(false);
    transitionCallState('active');
  }, [holdCall, transitionCallState]);

  /**
   * Swap Calls
   * Atomically exchanges active call with held call.
   */
  const swapCalls = useCallback(async () => {
    const act = activeSessionRef.current;
    const held = Array.from<CallSession>(sessionsRef.current.values()).find((s: CallSession) => s.state === 'held');

    // Check if we are swapping between 1:1 active and paused group call
    if (pausedGroupSessionRef.current && act?.type === '1:1') {
      callLog('CallManager: Swapping active 1:1 with paused group call');
      const currentOneToOne = act;
      await holdCall(currentOneToOne.id);
      const grp = pausedGroupSessionRef.current;
      setPausedGroupSession(currentOneToOne);
      setActiveSession(grp);
      setCallTitle(grp.callerName || 'Conferencia Grupal');
      setCallType(grp.mediaType);
      setRoomId(grp.roomId);
      sfuManager.resumeGroupCall();
      return;
    }

    if (pausedGroupSessionRef.current && act?.type === 'group') {
      callLog('CallManager: Swapping active group call with paused 1:1 call');
      const currentGrp = act;
      sfuManager.pauseGroupCall();
      const oneToOne = pausedGroupSessionRef.current;
      setPausedGroupSession(currentGrp);
      await resumeCall(oneToOne.id);
      return;
    }

    if (!act || !held) {
      callWarn('CallManager: swapCalls requires 1 active call and 1 held call');
      return;
    }

    callLog(`CallManager: SWAPPING active call [${act.id}] with held call [${held.id}]`);
    await holdCall(act.id);
    await resumeCall(held.id);
  }, [holdCall, resumeCall]);

  /**
   * Callee Accepts Incoming Call with Atomic Multi-Tab Claim
   * If there is already an active call, auto-holds it first!
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
        if (!activeSessionRef.current || activeSessionRef.current.state === 'idle') {
          transitionCallState('idle');
        }
        return;
      }
    } catch (err: any) {
      callWarn('CallManager: Claim error:', err.message);
    }

    // 2. Auto-hold current active call if present
    const currentActive = activeSessionRef.current;
    if (currentActive && (currentActive.state === 'active' || currentActive.state === 'connecting')) {
      if (currentActive.type === 'group') {
        callLog(`CallManager: Group call active [${currentActive.id}] while accepting incoming 1:1 call -> Pausing group call media`);
        sfuManager.pauseGroupCall();
        setPausedGroupSession(currentActive);
      } else {
        callLog(`CallManager: Auto-holding active 1:1 call [${currentActive.id}] before accepting incoming call [${targetCallId}]`);
        const activePeerId = getRemoteUserId(currentActive);
        if (activePeerId) {
          peerConnectionManager.setPeerMediaEnabled(activePeerId, false, false);
        }
        try {
          await signalingClient.sendHold(currentActive.id, activePeerId, currentActive.roomId);
        } catch (err: any) {
          callWarn('CallManager: Auto-hold signaling error:', err.message);
        }
        const heldActive: CallSession = { ...currentActive, state: 'held' };
        setSessions(prev => {
          const next = new Map(prev);
          next.set(heldActive.id, heldActive);
          return next;
        });
      }
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
    setCallConversationId(callData.callConversationId || callData.conversationId || null);
    setParentChannelId(callData.channelId || null);
    setIsHeldLocally(false);
    setIsHeldRemotely(false);

    try {
      // 3. Acquire local media stream
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
      setSessions(prev => {
        const next = new Map(prev);
        next.set(targetCallId, session);
        return next;
      });

      // 4. Pre-create PeerConnection
      await peerConnectionManager.getOrCreatePeerConnection(callerId, targetCallId, callerRoomId, stream);

      // 5. Send positive CallResponse to caller
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
      try {
        await signalingClient.respondCall(callData.caller?.id, targetCallId, false, reason || 'declined', callData.roomId);
      } catch (err: any) {
        callWarn('CallManager: Error declining call:', err.message);
      }

      // ONLY transition global state if there are no other active or held calls!
      const hasOtherCalls = Array.from<CallSession>(sessionsRef.current.values()).some((s: CallSession) => s.state === 'active' || s.state === 'held');
      if (!hasOtherCalls && (!activeSessionRef.current || activeSessionRef.current.state === 'idle')) {
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 500);
      }
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
   * Supports individual call termination (active or held) without tearing down other calls.
   */
  const endCall = useCallback(async (callIdOrReason?: string, maybeReason?: string) => {
    sound.stopAllRings();

    const act = activeSessionRef.current;
    let targetId: string | undefined;
    let reason: string | undefined;

    if (callIdOrReason && (sessionsRef.current.has(callIdOrReason) || act?.id === callIdOrReason)) {
      targetId = callIdOrReason;
      reason = maybeReason || 'completed';
    } else if (callIdOrReason && !maybeReason && act) {
      targetId = act.id;
      reason = callIdOrReason;
    } else {
      targetId = callIdOrReason || act?.id;
      reason = maybeReason || 'completed';
    }

    if (!targetId) {
      if (callStateRef.current === 'idle') return;
    }

    callLog(`CallManager: Explicit endCall requested for [${targetId || 'active'}]`, { reason });

    const session = targetId ? (sessionsRef.current.get(targetId) || (act?.id === targetId ? act : null)) : act;

    if (session) {
      if (session.type === 'group') {
        try {
          if (isHost) {
            await api.post(`/group-calls/${session.id}/end`, {});
          } else {
            await api.post(`/group-calls/${session.id}/leave`, {});
          }
        } catch (e) {}
        await sfuManager.disconnect();
        localMediaController.releaseLocalMedia();
        setLocalStream(null);
        setSfuPeers([]);
        setActiveSession(null);
        setIsHost(false);
        transitionCallState('ended');
        setTimeout(() => transitionCallState('idle'), 500);
        return;
      }

      const peerUserId = getRemoteUserId(session);
      if (peerUserId) {
        peerConnectionManager.closePeer(peerUserId);
      }

      try {
        await signalingClient.endCall(session.id, session.roomId, peerUserId, reason || 'completed');
      } catch (err: any) {
        callWarn('CallManager: End call error:', err.message);
      }

      setSessions(prev => {
        const next = new Map(prev);
        next.delete(session.id);
        return next;
      });
    }

    // Check if there is a paused group call waiting to be resumed!
    if (pausedGroupSessionRef.current) {
      callLog('CallManager: Resuming paused group call after 1:1 call ended');
      const grp = pausedGroupSessionRef.current;
      setPausedGroupSession(null);
      setActiveSession(grp);
      setCallTitle(grp.callerName || 'Conferencia Grupal');
      setCallType(grp.mediaType);
      setRoomId(grp.roomId);
      sfuManager.resumeGroupCall();
      transitionCallState('active');
      return;
    }

    // Check if other calls remain (e.g. held call when active was ended)
    const remainingSessions = Array.from<CallSession>(sessionsRef.current.values()).filter((s: CallSession) => s.id !== targetId && s.state !== 'ended');

    if (remainingSessions.length > 0) {
      callLog(`CallManager: Call [${targetId}] ended, ${remainingSessions.length} session(s) remain`);
      if (act?.id === targetId) {
        // Active call ended, held call remains
        const heldCall = remainingSessions.find((s: CallSession) => s.state === 'held');
        if (heldCall) {
          setActiveSession(null);
          setCallState('held');
          setIsHeldLocally(false);
          setIsHeldRemotely(false);
          return;
        }
      } else {
        // Held call was ended, active call remains unaffected!
        return;
      }
    }

    // No remaining calls: Full teardown
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    sound.playHangupTone();

    peerConnectionManager.closeAll();
    localMediaController.releaseLocalMedia();

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
    }

    setLocalStream(null);
    setScreenStream(null);
    setPeersMap(new Map());
    setActiveSession(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setRoomId(null);
    setIsScreenSharing(false);
    setIsHeldLocally(false);
    setIsHeldRemotely(false);
    transitionCallState('ended');
    setTimeout(() => {
      transitionCallState('idle');
      isTerminatingRef.current = false;
      // FASE 6: reset in-call chat state after call is fully over
      setCallConversationId(null);
      setChatMessages([]);
    }, 1000);
  }, [roomId, transitionCallState]);

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
    const handleEndCallEvent = (e: any) => {
      endCall(e.detail?.callId, e.detail?.reason || 'completed');
    };
    window.addEventListener('collabpulse:join-call', handleJoinCallEvent);
    window.addEventListener('collabpulse:start-call', handleStartCallEvent);
    window.addEventListener('collabpulse:end-call', handleEndCallEvent);
    return () => {
      window.removeEventListener('collabpulse:join-call', handleJoinCallEvent);
      window.removeEventListener('collabpulse:start-call', handleStartCallEvent);
      window.removeEventListener('collabpulse:end-call', handleEndCallEvent);
    };
  }, [endCall, joinCall, startCall]);

  /**
   * Microphone toggle
   * Disables or enables track without destroying hardware stream
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
   * Seamlessly turns camera on/off and handles audio-only -> video transition
   */
  const toggleVideo = useCallback(async () => {
    const act = activeSessionRef.current;
    const currentRoom = act?.roomId || roomId || undefined;

    try {
      if (isVideoOff) {
        const track = await localMediaController.enableCamera();
        setIsVideoOff(false);
        setLocalStream(localMediaController.getStream());

        // Replace or add video track on active peer connection
        if (track && !isScreenSharing) {
          await peerConnectionManager.replaceVideoTrack(
            track,
            act?.id,
            currentRoom,
            localMediaController.getStream()
          );
        }

        // If call was audio-only, transition mediaType to video
        if (act && act.mediaType === 'audio') {
          const updated = { ...act, mediaType: 'video' as CallMediaType };
          setActiveSession(updated);
          setCallType('video');
        }
      } else {
        localMediaController.disableCamera();
        setIsVideoOff(true);
      }
    } catch (err: any) {
      callError('CallManager: Failed to toggle video', err);
    }
  }, [isVideoOff, isScreenSharing, roomId]);

  /**
   * Screen Share toggle using WebRTC replaceTrack
   * Seamlessly switches video stream to display capture and restores camera on stop
   */
  const toggleScreenShare = useCallback(async () => {
    const act = activeSessionRef.current;
    const currentRoom = act?.roomId || roomId || undefined;

    if (isScreenSharing) {
      // 1. Stop screen sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch (e) {}
        });
      }
      setScreenStream(null);
      setIsScreenSharing(false);

      // 2. Restore camera track to RTCRtpSender
      const cameraTrack = !isVideoOff ? localMediaController.getCameraTrack() : null;
      await peerConnectionManager.replaceVideoTrack(
        cameraTrack,
        act?.id,
        currentRoom,
        localMediaController.getStream()
      );
      callLog('CallManager: Restored camera track after stopping screen share');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = stream.getVideoTracks()[0];
        if (!screenTrack) return;

        setScreenStream(stream);
        setIsScreenSharing(true);

        // 3. Replace video track in RTCPeerConnection sender with screen track
        await peerConnectionManager.replaceVideoTrack(
          screenTrack,
          act?.id,
          currentRoom,
          localMediaController.getStream()
        );
        callLog('CallManager: Replaced video track with screen share track');

        // 4. Handle user stopping screen share via native browser bar
        screenTrack.onended = async () => {
          callLog('CallManager: Screen sharing ended by browser native control');
          setIsScreenSharing(false);
          setScreenStream(null);

          const cameraTrack = !isVideoOff ? localMediaController.getCameraTrack() : null;
          await peerConnectionManager.replaceVideoTrack(
            cameraTrack,
            act?.id,
            currentRoom,
            localMediaController.getStream()
          );
        };
      } catch (err: any) {
        callWarn('CallManager: Screen sharing cancelled or rejected', err.message);
      }
    }
  }, [isScreenSharing, isVideoOff, roomId]);

  const sendInCallMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const convId = callConversationIdRef.current;
    const clientMessageId = `cmi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Optimistic UI update — show immediately as 'sending'
    const optimisticMsg: InCallChatMessage = {
      id: clientMessageId,
      conversationId: convId || undefined,
      senderId: 'current-user',
      senderName: 'Yo',
      text,
      content: text,
      messageType: 'text',
      status: 'sending',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMsg]);

    if (convId) {
      // Send via real API (POST /conversations/:id/messages)
      try {
        const res = await api.post(`/conversations/${convId}/messages`, {
          content: text,
          clientMessageId,
          messageType: 'text'
        });
        const savedMsg = (res as any)?.data?.data || (res as any)?.data;
        if (savedMsg) {
          setChatMessages(prev =>
            prev.map(m =>
              m.id === clientMessageId
                ? { ...m, id: savedMsg.id, status: 'sent' }
                : m
            )
          );
        }
      } catch (err: any) {
        callError('CallManager: Failed to send in-call message', err);
        setChatMessages(prev =>
          prev.map(m =>
            m.id === clientMessageId ? { ...m, status: 'failed' } : m
          )
        );
      }
    }
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

  /**
   * Start a new group call session with LiveKit SFU
   */
  const startGroupCall = useCallback(async (params?: { title?: string; mediaType?: 'video' | 'audio' }): Promise<string | undefined> => {
    try {
      callLog('CallManager: Starting Group Call via LiveKit SFU', params);
      const title = params?.title || 'Conferencia Grupal';
      const mType = params?.mediaType || 'video';

      const createRes = await api.post('/group-calls', { title, mediaType: mType });
      const groupCall = (createRes.data as any)?.data || createRes.data;
      if (!groupCall || !groupCall.id) throw new Error('No group call data returned: ' + JSON.stringify(createRes));

      const tokenRes = await api.post(`/group-calls/${groupCall.id}/token`, {});
      const tokenData = (tokenRes.data as any)?.data || tokenRes.data;
      const { token, serverUrl, roomId: sfuRoomId } = tokenData || {};

      // Acquire local media
      const stream = await localMediaController.getLocalMedia({ audio: true, video: mType !== 'audio' });
      setLocalStream(stream);

      // Connect to LiveKit SFU
      sfuManager.setCallbacks(
        (updatedPeers) => setSfuPeers(updatedPeers),
        (speakerId) => setActiveSpeakerId(speakerId),
        (connState) => callLog('LiveKit Connection State:', connState)
      );

      await sfuManager.connect(serverUrl, token, sfuRoomId);
      await sfuManager.publishTracks(stream);

      const session: CallSession = {
        id: groupCall.id,
        roomId: groupCall.room_id || sfuRoomId,
        tenantId: groupCall.tenant_id,
        workspaceId: groupCall.workspace_id,
        type: 'group',
        mediaType: mType,
        direction: 'outbound',
        origin: 'meeting',
        state: 'active',
        callerId: groupCall.creator_id,
        callerName: 'Tú',
        participantIds: [groupCall.creator_id],
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };

      setActiveSession(session);
      setRoomId(groupCall.room_id || sfuRoomId);
      setCallTitle(title);
      setCallType(mType);
      setIsHost(true);
      setWindowMode('normal');
      transitionCallState('active');
      // FASE 6: store call conversation ID so in-call chat can post to real API
      if (groupCall.callConversationId) {
        setCallConversationId(groupCall.callConversationId);
      }

      return groupCall.id;
    } catch (err: any) {
      callError('CallManager: Failed to start group call', err);
      transitionCallState('failed');
      return undefined;
    }
  }, [transitionCallState]);

  /**
   * Join an existing active group call
   */
  const joinGroupCall = useCallback(async (groupCallId: string): Promise<void> => {
    try {
      callLog('CallManager: Joining Group Call', groupCallId);
      const joinRes = await api.post(`/group-calls/${groupCallId}/join`, {});
      const joinData = (joinRes.data as any)?.data || joinRes.data;

      const tokenRes = await api.post(`/group-calls/${groupCallId}/token`, {});
      const tokenData = (tokenRes.data as any)?.data || tokenRes.data;
      const { token, serverUrl, roomId: sfuRoomId } = tokenData || {};

      const stream = await localMediaController.getLocalMedia({ audio: true, video: true });
      setLocalStream(stream);

      sfuManager.setCallbacks(
        (updatedPeers) => setSfuPeers(updatedPeers),
        (speakerId) => setActiveSpeakerId(speakerId),
        (connState) => callLog('LiveKit Connection State:', connState)
      );

      await sfuManager.connect(serverUrl, token, sfuRoomId);
      await sfuManager.publishTracks(stream);

      const session: CallSession = {
        id: groupCallId,
        roomId: sfuRoomId,
        tenantId: joinData?.tenantId || '',
        workspaceId: joinData?.workspaceId || '',
        type: 'group',
        mediaType: 'video',
        direction: 'inbound',
        origin: 'meeting',
        state: 'active',
        callerId: '',
        participantIds: [],
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString()
      };

      setActiveSession(session);
      setRoomId(sfuRoomId);
      setIsHost(joinData?.role === 'host');
      setWindowMode('normal');
      transitionCallState('active');
      // FASE 6: store call conversation ID from join response
      if (joinData?.callConversationId) {
        setCallConversationId(joinData.callConversationId);
      }
    } catch (err: any) {
      callError('CallManager: Failed to join group call', err);
      transitionCallState('failed');
    }
  }, [transitionCallState]);

  /**
   * Leave current group call
   */
  const leaveGroupCall = useCallback(async (): Promise<void> => {
    const act = activeSessionRef.current;
    if (act?.type === 'group') {
      try {
        await api.post(`/group-calls/${act.id}/leave`, {});
      } catch (e) {}
      await sfuManager.disconnect();
      localMediaController.releaseLocalMedia();
      setLocalStream(null);
      setSfuPeers([]);
      setActiveSession(null);
      setRoomId(null);
      setIsHost(false);
      transitionCallState('ended');
      setTimeout(() => transitionCallState('idle'), 500);
    }
  }, [transitionCallState]);

  /**
   * End group call for everyone (Host only)
   */
  const endGroupCall = useCallback(async (): Promise<void> => {
    const act = activeSessionRef.current;
    if (act?.type === 'group') {
      try {
        await api.post(`/group-calls/${act.id}/end`, {});
      } catch (e) {}
      await sfuManager.disconnect();
      localMediaController.releaseLocalMedia();
      setLocalStream(null);
      setSfuPeers([]);
      setActiveSession(null);
      setRoomId(null);
      setIsHost(false);
      transitionCallState('ended');
      setTimeout(() => transitionCallState('idle'), 500);
    }
  }, [transitionCallState]);

  const pauseGroupCall = useCallback(() => {
    sfuManager.pauseGroupCall();
  }, []);

  const resumeGroupCall = useCallback(() => {
    sfuManager.resumeGroupCall();
  }, []);

  useEffect(() => {
    const handleStartGroupCallEvent = async (e: any) => {
      const callId = await startGroupCall(e.detail);
      if (typeof e.detail?.callback === 'function') {
        e.detail.callback(callId);
      }
    };
    const handleJoinGroupCallEvent = async (e: any) => {
      if (e.detail?.callId) {
        await joinGroupCall(e.detail.callId);
      }
    };
    const handleLeaveGroupCallEvent = async () => {
      await leaveGroupCall();
    };
    const handleEndGroupCallEvent = async () => {
      await endGroupCall();
    };
    window.addEventListener('collabpulse:start-group-call', handleStartGroupCallEvent);
    window.addEventListener('collabpulse:join-group-call', handleJoinGroupCallEvent);
    window.addEventListener('collabpulse:leave-group-call', handleLeaveGroupCallEvent);
    window.addEventListener('collabpulse:end-group-call', handleEndGroupCallEvent);
    return () => {
      window.removeEventListener('collabpulse:start-group-call', handleStartGroupCallEvent);
      window.removeEventListener('collabpulse:join-group-call', handleJoinGroupCallEvent);
      window.removeEventListener('collabpulse:leave-group-call', handleLeaveGroupCallEvent);
      window.removeEventListener('collabpulse:end-group-call', handleEndGroupCallEvent);
    };
  }, [endGroupCall, joinGroupCall, leaveGroupCall, startGroupCall]);

  const groupSession = useMemo(() => {
    if (activeSession?.type === 'group') return activeSession;
    if (pausedGroupSession?.type === 'group') return pausedGroupSession;
    return null;
  }, [activeSession, pausedGroupSession]);

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
        heldSession,
        heldSessions,
        isHeldLocally,
        isHeldRemotely,
        holdCall,
        resumeCall,
        swapCalls,
        groupSession,
        sfuPeers,
        isHost,
        startGroupCall,
        joinGroupCall,
        leaveGroupCall,
        endGroupCall,
        pauseGroupCall,
        resumeGroupCall,
        toggleMic,
        toggleVideo,
        toggleScreenShare,
        setWindowMode,
        setShowInCallChat,
        setShowAddParticipant,
        sendInCallMessage,
        escalateToGroup,
        callConversationId
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
