import type { MetronomeSound, TimeSignature } from '../types';

export interface BeatEvent {
  beatNumber: number; // 1-indexed (1, 2, 3, 4...)
  totalBeats: number; // Total beats in bar (e.g. 4 for 4/4, 6 for 6/8)
  isAccent: boolean; // true for beat 1
  time: number;
}

export type BeatCallback = (event: BeatEvent) => void;

export class MetronomeEngine {
  private audioContext: AudioContext | null = null;
  private isRunning: boolean = false;
  private bpm: number = 120;
  private timeSignature: TimeSignature = '4/4';
  private sound: MetronomeSound = 'woodblock';
  private volume: number = 0.8;

  private currentBeat: number = 0; // 0-indexed
  private nextNoteTime: number = 0.0; // in AudioContext time
  private timerWorkerId: number | null = null;
  private lookahead: number = 25.0; // ms
  private scheduleAheadTime: number = 0.1; // seconds

  private onBeatCallback: BeatCallback | null = null;

  private initAudio() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public setCallback(callback: BeatCallback | null) {
    this.onBeatCallback = callback;
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(300, Math.round(newBpm)));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setTimeSignature(sig: TimeSignature) {
    this.timeSignature = sig;
  }

  public setSound(sound: MetronomeSound) {
    this.sound = sound;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getBeatsPerBar(): number {
    switch (this.timeSignature) {
      case '2/4': return 2;
      case '3/4': return 3;
      case '4/4': return 4;
      case '5/4': return 5;
      case '6/8': return 6;
      case '12/8': return 12;
      default: return 4;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
    const beatsPerBar = this.getBeatsPerBar();
    const isAccent = beatNumber === 0;

    // Trigger visual callback at the scheduled time
    if (this.onBeatCallback && this.audioContext) {
      const timeUntilNote = (time - this.audioContext.currentTime) * 1000;
      setTimeout(() => {
        if (this.isRunning && this.onBeatCallback) {
          this.onBeatCallback({
            beatNumber: beatNumber + 1,
            totalBeats: beatsPerBar,
            isAccent,
            time
          });
        }
      }, Math.max(0, timeUntilNote));
    }

    // If sound is silent, skip audio generation
    if (this.sound === 'silent' || this.volume <= 0.001 || !this.audioContext) {
      return;
    }

    const ctx = this.audioContext;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    // Custom sound synthesis
    if (this.sound === 'woodblock') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';

      const baseFreq = isAccent ? 1200 : 800;
      osc.frequency.setValueAtTime(baseFreq, time);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, time + 0.04);

      gainNode.gain.setValueAtTime(this.volume * (isAccent ? 1.0 : 0.7), time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      osc.connect(gainNode);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (this.sound === 'beep') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, time);

      gainNode.gain.setValueAtTime(this.volume * (isAccent ? 1.0 : 0.6), time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      osc.connect(gainNode);
      osc.start(time);
      osc.stop(time + 0.035);
    } else if (this.sound === 'cowbell') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isAccent ? 850 : 620, time);
      filter.Q.setValueAtTime(3, time);

      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(isAccent ? 587 : 540, time);
      osc2.frequency.setValueAtTime(isAccent ? 845 : 800, time);

      gainNode.gain.setValueAtTime(this.volume * (isAccent ? 0.9 : 0.6), time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.08);
      osc2.stop(time + 0.08);
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isAccent ? 2200 : 1400, time);

      gainNode.gain.setValueAtTime(this.volume * (isAccent ? 1.0 : 0.6), time);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

      osc.connect(gainNode);
      osc.start(time);
      osc.stop(time + 0.02);
    }
  }

  private nextNote() {
    const beatsPerBar = this.getBeatsPerBar();
    
    let secondsPerBeat = 60.0 / this.bpm;
    if (this.timeSignature === '6/8' || this.timeSignature === '12/8') {
      secondsPerBeat = (60.0 / this.bpm) / 1.5;
    }

    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % beatsPerBar;
  }

  private scheduler() {
    if (!this.audioContext) return;

    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.nextNote();
    }
  }

  public start(startBpm?: number) {
    if (this.isRunning) return;
    this.initAudio();

    if (startBpm) {
      this.setBpm(startBpm);
    }

    this.isRunning = true;
    this.currentBeat = 0;
    if (this.audioContext) {
      this.nextNoteTime = this.audioContext.currentTime + 0.05;
    }

    this.timerWorkerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookahead);
  }

  public stop() {
    this.isRunning = false;
    if (this.timerWorkerId !== null) {
      clearInterval(this.timerWorkerId);
      this.timerWorkerId = null;
    }
  }

  public toggle(): boolean {
    if (this.isRunning) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }
}

export const metronome = new MetronomeEngine();
