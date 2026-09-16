/**
 * PeerConnectionManager
 * Manages RTCPeerConnection instances, deterministic SDP offers/answers,
 * ICE candidate queuing, ICE restart, and remote MediaStream extraction.
 */
import { signalingClient } from './SignalingClient';
import { callLog, callWarn, callError } from '../callDebug';

export interface PeerConnectionContext {
  remoteUserId: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream;
  pendingIceCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
  iceRestartTimeout?: NodeJS.Timeout;
}

export type RemoteStreamCallback = (remoteUserId: string, stream: MediaStream) => void;
export type ConnectionStateCallback = (remoteUserId: string, state: RTCPeerConnectionState | 'reconnecting') => void;

export class PeerConnectionManager {
  private peers: Map<string, PeerConnectionContext> = new Map(); // remoteUserId -> context
  private iceConfiguration: RTCConfiguration | null = null;
  private onRemoteStreamCallback: RemoteStreamCallback | null = null;
  private onConnectionStateCallback: ConnectionStateCallback | null = null;

  public setCallbacks(
    onRemoteStream: RemoteStreamCallback,
    onConnectionState: ConnectionStateCallback
  ): void {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onConnectionStateCallback = onConnectionState;
  }

  /**
   * Get or create RTCPeerConnection for a remote peer
   */
  public async getOrCreatePeerConnection(
    remoteUserId: string,
    callId: string,
    roomId: string,
    localStream?: MediaStream | null
  ): Promise<PeerConnectionContext> {
    const existing = this.peers.get(remoteUserId);
    if (existing && existing.pc.signalingState !== 'closed') {
      return existing;
    }

    if (!this.iceConfiguration) {
      this.iceConfiguration = await signalingClient.getIceServers();
    }

    callLog(`PeerConnectionManager: Creating RTCPeerConnection for remote peer: ${remoteUserId}`, {
      iceServers: this.iceConfiguration.iceServers?.length
    });

    const pc = new RTCPeerConnection(this.iceConfiguration);
    const remoteStream = new MediaStream();

    const context: PeerConnectionContext = {
      remoteUserId,
      pc,
      remoteStream,
      pendingIceCandidates: [],
      hasRemoteDescription: false
    };

    // 1. Add local media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStream);
          callLog(`PeerConnectionManager: Added local track [${track.kind}] for peer ${remoteUserId}`);
        } catch (e: any) {
          callWarn(`PeerConnectionManager: Track add warning:`, e.message);
        }
      });
    }

    // 2. Handle remote media tracks
    pc.ontrack = (event) => {
      callLog(`PeerConnectionManager: ontrack event received from ${remoteUserId}`, {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        streamsCount: event.streams.length
      });

      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          if (!remoteStream.getTracks().some(t => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else {
        if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(remoteUserId, remoteStream);
      }
    };

    // 3. ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        callLog(`PeerConnectionManager: Local ICE candidate generated for ${remoteUserId}`);
        signalingClient.sendIceCandidate(callId, roomId, remoteUserId, event.candidate.toJSON());
      }
    };

    // 4. Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      callLog(`PeerConnectionManager: Connection state changed for ${remoteUserId} -> ${state}`);
      if (this.onConnectionStateCallback) {
        this.onConnectionStateCallback(remoteUserId, state);
      }
    };

    // 5. ICE Connection state and ICE restart handling
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      callLog(`PeerConnectionManager: ICE state changed for ${remoteUserId} -> ${iceState}`);

      if (iceState === 'disconnected') {
        callWarn(`PeerConnectionManager: ICE disconnected for ${remoteUserId}. Initiating grace period.`);
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback(remoteUserId, 'reconnecting');
        }

        // Wait 3 seconds before forcing ICE restart to allow spontaneous reconnection
        if (!context.iceRestartTimeout) {
          context.iceRestartTimeout = setTimeout(() => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
              callWarn(`PeerConnectionManager: Triggering ICE restart for ${remoteUserId}`);
              this.restartIce(remoteUserId, callId, roomId);
            }
          }, 3000);
        }
      } else if (iceState === 'failed') {
        callWarn(`PeerConnectionManager: ICE failed for ${remoteUserId}. Immediate ICE restart.`);
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback(remoteUserId, 'reconnecting');
        }
        this.restartIce(remoteUserId, callId, roomId);
      } else if (iceState === 'connected' || iceState === 'completed') {
        if (context.iceRestartTimeout) {
          clearTimeout(context.iceRestartTimeout);
          context.iceRestartTimeout = undefined;
        }
        if (this.onConnectionStateCallback) {
          this.onConnectionStateCallback(remoteUserId, 'connected');
        }
      }
    };

    this.peers.set(remoteUserId, context);
    return context;
  }

  /**
   * Deterministic Caller Offer creation and dispatch
   */
  public async createAndSendOffer(
    remoteUserId: string,
    callId: string,
    roomId: string,
    localStream?: MediaStream | null
  ): Promise<void> {
    const context = await this.getOrCreatePeerConnection(remoteUserId, callId, roomId, localStream);
    try {
      callLog(`PeerConnectionManager: Creating SDP offer for ${remoteUserId}`);
      const offer = await context.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await context.pc.setLocalDescription(offer);
      callLog(`PeerConnectionManager: Set local description (offer) for ${remoteUserId}`);

      await signalingClient.sendOffer(callId, roomId, remoteUserId, offer);
    } catch (err: any) {
      callError(`PeerConnectionManager: Failed to create/send offer to ${remoteUserId}`, err);
      throw err;
    }
  }

  /**
   * Deterministic Callee Answer creation on receiving offer
   */
  public async handleRemoteOffer(
    remoteUserId: string,
    callId: string,
    roomId: string,
    offer: RTCSessionDescriptionInit,
    localStream?: MediaStream | null
  ): Promise<void> {
    const context = await this.getOrCreatePeerConnection(remoteUserId, callId, roomId, localStream);
    try {
      callLog(`PeerConnectionManager: Setting remote description (offer) from ${remoteUserId}`);
      await context.pc.setRemoteDescription(new RTCSessionDescription(offer));
      context.hasRemoteDescription = true;

      // Drain queued ICE candidates
      await this.drainPendingIceCandidates(context);

      callLog(`PeerConnectionManager: Creating SDP answer for ${remoteUserId}`);
      const answer = await context.pc.createAnswer();
      await context.pc.setLocalDescription(answer);
      callLog(`PeerConnectionManager: Set local description (answer) for ${remoteUserId}`);

      await signalingClient.sendAnswer(callId, roomId, remoteUserId, answer);
    } catch (err: any) {
      callError(`PeerConnectionManager: Failed to handle remote offer from ${remoteUserId}`, err);
      throw err;
    }
  }

  /**
   * Caller receives and applies Callee Answer
   */
  public async handleRemoteAnswer(
    remoteUserId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const context = this.peers.get(remoteUserId);
    if (!context) {
      callWarn(`PeerConnectionManager: Received answer but no PeerConnection found for ${remoteUserId}`);
      return;
    }

    try {
      callLog(`PeerConnectionManager: Setting remote description (answer) from ${remoteUserId}`);
      await context.pc.setRemoteDescription(new RTCSessionDescription(answer));
      context.hasRemoteDescription = true;

      // Drain queued ICE candidates
      await this.drainPendingIceCandidates(context);
    } catch (err: any) {
      callError(`PeerConnectionManager: Failed to apply remote answer from ${remoteUserId}`, err);
      throw err;
    }
  }

  /**
   * Handle incoming ICE Candidate with queueing protection
   */
  public async handleRemoteIceCandidate(
    remoteUserId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const context = this.peers.get(remoteUserId);
    if (!context) {
      callWarn(`PeerConnectionManager: Received ICE candidate for unknown peer ${remoteUserId}`);
      return;
    }

    if (!context.hasRemoteDescription || !context.pc.remoteDescription) {
      callLog(`PeerConnectionManager: Queuing ICE candidate for ${remoteUserId} (remote description not ready)`);
      context.pendingIceCandidates.push(candidate);
      return;
    }

    try {
      await context.pc.addIceCandidate(new RTCIceCandidate(candidate));
      callLog(`PeerConnectionManager: Applied remote ICE candidate for ${remoteUserId}`);
    } catch (err: any) {
      callWarn(`PeerConnectionManager: Error adding remote ICE candidate:`, err.message);
    }
  }

  /**
   * Drain any queued ICE candidates after setRemoteDescription
   */
  private async drainPendingIceCandidates(context: PeerConnectionContext): Promise<void> {
    if (context.pendingIceCandidates.length === 0) return;

    callLog(`PeerConnectionManager: Draining ${context.pendingIceCandidates.length} queued ICE candidates for ${context.remoteUserId}`);
    const queue = [...context.pendingIceCandidates];
    context.pendingIceCandidates = [];

    for (const cand of queue) {
      try {
        await context.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e: any) {
        callWarn(`PeerConnectionManager: Error applying queued ICE candidate:`, e.message);
      }
    }
  }

  /**
   * ICE Restart negotiation
   */
  public async restartIce(
    remoteUserId: string,
    callId: string,
    roomId: string
  ): Promise<void> {
    const context = this.peers.get(remoteUserId);
    if (!context || context.pc.signalingState === 'closed') return;

    try {
      callLog(`PeerConnectionManager: Performing ICE restart offer for ${remoteUserId}`);
      const offer = await context.pc.createOffer({ iceRestart: true });
      await context.pc.setLocalDescription(offer);
      await signalingClient.sendOffer(callId, roomId, remoteUserId, offer);
    } catch (err: any) {
      callError(`PeerConnectionManager: ICE restart failed for ${remoteUserId}`, err);
    }
  }

  /**
   * Get remote MediaStream for a peer
   */
  public getRemoteStream(remoteUserId: string): MediaStream | undefined {
    return this.peers.get(remoteUserId)?.remoteStream;
  }

  /**
   * Cleanly closes all PeerConnections and releases WebRTC resources
   */
  public closeAll(): void {
    callLog(`PeerConnectionManager: Closing all peer connections (${this.peers.size})`);
    this.peers.forEach((context, userId) => {
      if (context.iceRestartTimeout) {
        clearTimeout(context.iceRestartTimeout);
      }
      try {
        context.pc.getSenders().forEach(sender => {
          try {
            if (sender.track) sender.track.stop();
          } catch (e) {}
        });
        context.pc.close();
      } catch (e) {
        // ignore
      }
    });
    this.peers.clear();
  }
}

export const peerConnectionManager = new PeerConnectionManager();
