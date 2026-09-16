// Web Audio API Ringtone & Sound Synthesizer
// Completely client-side, zero external assets or MP3 dependencies, works offline

class SoundService {
  private audioCtx: AudioContext | null = null;
  private currentInterval: any = null;
  private currentTimeout: any = null;
  private activeOscillators: OscillatorNode[] = [];
  private isRinging: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Plays an outgoing call ringback tone (Standard 440Hz + 480Hz dual sine beep)
   * Pattern: 1.5 seconds ON, 2.5 seconds OFF, looping.
   */
  public playOutgoingRing() {
    this.stopAllRings();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isRinging = true;

    const playToneBurst = () => {
      if (!this.isRinging || !this.audioCtx || this.audioCtx.state === 'closed') return;

      try {
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, this.audioCtx.currentTime); // A4

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, this.audioCtx.currentTime);

        // Soft attack & release envelope to prevent clicking
        gainNode.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.12, this.audioCtx.currentTime + 0.08);
        gainNode.gain.setValueAtTime(0.12, this.audioCtx.currentTime + 1.4);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.5);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc1.start(this.audioCtx.currentTime);
        osc2.start(this.audioCtx.currentTime);
        osc1.stop(this.audioCtx.currentTime + 1.5);
        osc2.stop(this.audioCtx.currentTime + 1.5);

        this.activeOscillators.push(osc1, osc2);
      } catch (err) {
        console.warn('Audio synthesis error:', err);
      }
    };

    // First burst immediately
    playToneBurst();
    // Repeat every 4 seconds (1.5s tone + 2.5s silence)
    this.currentInterval = setInterval(playToneBurst, 4000);
  }

  /**
   * Plays an incoming call melody ringtone (Upbeat melodic chime)
   * Plays 4 ascending harmonious chime notes repeated every 2.5 seconds.
   */
  public playIncomingRing() {
    this.stopAllRings();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isRinging = true;

    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.18 }, // C5
      { freq: 659.25, time: 0.2, dur: 0.18 }, // E5
      { freq: 783.99, time: 0.4, dur: 0.22 }, // G5
      { freq: 1046.50, time: 0.65, dur: 0.35 } // C6
    ];

    const playMelodyBurst = () => {
      if (!this.isRinging || !this.audioCtx || this.audioCtx.state === 'closed') return;

      try {
        const now = this.audioCtx.currentTime;

        notes.forEach(n => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();

          osc.type = 'triangle'; // pleasant bell/marimba like timbre
          osc.frequency.setValueAtTime(n.freq, now + n.time);

          gain.gain.setValueAtTime(0.001, now + n.time);
          gain.gain.exponentialRampToValueAtTime(0.2, now + n.time + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(now + n.time);
          osc.stop(now + n.time + n.dur + 0.05);

          this.activeOscillators.push(osc);
        });
      } catch (err) {
        console.warn('Audio ringtone error:', err);
      }
    };

    playMelodyBurst();
    this.currentInterval = setInterval(playMelodyBurst, 2500);
  }

  /**
   * Plays a 3-beep busy/hangup tone to indicate the call has ended or was declined.
   */
  public playHangupTone() {
    this.stopAllRings();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const beeps = [0, 0.25, 0.5];
      const now = ctx.currentTime;

      beeps.forEach(offset => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now + offset);

        gain.gain.setValueAtTime(0.12, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
      });
    } catch (err) {
      console.warn('Hangup sound error:', err);
    }
  }

  /**
   * Immediately stops all ringing sounds and timers.
   */
  public stopAllRings() {
    this.isRinging = false;
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];
  }
}

export const sound = new SoundService();
