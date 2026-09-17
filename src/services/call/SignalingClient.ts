/**
 * SignalingClient
 * Centralized client for WebRTC signaling, ephemeral session tokens, and realtime events.
 * Guarantees message idempotency, multi-tenant headers, and multi-tab claim handshakes.
 */
import { api } from '../api';
import { signalR } from '../signalr';
import { callLog, callWarn, callError } from '../callDebug';

export interface SignalingMessage {
  callId?: string;
  roomId?: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  signalType: string;
  data: any;
  timestamp: string;
}

export type SignalHandler = (signal: SignalingMessage) => void;
export type IncomingCallHandler = (callData: any) => void;
export type CallResponseHandler = (responseData: any) => void;
export type CallCancelledHandler = (data: { callId: string; roomId: string; reason?: string }) => void;
export type CallEndedHandler = (data: { callId: string; roomId: string; endedBy: string; durationSeconds?: number }) => void;
export type CallClaimedHandler = (data: { callId: string; claimedByTabId: string }) => void;
export type CallTimeoutHandler = (data: { callId: string; roomId: string }) => void;
export type CallHeldHandler = (data: { callId: string; roomId: string; heldBy: string }) => void;
export type CallResumedHandler = (data: { callId: string; roomId: string; resumedBy: string }) => void;

export class SignalingClient {
  private tabId: string;
  private sessionTokens: Map<string, string> = new Map(); // callId -> token
  private processedMessageIds: Set<string> = new Set();

  private onSignalListeners: Set<SignalHandler> = new Set();
  private onIncomingCallListeners: Set<IncomingCallHandler> = new Set();
  private onCallResponseListeners: Set<CallResponseHandler> = new Set();
  private onCallCancelledListeners: Set<CallCancelledHandler> = new Set();
  private onCallEndedListeners: Set<CallEndedHandler> = new Set();
  private onCallClaimedListeners: Set<CallClaimedHandler> = new Set();
  private onCallTimeoutListeners: Set<CallTimeoutHandler> = new Set();
  private onCallHeldListeners: Set<CallHeldHandler> = new Set();
  private onCallResumedListeners: Set<CallResumedHandler> = new Set();

  constructor() {
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.initRealtimeSubscriptions();
  }

  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Initialize subscriptions to SSE / Realtime events with idempotency
   */
  private initRealtimeSubscriptions(): void {
    signalR.on('WebRTCSignal', (signal: SignalingMessage) => {
      const msgKey = `${signal.callId || ''}_${signal.signalType}_${signal.senderId}_${JSON.stringify(signal.data || {}).substring(0, 30)}`;
      if (this.processedMessageIds.has(msgKey)) {
        return; // Idempotent deduplication
      }
      this.processedMessageIds.add(msgKey);
      if (this.processedMessageIds.size > 200) {
        // prune old keys
        const first = this.processedMessageIds.values().next().value;
        if (first) this.processedMessageIds.delete(first);
      }

      callLog(`SignalingClient: Received WebRTCSignal [${signal.signalType}] from ${signal.senderName || signal.senderId}`);
      this.onSignalListeners.forEach(listener => {
        try {
          listener(signal);
        } catch (e) {
          callError('Error in WebRTCSignal listener', e);
        }
      });
    });

    signalR.on('IncomingCall', (callData: any) => {
      callLog('SignalingClient: Received IncomingCall event', { callId: callData.callId, caller: callData.caller?.displayName });
      this.onIncomingCallListeners.forEach(listener => listener(callData));
    });

    signalR.on('CallResponse', (responseData: any) => {
      callLog('SignalingClient: Received CallResponse event', { callId: responseData.callId, accepted: responseData.accepted });
      this.onCallResponseListeners.forEach(listener => listener(responseData));
    });

    signalR.on('CallCancelled', (data: any) => {
      callLog('SignalingClient: Received CallCancelled event', data);
      this.onCallCancelledListeners.forEach(listener => listener(data));
    });

    signalR.on('CallEnded', (data: any) => {
      callLog('SignalingClient: Received CallEnded event', data);
      this.onCallEndedListeners.forEach(listener => listener(data));
    });

    signalR.on('CallClaimed', (data: any) => {
      callLog('SignalingClient: Received CallClaimed event', data);
      this.onCallClaimedListeners.forEach(listener => listener(data));
    });

    signalR.on('CallTimeout', (data: any) => {
      callLog('SignalingClient: Received CallTimeout event', data);
      this.onCallTimeoutListeners.forEach(listener => listener(data));
    });

    signalR.on('CallHeld', (data: any) => {
      callLog('SignalingClient: Received CallHeld event', data);
      this.onCallHeldListeners.forEach(listener => listener(data));
    });

    signalR.on('CallResumed', (data: any) => {
      callLog('SignalingClient: Received CallResumed event', data);
      this.onCallResumedListeners.forEach(listener => listener(data));
    });
  }

  // --- Listener Subscriptions ---
  public onSignal(handler: SignalHandler): () => void {
    this.onSignalListeners.add(handler);
    return () => this.onSignalListeners.delete(handler);
  }

  public onIncomingCall(handler: IncomingCallHandler): () => void {
    this.onIncomingCallListeners.add(handler);
    return () => this.onIncomingCallListeners.delete(handler);
  }

  public onCallResponse(handler: CallResponseHandler): () => void {
    this.onCallResponseListeners.add(handler);
    return () => this.onCallResponseListeners.delete(handler);
  }

