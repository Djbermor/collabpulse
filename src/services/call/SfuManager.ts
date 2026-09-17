/**
 * SfuManager
 * Encapsulates LiveKit SFU client operations, multi-participant track routing,
 * Active Speaker detection, and granular pause/resume lifecycle controls.
 */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  LocalParticipant,
  Track,
  RemoteTrackPublication,
  RemoteTrack,
  LocalTrackPublication,
  Participant,
  ConnectionState
} from 'livekit-client';
import { callLog, callWarn, callError } from '../callDebug';

export interface SfuPeerState {
  identity: string;
  name: string;
  metadata?: any;
  isSpeaking: boolean;
  audioTrack?: RemoteTrack;
  videoTrack?: RemoteTrack;
  screenTrack?: RemoteTrack;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt?: number;
}

export type SfuStateChangeCallback = (peers: SfuPeerState[]) => void;
export type ActiveSpeakerCallback = (activeSpeakerId: string | null) => void;
export type ConnectionStateCallback = (state: ConnectionState) => void;

export class SfuManager {
  private room: Room | null = null;
  private currentRoomId: string | null = null;
  private isPublishingPaused: boolean = false;
  private isSubscriptionsPaused: boolean = false;
  private onPeersChange: SfuStateChangeCallback | null = null;
  private onActiveSpeaker: ActiveSpeakerCallback | null = null;
  private onConnectionStateChange: ConnectionStateCallback | null = null;
  private attachedAudioElements: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    callLog('SfuManager: Initialized');
    if (typeof window !== 'undefined') {
      (window as any).__collabpulse_sfu = this;
    }
  }

  /**
   * Set event listeners
   */
  public setCallbacks(
    onPeersChange: SfuStateChangeCallback,
    onActiveSpeaker: ActiveSpeakerCallback,
    onConnectionStateChange: ConnectionStateCallback
  ): void {
    this.onPeersChange = onPeersChange;
    this.onActiveSpeaker = onActiveSpeaker;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  /**
   * Connect to LiveKit SFU room with ephemeral token
   */
  public async connect(serverUrl: string, token: string, roomId: string): Promise<void> {
    if (this.room && this.room.state !== ConnectionState.Disconnected) {
      callLog('SfuManager: Disconnecting existing room before reconnecting');
      await this.disconnect();
    }

    callLog(`SfuManager: Connecting to LiveKit SFU at ${serverUrl} for room ${roomId}`);

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        stopMicTrackOnMute: false
      }
    });

    this.currentRoomId = roomId;
    this.setupRoomListeners(this.room);

    try {
      await this.room.connect(serverUrl, token);
      callLog('SfuManager: Successfully connected to LiveKit room:', this.room.name);
      this.syncPeers();
    } catch (err: any) {
      callError('SfuManager: Failed to connect to LiveKit SFU:', err);
      throw err;
    }
  }

  /**
   * Setup event listeners on LiveKit Room
   */
  private setupRoomListeners(room: Room): void {
    room.on(RoomEvent.Connected, () => {
      callLog('SfuManager [LiveKit]: Room connected');
      this.onConnectionStateChange?.(ConnectionState.Connected);
      this.syncPeers();
    });

    room.on(RoomEvent.Disconnected, () => {
      callLog('SfuManager [LiveKit]: Room disconnected');
      this.onConnectionStateChange?.(ConnectionState.Disconnected);
      this.syncPeers();
    });

    room.on(RoomEvent.Reconnecting, () => {
      callWarn('SfuManager [LiveKit]: Room reconnecting...');
      this.onConnectionStateChange?.(ConnectionState.Reconnecting);
    });

    room.on(RoomEvent.Reconnected, () => {
      callLog('SfuManager [LiveKit]: Room reconnected successfully');
      this.onConnectionStateChange?.(ConnectionState.Connected);
      this.syncPeers();
    });

    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      callLog('SfuManager [LiveKit]: Remote participant connected:', participant.identity);
      this.syncPeers();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      callLog('SfuManager [LiveKit]: Remote participant disconnected:', participant.identity);
      this.cleanupParticipantAudio(participant.identity);
      this.syncPeers();
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      callLog(`SfuManager [LiveKit]: Subscribed to ${track.kind} track from ${participant.identity}`);

      if (track.kind === Track.Kind.Audio) {
        this.attachRemoteAudio(participant.identity, track);
      }

      this.syncPeers();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      callLog(`SfuManager [LiveKit]: Unsubscribed from ${track.kind} track from ${participant.identity}`);
      if (track.kind === Track.Kind.Audio) {
        this.cleanupParticipantAudio(participant.identity);
      }
      this.syncPeers();
    });

    room.on(RoomEvent.TrackMuted, () => this.syncPeers());
    room.on(RoomEvent.TrackUnmuted, () => this.syncPeers());

    // Active Speaker detection based on LiveKit SFU audio level metering
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const activeSpeaker = speakers.length > 0 ? speakers[0].identity : null;
      callLog('SfuManager [LiveKit]: Active speaker updated:', activeSpeaker);
      this.onActiveSpeaker?.(activeSpeaker);
      this.syncPeers();
    });
  }

  /**
   * Synchronize remote peers state
   */
  private syncPeers(): void {
    if (!this.room) return;

    const peers: SfuPeerState[] = [];
    const activeSpeakers = new Set(this.room.activeSpeakers.map(s => s.identity));

    this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      let audioTrack: RemoteTrack | undefined;
      let videoTrack: RemoteTrack | undefined;
      let screenTrack: RemoteTrack | undefined;

      participant.trackPublications.forEach((pub: RemoteTrackPublication) => {
        if (pub.track) {
          if (pub.source === Track.Source.Camera) {
            videoTrack = pub.track;
          } else if (pub.source === Track.Source.Microphone) {
            audioTrack = pub.track;
          } else if (pub.source === Track.Source.ScreenShare) {
            screenTrack = pub.track;
          }
        }
      });

      peers.push({
        identity: participant.identity,
        name: participant.name || participant.identity,
        metadata: participant.metadata,
        isSpeaking: activeSpeakers.has(participant.identity),
        audioTrack,
        videoTrack,
        screenTrack,
        isAudioMuted: !participant.isMicrophoneEnabled,
        isVideoOff: !participant.isCameraEnabled,
        isScreenSharing: !!screenTrack,
        joinedAt: participant.joinedAt?.getTime()
      });
    });

    this.onPeersChange?.(peers);
  }

  /**
   * Attach remote audio track to dedicated HTMLAudioElement
   */
  private attachRemoteAudio(participantId: string, track: RemoteTrack): void {
    if (this.isSubscriptionsPaused) {
      callLog(`SfuManager: Subscriptions paused, skipping audio attach for ${participantId}`);
      return;
    }

    let audioEl = this.attachedAudioElements.get(participantId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.id = `sfu-audio-${participantId}`;
      document.body.appendChild(audioEl);
      this.attachedAudioElements.set(participantId, audioEl);
    }

    track.attach(audioEl);
  }

  /**
   * Cleanup remote audio element for a participant
   */
  private cleanupParticipantAudio(participantId: string): void {
    const audioEl = this.attachedAudioElements.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      if (audioEl.parentNode) {
        audioEl.parentNode.removeChild(audioEl);
      }
      this.attachedAudioElements.delete(participantId);
    }
  }

  /**
   * Publish local audio and video tracks from a MediaStream
   */
  public async publishTracks(mediaStream: MediaStream): Promise<void> {
    if (!this.room || !this.room.localParticipant) {
      throw new Error('SfuManager: Room not connected, cannot publish tracks');
    }

    callLog('SfuManager: Publishing tracks to LiveKit room');
    const audioTrack = mediaStream.getAudioTracks()[0];
    const videoTrack = mediaStream.getVideoTracks()[0];

    if (audioTrack) {
      await this.room.localParticipant.publishTrack(audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone
      });
    }

    if (videoTrack) {
      await this.room.localParticipant.publishTrack(videoTrack, {
        name: 'camera',
        source: Track.Source.Camera,
        simulcast: true
      });
    }
  }

  /**
   * Publish or unpublish screen share track
   */
  public async setScreenShareEnabled(enabled: boolean, screenStream?: MediaStream): Promise<void> {
    if (!this.room || !this.room.localParticipant) return;

    if (enabled && screenStream) {
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        await this.room.localParticipant.publishTrack(screenTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare
        });
      }
    } else {
      // Unpublish screen share
      this.room.localParticipant.trackPublications.forEach((pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          this.room!.localParticipant.unpublishTrack(pub.track);
        }
      });
    }
  }

  /**
   * Granular pause methods (Inconsistency #5):
   * 1. pausePublishing()
   */
  public pausePublishing(): void {
    if (!this.room || !this.room.localParticipant) return;
    callLog('SfuManager: Pausing local track publishing (uplink silence)');
    this.room.localParticipant.trackPublications.forEach((pub: LocalTrackPublication) => {
      if (pub.track) {
        pub.track.mediaStreamTrack.enabled = false;
      }
    });
    this.isPublishingPaused = true;
  }

  /**
   * 2. resumePublishing()
   */
  public resumePublishing(): void {
    if (!this.room || !this.room.localParticipant) return;
    callLog('SfuManager: Resuming local track publishing (uplink active)');
    this.room.localParticipant.trackPublications.forEach((pub: LocalTrackPublication) => {
      if (pub.track) {
        pub.track.mediaStreamTrack.enabled = true;
      }
    });
    this.isPublishingPaused = false;
  }

  /**
   * 3. pauseSubscriptions()
   */
  public pauseSubscriptions(): void {
    callLog('SfuManager: Pausing remote audio/video subscriptions (downlink silence)');
    this.attachedAudioElements.forEach(el => {
      el.pause();
    });
    this.isSubscriptionsPaused = true;
  }

  /**
   * 4. resumeSubscriptions()
   */
  public resumeSubscriptions(): void {
    callLog('SfuManager: Resuming remote subscriptions (downlink active)');
    this.isSubscriptionsPaused = false;
    this.attachedAudioElements.forEach(el => {
      el.play().catch(e => callWarn('Audio resume failed on element:', e.message));
    });
  }

  /**
   * 5. pauseGroupCall()
   * Silences both local publication and remote playback while preserving room membership.
   */
  public pauseGroupCall(): void {
    callLog('SfuManager: Pausing group call (uplink + downlink paused)');
    this.pausePublishing();
    this.pauseSubscriptions();
  }

  /**
   * 6. resumeGroupCall()
   * Restores both local publication and remote playback.
   */
  public resumeGroupCall(): void {
    callLog('SfuManager: Resuming group call (uplink + downlink restored)');
    this.resumePublishing();
    this.resumeSubscriptions();
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  /**
   * Cleanup and full teardown (Inconsistency #19)
   */
  public async disconnect(): Promise<void> {
    callLog('SfuManager: Disconnecting and cleaning up resources');

    // Remove all attached audio elements
    this.attachedAudioElements.forEach((el) => {
      el.pause();
      el.srcObject = null;
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this.attachedAudioElements.clear();

    if (this.room) {
      this.room.removeAllListeners();
      await this.room.disconnect(true);
      this.room = null;
    }

    this.currentRoomId = null;
    this.isPublishingPaused = false;
    this.isSubscriptionsPaused = false;
    this.onPeersChange?.([]);
    this.onActiveSpeaker?.(null);
  }
}

export const sfuManager = new SfuManager();
