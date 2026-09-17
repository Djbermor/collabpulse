/**
 * LocalMediaController
 * Manages user media acquisition, hardware tracks, and device error recovery.
 * Ensures local MediaStream lifecycle survives UI component unmounts and route navigation.
 */
import { callLog, callWarn, callError } from '../callDebug';

export interface MediaOptions {
  audio: boolean;
  video: boolean;
}

export class LocalMediaController {
  private localStream: MediaStream | null = null;
  private isAudioMuted: boolean = false;
  private isVideoOff: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__collabpulse_lmc = this;
      (window as any).__collabpulse_localMediaController = this;
    }
  }

  /**
   * Acquire local media stream with resilient constraints.
   */
  public async getLocalMedia(options: MediaOptions = { audio: true, video: true }): Promise<MediaStream> {
    if (this.localStream && this.localStream.active) {
      callLog('LocalMediaController: Using existing active local stream');
      return this.localStream;
    }

    callLog('LocalMediaController: Requesting getUserMedia', options);

    const constraints: MediaStreamConstraints = {
      audio: options.audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } : false,
      video: options.video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isAudioMuted = !options.audio;
      this.isVideoOff = !options.video;

      callLog('LocalMediaController: Acquired media tracks', {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length
      });

      return this.localStream;
    } catch (err: any) {
      callWarn('LocalMediaController: Primary getUserMedia failed, attempting fallback', err.message);

      // Fallback: If video failed (e.g. camera busy or absent), try audio-only
      if (options.video && options.audio) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          this.isAudioMuted = false;
          this.isVideoOff = true;
          callLog('LocalMediaController: Fallback to audio-only succeeded');
          return this.localStream;
        } catch (audioErr: any) {
          callError('LocalMediaController: Audio-only fallback also failed', audioErr);
          throw audioErr;
        }
      }

      callError('LocalMediaController: Media acquisition failed', err);
      throw err;
    }
  }

  /**
   * Current local stream reference
   */
  public getStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Enable/Unmute microphone
   */
  public enableMicrophone(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      this.isAudioMuted = false;
      callLog('LocalMediaController: Microphone enabled');
    }
  }

  /**
   * Disable/Mute microphone
   */
  public disableMicrophone(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      this.isAudioMuted = true;
      callLog('LocalMediaController: Microphone disabled');
    }
  }

  /**
   * Get active camera track
   */
  public getCameraTrack(): MediaStreamTrack | null {
    return this.localStream ? (this.localStream.getVideoTracks()[0] || null) : null;
  }

  /**
   * Enable/Unmute camera. Returns the active video track.
   */
  public async enableCamera(): Promise<MediaStreamTrack | null> {
    if (!this.localStream) {
      await this.getLocalMedia({ audio: true, video: true });
      return this.getCameraTrack();
    }

    const existingTrack = this.localStream.getVideoTracks()[0];
    if (existingTrack) {
      existingTrack.enabled = true;
      this.isVideoOff = false;
      callLog('LocalMediaController: Camera enabled (existing track)');
      return existingTrack;
    }

    // If stream didn't have video track initially, acquire one
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
      });
      const newTrack = videoStream.getVideoTracks()[0];
      if (newTrack) {
        this.localStream.addTrack(newTrack);
        this.isVideoOff = false;
        callLog('LocalMediaController: Camera track acquired and added to local stream');
        return newTrack;
      }
      return null;
    } catch (err: any) {
      callError('LocalMediaController: Failed to enable camera', err);
      throw err;
    }
  }

  /**
   * Disable/Mute camera
   */
  public disableCamera(): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = false;
      });
      this.isVideoOff = true;
      callLog('LocalMediaController: Camera disabled');
    }
  }

  public getAudioMuted(): boolean {
    return this.isAudioMuted;
  }

  public getVideoOff(): boolean {
    return this.isVideoOff;
  }

  /**
   * Stop all tracks and release hardware cameras and microphones.
   * Called ONLY on genuine call termination.
   */
  public releaseLocalMedia(): void {
    if (this.localStream) {
      callLog('LocalMediaController: Stopping all tracks and releasing hardware');
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      this.localStream = null;
      this.isAudioMuted = false;
      this.isVideoOff = false;
    }
  }
}

export const localMediaController = new LocalMediaController();
