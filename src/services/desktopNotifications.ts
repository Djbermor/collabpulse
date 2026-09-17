// Nexora Desktop & Audio Notification Service

class DesktopNotificationService {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private ringbackInterval: any = null;

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Request browser permission for HTML5 Desktop Notifications
  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch {
        return false;
      }
    }
    return false;
  }

  // Show a native desktop notification if tab is in background or permission is granted
  public showNotification(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      tag?: string;
      onClick?: () => void;
      requireInteraction?: boolean;
    }
  ): Notification | null {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const notif = new Notification(title, {
        body: options?.body || '',
        icon: options?.icon || '/nexora-icon.svg',
        tag: options?.tag,
        requireInteraction: options?.requireInteraction ?? false
      });

      notif.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (options?.onClick) {
          options.onClick();
        }
        notif.close();
      };

      // Auto-close after 6 seconds if not interactive
      if (!options?.requireInteraction) {
        setTimeout(() => {
          try {
            notif.close();
          } catch {}
        }, 6000);
      }

      return notif;
    } catch (err) {
      console.warn('[DesktopNotifications] Failed to display notification:', err);
      return null;
    }
  }

  // Play subtle ping for general incoming messages or notifications
  public playMessageChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.29);
    } catch {}
  }

  // Play incoming ringtone loop
  public startIncomingCallRingtone() {
    this.stopIncomingCallRingtone();
    const playRingCycle = () => {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        // Two-tone harmonic ring
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.2, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      } catch {}
    };

    playRingCycle();
    this.ringtoneInterval = setInterval(playRingCycle, 2500);
  }

  public stopIncomingCallRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  // Play outgoing ringback tone (soft periodic beep)
  public startOutgoingRingbackTone() {
    this.stopOutgoingRingbackTone();
    const playBeep = () => {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.9);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.15);
      } catch {}
    };

    playBeep();
    this.ringbackInterval = setInterval(playBeep, 2800);
  }

  public stopOutgoingRingbackTone() {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
  }
}

export const desktopNotifications = new DesktopNotificationService();
