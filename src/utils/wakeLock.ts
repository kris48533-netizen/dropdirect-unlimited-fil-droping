// Screen Wake Lock & Background Heartbeat Manager
// Prevents PC from sleeping and prevents browser tabs from being throttled/frozen when user is AFK

class WakeLockManager {
  private wakeLock: any = null;
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private isActive = false;

  public async acquire() {
    this.isActive = true;

    // 1. Request Screen Wake Lock
    if ("wakeLock" in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request("screen");
        this.wakeLock.addEventListener("release", () => {
          this.wakeLock = null;
          // Re-acquire if still marked active and page is visible
          if (this.isActive && document.visibilityState === "visible") {
            this.acquire();
          }
        });
      } catch (err) {
        // WakeLock request failed (e.g. battery saver mode or low power)
      }
    }

    // 2. Prevent Background Tab Throttling using inaudible AudioContext keepalive
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          // Create an inaudible gain node (volume = 0.00001) to keep the audio pipeline active
          const gainNode = this.audioContext.createGain();
          gainNode.gain.value = 0.00001;
          gainNode.connect(this.audioContext.destination);

          this.oscillator = this.audioContext.createOscillator();
          this.oscillator.type = "sine";
          this.oscillator.frequency.value = 440;
          this.oscillator.connect(gainNode);
          this.oscillator.start();
        }
      }
      if (this.audioContext && this.audioContext.state === "suspended") {
        this.audioContext.resume().catch(() => {});
      }
    } catch (e) {
      // AudioContext policy
    }
  }

  public release() {
    this.isActive = false;

    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch (e) {
        // ignore
      }
      this.wakeLock = null;
    }

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {
        // ignore
      }
      this.oscillator = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close().catch(() => {});
      } catch (e) {
        // ignore
      }
      this.audioContext = null;
    }
  }

  public handleVisibilityChange() {
    if (this.isActive && document.visibilityState === "visible" && !this.wakeLock) {
      this.acquire();
    }
  }
}

export const wakeLockManager = new WakeLockManager();

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    wakeLockManager.handleVisibilityChange();
  });
  window.addEventListener("focus", () => {
    wakeLockManager.handleVisibilityChange();
  });
}
