
// A simple synthesizer to avoid external asset dependencies
class AudioService {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    // Lazy init on first interaction
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
    }
  }

  public resume() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playSelect() {
    this.playTone(800, 'sine', 0.1);
  }

  public playSwap() {
    this.playTone(600, 'triangle', 0.15, 0, 0.05);
  }

  public playMatch(combo: number) {
    const baseFreq = 400 + (combo * 50);
    // Play a chord-like sound
    this.playTone(baseFreq, 'sine', 0.3);
    this.playTone(baseFreq * 1.5, 'sine', 0.3, 0.05);
    this.playTone(baseFreq * 2, 'sine', 0.3, 0.1);
  }

  public playInvalid() {
    this.playTone(200, 'sawtooth', 0.2);
    this.playTone(150, 'sawtooth', 0.2, 0.1);
  }

  public playExplosion() {
    if (!this.ctx || !this.gainNode) {
        this.init();
    }
    if (!this.ctx || !this.gainNode) return;

    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // White noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.gainNode);
    
    noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
    
    noise.start();
  }

  public playReshuffle() {
    this.playTone(300, 'sine', 0.5, 0, 800);
    this.playTone(305, 'sine', 0.5, 0.05, 805);
  }

  public playLevelUp() {
     if (!this.ctx || !this.gainNode) { this.init(); }
     if (!this.ctx || !this.gainNode) return;

     // Play a joyful C Major Arpeggio: C5 - E5 - G5 - C6
     const now = this.ctx.currentTime;
     const notes = [523.25, 659.25, 783.99, 1046.50];
     
     notes.forEach((freq, index) => {
         const osc = this.ctx!.createOscillator();
         const gain = this.ctx!.createGain();
         
         osc.type = 'triangle'; // Brighter sound
         osc.frequency.setValueAtTime(freq, now + index * 0.1);
         
         osc.connect(gain);
         gain.connect(this.gainNode!);
         
         // Envelope
         gain.gain.setValueAtTime(0, now + index * 0.1);
         gain.gain.linearRampToValueAtTime(0.2, now + index * 0.1 + 0.05);
         gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.4);
         
         osc.start(now + index * 0.1);
         osc.stop(now + index * 0.1 + 0.5);
     });
     
     // Add a sparkly sweep
     const sweepOsc = this.ctx.createOscillator();
     const sweepGain = this.ctx.createGain();
     sweepOsc.type = 'sine';
     sweepOsc.frequency.setValueAtTime(800, now);
     sweepOsc.frequency.exponentialRampToValueAtTime(2000, now + 0.5);
     
     sweepOsc.connect(sweepGain);
     sweepGain.connect(this.gainNode);
     
     sweepGain.gain.setValueAtTime(0.05, now);
     sweepGain.gain.linearRampToValueAtTime(0, now + 0.5);
     
     sweepOsc.start(now);
     sweepOsc.stop(now + 0.5);
  }

  private playTone(freq: number, type: OscillatorType, duration: number, delay = 0, slideTo?: number) {
    if (!this.ctx || !this.gainNode) {
        this.init();
    }
    if (!this.ctx || !this.gainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.connect(gain);
    gain.connect(this.gainNode);

    const now = this.ctx.currentTime + delay;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
       osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }
}

export const audioService = new AudioService();