  public onCallCancelled(handler: CallCancelledHandler): () => void {
    this.onCallCancelledListeners.add(handler);
    return () => this.onCallCancelledListeners.delete(handler);
  }

  public onCallEnded(handler: CallEndedHandler): () => void {
    this.onCallEndedListeners.add(handler);
    return () => this.onCallEndedListeners.delete(handler);
  }

  public onCallClaimed(handler: CallClaimedHandler): () => void {
    this.onCallClaimedListeners.add(handler);
    return () => this.onCallClaimedListeners.delete(handler);
  }

  public onCallTimeout(handler: CallTimeoutHandler): () => void {
    this.onCallTimeoutListeners.add(handler);
    return () => this.onCallTimeoutListeners.delete(handler);
  }

  public onCallHeld(handler: CallHeldHandler): () => void {
    this.onCallHeldListeners.add(handler);
    return () => this.onCallHeldListeners.delete(handler);
  }

  public onCallResumed(handler: CallResumedHandler): () => void {
    this.onCallResumedListeners.add(handler);
    return () => this.onCallResumedListeners.delete(handler);
  }

  // --- Outgoing Signaling Actions ---
  public async fetchSessionToken(callId: string, roomId: string): Promise<string | null> {
    if (this.sessionTokens.has(callId)) {
      return this.sessionTokens.get(callId)!;
    }
    try {
      const res = await api.post('/calls/session-token', { callId, roomId });
      if (res.success && res.data?.token) {
        this.sessionTokens.set(callId, res.data.token);
        return res.data.token;
      }
    } catch (err: any) {
      callWarn('SignalingClient: Failed to fetch ephemeral session token', err.message);
    }
    return null;
  }

  public async getIceServers(): Promise<RTCConfiguration> {
    try {
      const res = await api.get('/calls/ice-servers');
      if (res.success && res.data) {
        return res.data;
      }
    } catch (err: any) {
      callWarn('SignalingClient: Failed to fetch ice-servers from backend, using fallback STUN', err.message);
    }

    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };
  }

  public async sendSignal(
    signalType: string,
    data: any,
    targetUserId?: string,
    roomId?: string,
    callId?: string
  ): Promise<void> {
    callLog(`SignalingClient: Sending signal [${signalType}]`, { targetUserId, roomId, callId });
    await api.post('/calls/signal', {
      callId,
      roomId,
      targetUserId,
      signalType,
      data
    });
  }

  public async sendOffer(callId: string, roomId: string, targetUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendSignal('offer', offer, targetUserId, roomId, callId);
  }

  public async sendAnswer(callId: string, roomId: string, targetUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    await this.sendSignal('answer', answer, targetUserId, roomId, callId);
  }

  public async sendIceCandidate(callId: string, roomId: string, targetUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    await this.sendSignal('ice-candidate', candidate, targetUserId, roomId, callId);
  }

  public async sendIceRestart(callId: string, roomId: string, targetUserId: string): Promise<void> {
    await this.sendSignal('ice-restart', {}, targetUserId, roomId, callId);
  }

  public async inviteCall(params: {
    targetUserId?: string;
    conversationId?: string;
    channelId?: string;
    roomId?: string;
    mediaType?: 'audio' | 'video';
    title?: string;
  }): Promise<any> {
    callLog('SignalingClient: Inviting call', params);
    return await api.post('/calls/invite', params);
  }

  public async claimCall(callId: string): Promise<{ claimed: boolean; message?: string }> {
    callLog('SignalingClient: Claiming call for tab', { callId, tabId: this.tabId });
    try {
      const res = await api.post('/calls/claim', { callId, tabId: this.tabId });
      if (res.success && res.code === 'CALL_CLAIMED') {
        return { claimed: true };
      }
      return { claimed: false, message: res.message };
    } catch (err: any) {
      if (err.response?.status === 409 || err.code === 'CALL_ALREADY_CLAIMED') {
        return { claimed: false, message: 'La llamada ya fue aceptada en otra pestaña' };
      }
      throw err;
    }
  }

  public async respondCall(callerId: string, callId: string, accepted: boolean, reason?: string, roomId?: string): Promise<any> {
    callLog('SignalingClient: Responding to call', { callId, accepted, reason });
    return await api.post('/calls/response', {
      callerId,
      callId,
      roomId,
      accepted,
      reason,
      tabId: this.tabId
    });
  }

  public async cancelCall(callId: string, targetUserId?: string, roomId?: string): Promise<any> {
    callLog('SignalingClient: Cancelling call', { callId, targetUserId });
    return await api.post('/calls/cancel', {
      callId,
      targetUserId,
      roomId
    });
  }

  public async sendHold(callId: string, targetUserId?: string, roomId?: string): Promise<any> {
    callLog('SignalingClient: Holding call', { callId, targetUserId, roomId });
    return await api.post('/calls/hold', {
      callId,
      targetUserId,
      roomId
    });
  }

  public async sendResume(callId: string, targetUserId?: string, roomId?: string): Promise<any> {
    callLog('SignalingClient: Resuming call', { callId, targetUserId, roomId });
    return await api.post('/calls/resume', {
      callId,
      targetUserId,
      roomId
    });
  }

  public async endCall(callId?: string, roomId?: string, targetUserId?: string, reason?: string): Promise<any> {
    callLog('SignalingClient: Ending call', { callId, roomId, reason });
    return await api.post('/calls/end', {
      callId,
      roomId,
      targetUserId,
      reason
    });
  }
}

export const signalingClient = new SignalingClient();
