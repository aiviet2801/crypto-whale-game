export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlockedByGesture = false;
  private boostGain: GainNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostSource: AudioBufferSourceNode | null = null;
  private boostOsc: OscillatorNode | null = null;
  private boostActive = false;
  private comboCount = 0;
  private lastPopTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || !this.unlockedByGesture) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.unlockedByGesture = true;
    this.ensureContext();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopLoops();
    }
  }

  public stopLoops(): void {
    this.setBoostActive(false);
  }

  public playPelletPop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastPopTime < 0.55) {
      this.comboCount = Math.min(14, this.comboCount + 1);
    } else {
      this.comboCount = 0;
    }
    this.lastPopTime = now;

    const jitter = 0.94 + Math.random() * 0.12;
    const baseFreq = (420 + this.comboCount * 38) * jitter;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.065);

    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCoinAbsorb(absorbedMass: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.comboCount = Math.min(16, this.comboCount + 2);
    this.lastPopTime = now;

    const weightFactor = Math.min(1, absorbedMass / 350);
    const rootFreq = (280 + this.comboCount * 22 - weightFactor * 110) * (0.95 + Math.random() * 0.1);

    // Bubbly core pop
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(rootFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(rootFreq * 2.1, now + 0.11);

    gain1.gain.setValueAtTime(0.16, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Sub punch for larger kills
    if (absorbedMass >= 45) {
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(125, now);
      sub.frequency.exponentialRampToValueAtTime(48, now + 0.16);
      subGain.gain.setValueAtTime(0.18 * (0.4 + weightFactor * 0.6), now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.19);
    }
  }

  public playTierEvolve(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392, 493.88, 587.33, 783.99];
    for (let i = 0; i < notes.length; i++) {
      const start = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.23);
    }
  }

  public setBoostActive(active: boolean): void {
    if (this.muted) active = false;
    if (active === this.boostActive) return;
    this.boostActive = active;

    if (!active) {
      if (this.boostGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.boostGain.gain.cancelScheduledValues(now);
        this.boostGain.gain.setTargetAtTime(0.0001, now, 0.04);
      }
      const src = this.boostSource;
      const osc = this.boostOsc;
      this.boostSource = null;
      this.boostOsc = null;
      this.boostGain = null;
      this.boostFilter = null;
      setTimeout(() => {
        try {
          src?.stop();
          osc?.stop();
        } catch {
          // ignore
        }
      }, 120);
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      this.boostActive = false;
      return;
    }

    const now = ctx.currentTime;
    // Create filtered noise whoosh buffer
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + 0.25);
    filter.Q.value = 1.8;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(86, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.3);

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.25;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.095, now + 0.08);

    source.connect(filter);
    osc.connect(oscGain);
    oscGain.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.start(now);
    osc.start(now);

    this.boostSource = source;
    this.boostOsc = osc;
    this.boostFilter = filter;
    this.boostGain = masterGain;
  }

  public playLiquidationCrash(): void {
    this.stopLoops();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Sub-bass drop
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.52);
    subGain.gain.setValueAtTime(0.24, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.58);

    // Filtered noise shatter
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.42);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.26, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Descending warning chord
    const tones = [311.13, 233.08, 155.56];
    for (let i = 0; i < tones.length; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(tones[i], now + i * 0.04);
      o.frequency.exponentialRampToValueAtTime(tones[i] * 0.65, now + 0.4);
      g.gain.setValueAtTime(0.055, now + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + i * 0.04);
      o.stop(now + 0.44);
    }
  }

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.035);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playRugPullAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [340, 210];
    for (let i = 0; i < freqs.length; i++) {
      const start = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i], start);
      osc.frequency.exponentialRampToValueAtTime(freqs[i] * 0.58, start + 0.14);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.17);
    }
  }

  public playBullRunFanfare(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < chord.length; i++) {
      const start = now + i * 0.048;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(chord[i], start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    }
  }

  public playFireworkPop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = 780 + Math.random() * 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.85, now + 0.09);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}
