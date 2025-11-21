
import { PowerUpType } from "../types";

// Utility: MIDI to Frequency
const m2f = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

// Scales (Am9 compatible)
// Root A = 57
const SCALE_P1 = [64, 67, 69, 71, 74, 76]; // E4, G4, A4, B4, D5, E5 (Pentatonic high)
const SCALE_P2 = [45, 48, 52];             // A2, C3, E3 (Low Triad)
const SCALE_P3 = [52, 55, 57, 59, 60];     // E3, G3, A3, B3, C4 (Mid-Low texture)
const SCALE_P4 = [55, 59, 62, 64];         // G3, B3, D4, E4 (Warm mid)

interface PlayerChannelState {
  nextTriggerTime: number;
  targetVolume: number;
  activeNodes: AudioNode[];
}

/**
 * A Vangelis-inspired generative sound engine.
 * Redesigned to be sparse, ambient, and procedural.
 */
export class SoundEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  
  private playerChannels: PlayerChannelState[] = [];
  private isMuted: boolean = false;
  private schedulerInterval: any = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Compressor to prevent clipping and harshness
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Initialize Channel States
    for(let i=0; i<4; i++) {
        this.playerChannels.push({
            nextTriggerTime: 0,
            targetVolume: 0,
            activeNodes: []
        });
    }
  }

  public async initialize() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public startMusic() {
    if (this.isMuted) return;
    this.stopMusic();

    this.startDrone();
    this.startScheduler();
  }

  private startDrone() {
    const now = this.ctx.currentTime;
    
    // Very subtle background bed
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc1.frequency.value = 55; // A1

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 55.5; // Detuned

    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 120; // Very dark
    this.droneFilter.Q.value = 0;

    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.15;

    this.droneOsc1.connect(this.droneFilter);
    this.droneOsc2.connect(this.droneFilter);
    this.droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain);

    this.droneOsc1.start(now);
    this.droneOsc2.start(now);
  }

  private startScheduler() {
     // Reset trigger times
     const now = this.ctx.currentTime;
     this.playerChannels.forEach(ch => ch.nextTriggerTime = now + Math.random());

     // Simple loop to check for triggers
     this.schedulerInterval = setInterval(() => {
         this.processScheduler();
     }, 100);
  }

  private processScheduler() {
      if (this.isMuted) return;
      const now = this.ctx.currentTime;
      
      this.playerChannels.forEach((ch, index) => {
          if (now >= ch.nextTriggerTime) {
              this.triggerPlayerPhrase(index, ch);
          }
      });
  }

  private triggerPlayerPhrase(index: number, ch: PlayerChannelState) {
      // If volume is effectively zero, just reschedule and return (save CPU)
      // But we allow occasional sparse notes even at low volume for presence
      const effectiveVol = Math.max(ch.targetVolume, 0.05); 

      switch(index) {
          case 0: this.playP1Phrase(effectiveVol); break;
          case 1: this.playP2Phrase(effectiveVol); break;
          case 2: this.playP3Phrase(effectiveVol); break;
          case 3: this.playP4Phrase(effectiveVol); break;
      }

      // Reschedule based on rhythm personality
      let delay = 0;
      switch(index) {
          case 0: delay = 1.5 + Math.random() * 2; break; // Faster, twitchy
          case 1: delay = 4.0 + Math.random() * 4; break; // Slow, long intervals
          case 2: delay = 2.0 + Math.random() * 3; break; // Medium
          case 3: delay = 3.0 + Math.random() * 3; break; // Floating
      }
      ch.nextTriggerTime = this.ctx.currentTime + delay;
  }

  // P1 (Cyan): Bright, soft bells (Sine/Triangle mix). Short Arpeggios.
  private playP1Phrase(volume: number) {
      const now = this.ctx.currentTime;
      const count = 1 + Math.floor(Math.random() * 3); // 1 to 3 notes
      
      for(let i=0; i<count; i++) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const note = SCALE_P1[Math.floor(Math.random() * SCALE_P1.length)];
          
          osc.type = 'sine';
          osc.frequency.value = m2f(note);
          
          const t = now + (i * 0.15); // Fast succession
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(volume * 0.3, t + 0.02); // Attack
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8); // Decay

          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(t);
          osc.stop(t + 1);
      }
  }

  // P2 (Magenta): Deep Bass Swell (Sawtooth lowpassed).
  private playP2Phrase(volume: number) {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      
      const note = SCALE_P2[Math.floor(Math.random() * SCALE_P2.length)];
      
      osc.type = 'sawtooth';
      osc.frequency.value = m2f(note);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.linearRampToValueAtTime(600, now + 1); // Filter sweep up
      filter.frequency.linearRampToValueAtTime(200, now + 4); // Sweep down

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + 1); // Slow attack
      gain.gain.linearRampToValueAtTime(0, now + 4); // Slow release

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(now);
      osc.stop(now + 4.5);
  }

  // P3 (Lime): Woody/Plucked (Square with heavy filter). Rhythmic.
  private playP3Phrase(volume: number) {
      const now = this.ctx.currentTime;
      const note = SCALE_P3[Math.floor(Math.random() * SCALE_P3.length)];
      
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.value = m2f(note);

      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 2;

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume * 0.25, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4); // Short pluck

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.5);
  }

  // P4 (Amber): Glassy Pad (Triangle).
  private playP4Phrase(volume: number) {
      const now = this.ctx.currentTime;
      // Play a chord (2 notes)
      const rootIdx = Math.floor(Math.random() * (SCALE_P4.length - 1));
      const notes = [SCALE_P4[rootIdx], SCALE_P4[rootIdx + 1]];

      notes.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = m2f(note);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume * 0.2, now + 1);
        gain.gain.linearRampToValueAtTime(0, now + 3);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 3.5);
      });
  }

  // Called every frame to update volume targets based on score
  public updateLeitmotifs(scores: number[]) {
    const total = scores.reduce((a, b) => a + b, 0) || 1;
    // Normalize scores to determine dominance
    scores.forEach((score, i) => {
        // Target volume is proportional to score share
        // Min 0.1, Max 0.5
        const share = score / total;
        this.playerChannels[i].targetVolume = 0.1 + (share * 0.4); 
    });
  }

  public pulseEngine(playerId: number) {
     // No-op in this new design, or could trigger a very subtle effect
     // We want to avoid "ear shattering" accumulation, so better to keep it clean.
  }

  public stopMusic() {
    if (this.schedulerInterval) {
        clearInterval(this.schedulerInterval);
        this.schedulerInterval = null;
    }
    try {
        if (this.droneOsc1) { this.droneOsc1.stop(); this.droneOsc1.disconnect(); }
        if (this.droneOsc2) { this.droneOsc2.stop(); this.droneOsc2.disconnect(); }
    } catch(e) {}
  }

  public playClaimSound(isFresh: boolean) {
    if (this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    // Lower pitched, softer claim sounds
    if (isFresh) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.1, now); 
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    }

    osc.start();
    osc.stop(now + 0.25);
  }

  public playPowerUpSpawn() {
      if (this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Softer chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(660, now + 0.3); 
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.15);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(now + 0.35);
  }

  public playPowerUpCollect(type: PowerUpType) {
      if (this.isMuted) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.masterGain);

      // Avoid high frequencies > 1000Hz
      switch (type) {
          case PowerUpType.LIGHTNING:
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(440, now);
              osc.frequency.linearRampToValueAtTime(110, now + 0.3);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
              break;
          case PowerUpType.BOMB:
              osc.type = 'square';
              osc.frequency.setValueAtTime(150, now);
              osc.frequency.exponentialRampToValueAtTime(50, now + 0.4);
              gain.gain.setValueAtTime(0.15, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
              break;
          case PowerUpType.SPEED:
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(330, now);
              osc.frequency.linearRampToValueAtTime(660, now + 0.2);
              gain.gain.setValueAtTime(0.1, now);
              gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
              break;
      }

      osc.start();
      osc.stop(now + 0.5);
  }

  public playWinRound() {
    if (this.isMuted) return;
    // A pleasing chord instead of a harsh run
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25].forEach((freq, i) => { // A Majorish
         const osc = this.ctx.createOscillator();
         const gain = this.ctx.createGain();
         osc.type = 'sine';
         osc.frequency.value = freq;
         osc.connect(gain);
         gain.connect(this.masterGain);
         gain.gain.setValueAtTime(0, now);
         gain.gain.linearRampToValueAtTime(0.1, now + 0.2 + (i*0.1));
         gain.gain.linearRampToValueAtTime(0, now + 2);
         osc.start(now);
         osc.stop(now + 2.1);
    });
  }

  public playGameOver() {
    // ... keep existing or soften ...
    // Just stopping music is often enough, maybe a low boom.
    this.stopMusic();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.stopMusic();
    } else {
        this.masterGain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.1);
        if (this.playerChannels.length > 0) this.startMusic();
    }
  }
}

export const soundEngine = new SoundEngine();
