import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Song, Setlist, SetlistItem, TimeSignature } from '../types';
import { metronome } from '../utils/metronome';
import type { BeatEvent } from '../utils/metronome';
import { useWakeLock } from '../hooks/useWakeLock';
import { 
  X, Play, Square, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Radio, Sparkles, Music, 
  Minus, Plus, ShieldCheck
} from 'lucide-react';
import { AudioPracticePlayer } from './AudioPracticePlayer';

interface Props {
  setlist: Setlist;
  songsMap: Map<string, Song>;
  initialSongIndex?: number;
  onExit: () => void;
  onUpdateSong: (song: Song) => void;
}

export const StageModeView: React.FC<Props> = ({
  setlist,
  songsMap,
  initialSongIndex = 0,
  onExit,
  onUpdateSong,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialSongIndex);
  const [isMetronomeRunning, setIsMetronomeRunning] = useState(false);
  const [currentBeat, setCurrentBeat] = useState<BeatEvent | null>(null);
  const [activeBpm, setActiveBpm] = useState<number>(120);
  const [activeTimeSignature, setActiveTimeSignature] = useState<TimeSignature>('4/4');
  const [isMuted, setIsMuted] = useState(false);
  const [showAudioDrawer, setShowAudioDrawer] = useState(false);

  // Keep screen awake
  const { isActive: isWakeLockActive } = useWakeLock(true);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<number | null>(null);

  const currentItem: SetlistItem | undefined = setlist.items[currentIndex];
  const currentSong: Song | undefined = currentItem ? songsMap.get(currentItem.songId) : undefined;
  const nextItem: SetlistItem | undefined = setlist.items[currentIndex + 1];
  const nextSong: Song | undefined = nextItem ? songsMap.get(nextItem.songId) : undefined;

  // Sync song attributes when navigating
  useEffect(() => {
    if (currentSong) {
      const bpm = currentItem?.customBpm || currentSong.bpm;
      setActiveBpm(bpm);
      setActiveTimeSignature(currentSong.timeSignature);
      metronome.setBpm(bpm);
      metronome.setTimeSignature(currentSong.timeSignature);

      // Stop metronome automatically when switching song to avoid tempo confusion
      if (metronome.getIsRunning()) {
        metronome.stop();
        setIsMetronomeRunning(false);
        setCurrentBeat(null);
      }
    }
  }, [currentIndex, currentSong, currentItem]);

  // Metronome beat callback for visual flash
  useEffect(() => {
    metronome.setCallback((beat: BeatEvent) => {
      setCurrentBeat(beat);
    });

    return () => {
      metronome.stop();
      metronome.setCallback(null);
    };
  }, []);

  const toggleMetronome = useCallback(() => {
    if (isMetronomeRunning) {
      metronome.stop();
      setIsMetronomeRunning(false);
      setCurrentBeat(null);
    } else {
      metronome.start(activeBpm);
      setIsMetronomeRunning(true);
    }
  }, [isMetronomeRunning, activeBpm]);

  // Adjust BPM
  const adjustBpm = (delta: number) => {
    const newBpm = Math.max(30, Math.min(300, activeBpm + delta));
    setActiveBpm(newBpm);
    metronome.setBpm(newBpm);
  };

  // Tap Tempo calculation
  const handleTapTempo = () => {
    const now = Date.now();
    const tapTimes = tapTimesRef.current;

    // Reset if last tap was more than 2 seconds ago
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);

    if (tapTimeoutRef.current) {
      window.clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = window.setTimeout(() => {
      tapTimesRef.current = [];
    }, 2500);

    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        setActiveBpm(calculatedBpm);
        metronome.setBpm(calculatedBpm);
      }
    }
  };

  const handleNextSong = () => {
    if (currentIndex < setlist.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Keyboard navigation for stage use (Space = Click toggle, Arrow keys = song nav)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleMetronome();
      } else if (e.code === 'ArrowRight' || e.code === 'PageDown') {
        handleNextSong();
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') {
        handlePrevSong();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const beatsPerBar = metronome.getBeatsPerBar();

  if (!currentSong) {
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <p className="text-xl text-neutral-400 mb-4">Setlist ini belum memiliki lagu.</p>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-amber-500 text-black font-bold rounded-xl"
        >
          Kembali ke Pengaturan Setlist
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 text-neutral-100 flex flex-col z-50 select-none overflow-hidden font-sans">
      {/* 1. TOP STATUS BAR */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-black/80 border-b border-neutral-850 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition"
          >
            <X className="w-4 h-4" />
            Keluar Stage
          </button>
          
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400">
            <span className="font-bold text-amber-400">{setlist.title}</span>
          </div>
        </div>

        {/* Center: Song Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">
            Lagu <strong className="text-amber-400 text-sm">{currentIndex + 1}</strong> dari {setlist.items.length}
          </span>
        </div>

        {/* Right: Wake lock indicator */}
        <div className="flex items-center gap-2">
          <div 
            title="Layar tetap menyala di panggung"
            className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-emerald-400"
          >
            <span className={`w-2 h-2 rounded-full ${isWakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Screen Awake</span>
          </div>

          <button
            onClick={() => {
              const newMute = !isMuted;
              setIsMuted(newMute);
              metronome.setSound(newMute ? 'silent' : 'woodblock');
            }}
            title={isMuted ? 'Unmute Audio Click' : 'Mute Audio Click (Visual Only)'}
            className={`p-2 rounded-lg border text-xs font-semibold transition ${
              isMuted 
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. MAIN STAGE CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 flex flex-col justify-between max-w-5xl mx-auto w-full">
        
        {/* SONG HEADER */}
        <div className="text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-neutral-900">
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {activeTimeSignature}
              </span>
              {currentSong.key && (
                <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Key: {currentSong.key}
                </span>
              )}
              {currentItem?.customNotes && (
                <span className="px-2.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30">
                  ⚠️ {currentItem.customNotes}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md">
              {currentSong.title}
            </h1>
            <p className="text-sm sm:text-base text-neutral-400 font-medium mt-0.5">
              {currentSong.artist}
            </p>
          </div>

          {/* Practice Drawer Toggle */}
          {(currentSong.youtubeUrl || currentSong.audioUrl) && (
            <button
              onClick={() => setShowAudioDrawer(!showAudioDrawer)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition shadow-lg ${
                showAudioDrawer
                  ? 'bg-amber-500 text-neutral-950 border-amber-400'
                  : 'bg-neutral-900 text-neutral-200 border-neutral-800 hover:bg-neutral-800'
              }`}
            >
              <Music className="w-4 h-4" />
              {showAudioDrawer ? 'Tutup Audio / Video' : 'Buka Audio / Video Latihan'}
            </button>
          )}
        </div>

        {/* OPTIONAL AUDIO DRAWER */}
        {showAudioDrawer && (
          <div className="my-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <AudioPracticePlayer
              song={currentSong}
              compact={true}
              onUpdateSongAudio={(updates) => onUpdateSong({ ...currentSong, ...updates })}
            />
          </div>
        )}

        {/* 3. CENTERSTAGE: METRONOME ENGINE & VISUAL PULSE */}
        <div className="my-4 p-5 sm:p-7 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 shadow-2xl backdrop-blur-sm flex flex-col items-center">
          
          {/* VISUAL BEAT PULSE ROW */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 mb-5 w-full">
            {Array.from({ length: beatsPerBar }).map((_, i) => {
              const beatNum = i + 1;
              const isCurrent = currentBeat?.beatNumber === beatNum && isMetronomeRunning;
              const isAccentBeat = beatNum === 1;

              return (
                <div
                  key={beatNum}
                  className={`flex flex-col items-center justify-center transition-all duration-75 ${
                    isCurrent
                      ? isAccentBeat
                        ? 'scale-125 beat-pulse text-red-400'
                        : 'scale-120 beat-pulse text-emerald-400'
                      : 'opacity-40 text-neutral-500'
                  }`}
                >
                  <div
                    className={`w-10 h-10 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black font-mono text-lg sm:text-xl border-2 transition-all shadow-lg ${
                      isCurrent
                        ? isAccentBeat
                          ? 'bg-red-500 text-white border-red-300 shadow-red-500/50'
                          : 'bg-emerald-500 text-black border-emerald-300 shadow-emerald-500/50'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {beatNum}
                  </div>
                  <span className="text-[10px] font-mono mt-1 text-neutral-400">
                    {isAccentBeat ? 'ONE' : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* HUGE BPM & CONTROLS */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 w-full">
            
            {/* BPM Adjusters */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjustBpm(-5)}
                className="w-11 h-11 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-sm active:scale-95 transition"
                title="-5 BPM"
              >
                -5
              </button>
              <button
                onClick={() => adjustBpm(-1)}
                className="w-11 h-11 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95 transition"
                title="-1 BPM"
              >
                <Minus className="w-5 h-5" />
              </button>

              {/* Big BPM Display */}
              <div className="flex flex-col items-center px-4 py-1 min-w-[150px]">
                <span className="text-6xl sm:text-8xl font-black font-mono tracking-tighter text-amber-400">
                  {activeBpm}
                </span>
                <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase -mt-1 font-bold">
                  BPM (Tempo)
                </span>
              </div>

              <button
                onClick={() => adjustBpm(1)}
                className="w-11 h-11 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95 transition"
                title="+1 BPM"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={() => adjustBpm(5)}
                className="w-11 h-11 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-sm active:scale-95 transition"
                title="+5 BPM"
              >
                +5
              </button>
            </div>

            {/* Tap Tempo & Giant Metronome Trigger Button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleTapTempo}
                className="px-5 py-3.5 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-750 text-neutral-200 rounded-xl font-mono text-xs font-bold transition flex flex-col items-center gap-1 shadow-md active:scale-95"
              >
                <Radio className="w-4 h-4 text-amber-400" />
                <span>TAP TEMPO</span>
              </button>

              {/* GIANT PLAY/STOP CLICK BUTTON */}
              <button
                onClick={toggleMetronome}
                className={`px-8 py-5 rounded-2xl font-black text-lg sm:text-xl flex items-center gap-3 shadow-2xl transition transform active:scale-95 ${
                  isMetronomeRunning
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/30'
                }`}
              >
                {isMetronomeRunning ? (
                  <>
                    <Square className="w-6 h-6 fill-current" />
                    <span>STOP CLICK</span>
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    <span>START CLICK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4. DRUM CUE SHEET / STRUCTURE NOTE */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-xl flex-1 min-h-[160px] flex flex-col justify-start">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Struktur & Catatan Drum (Cue Sheet)
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {currentSong.timeSignature} | {activeBpm} BPM
            </span>
          </div>

          <div className="font-mono text-sm sm:text-base leading-relaxed text-neutral-200 whitespace-pre-wrap overflow-y-auto max-h-[220px]">
            {currentSong.drumNotes || (
              <span className="text-neutral-500 italic">
                Belum ada catatan drum untuk lagu ini. Anda bisa mengisinya dari dashboard komputer.
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 5. FOOTER PEDAL-STYLE NAVIGATION */}
      <div className="p-3 sm:p-4 bg-black/95 border-t border-neutral-850 flex items-center justify-between gap-3">
        {/* Previous Song Pedal */}
        <button
          onClick={handlePrevSong}
          disabled={currentIndex === 0}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 sm:py-4 px-4 rounded-xl font-bold text-sm sm:text-base transition border ${
            currentIndex === 0
              ? 'opacity-30 border-neutral-900 bg-neutral-950 text-neutral-600 cursor-not-allowed'
              : 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 active:scale-98'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span>Lagu Sebelumnya</span>
        </button>

        {/* Next Song Pedal */}
        <button
          onClick={handleNextSong}
          disabled={currentIndex === setlist.items.length - 1}
          className={`flex-1 flex items-center justify-between py-3.5 sm:py-4 px-5 rounded-xl font-bold text-sm sm:text-base transition border shadow-xl ${
            currentIndex === setlist.items.length - 1
              ? 'opacity-30 border-neutral-900 bg-neutral-950 text-neutral-600 cursor-not-allowed'
              : 'border-amber-500/40 bg-amber-500 hover:bg-amber-400 text-neutral-950 active:scale-98'
          }`}
        >
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-80">
              Berikutnya ({currentIndex + 2}/{setlist.items.length})
            </span>
            <span className="truncate max-w-[180px] sm:max-w-[280px]">
              {nextSong ? nextSong.title : 'Selesai'}
            </span>
          </div>
          <ChevronRight className="w-6 h-6 shrink-0" />
        </button>
      </div>
    </div>
  );
};
