import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Song, Setlist, SetlistItem, TimeSignature } from '../types';
import { metronome } from '../utils/metronome';
import type { BeatEvent } from '../utils/metronome';
import { useWakeLock } from '../hooks/useWakeLock';
import { 
  X, Play, Square, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Radio, Sparkles, Music, 
  Minus, Plus, ShieldCheck, Zap, Maximize2, Minimize2, Type
} from 'lucide-react';
import { AudioPracticePlayer } from './AudioPracticePlayer';

export type CueFontSize = '14px' | '17px' | '20px' | '24px';
const FONT_SIZES: CueFontSize[] = ['14px', '17px', '20px', '24px'];

interface ParsedCueLine {
  type: 'section' | 'normal';
  tag?: string;
  details?: string;
  raw: string;
  badgeClass?: string;
}

const SECTION_KEYWORDS = [
  { test: /CHORUS|REFF|REFRAIN/i, name: 'CHORUS', badgeClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10' },
  { test: /PRE-?CHORUS/i, name: 'PRE-CHORUS', badgeClass: 'bg-yellow-500/25 text-yellow-300 border-yellow-500/40' },
  { test: /INTERLUDE/i, name: 'INTERLUDE', badgeClass: 'bg-teal-500/25 text-teal-300 border-teal-500/40 shadow-sm shadow-teal-500/10' },
  { test: /BRIDGE/i, name: 'BRIDGE', badgeClass: 'bg-purple-500/25 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10' },
  { test: /VERSE|BAIT/i, name: 'VERSE', badgeClass: 'bg-cyan-500/25 text-cyan-300 border-cyan-500/40' },
  { test: /INTRO/i, name: 'INTRO', badgeClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40' },
  { test: /OUTRO|ENDING/i, name: 'OUTRO', badgeClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40' },
  { test: /STOP|BREAK|REST|HOLD|DIAM/i, name: 'STOP / REST', badgeClass: 'bg-red-500/30 text-red-200 border-red-500/60 font-black' },
  { test: /BUILD|CRESCENDO|FILL/i, name: 'BUILD / FILL', badgeClass: 'bg-rose-500/25 text-rose-300 border-rose-500/40' },
  { test: /SOLO/i, name: 'SOLO', badgeClass: 'bg-sky-500/25 text-sky-300 border-sky-500/40' },
];

function parseCueLine(line: string): ParsedCueLine {
  if (!line.trim()) {
    return { type: 'normal', raw: '' };
  }

  // 1. Colon pattern: e.g. "• INTRO (4 bar): Snare rim..." or "VERSE 1: ..."
  const colonMatch = line.match(/^(\s*[•\-\*\d\.]*\s*)(\[?[^:\]\n]+?\]?)\s*[:]\s*(.*)$/);
  if (colonMatch) {
    const rawTag = colonMatch[2].trim().replace(/^\[|\]$/g, '');
    const matched = SECTION_KEYWORDS.find((k) => k.test.test(rawTag));
    if (matched) {
      return {
        type: 'section',
        tag: rawTag,
        details: colonMatch[3],
        raw: line,
        badgeClass: matched.badgeClass,
      };
    }
  }

  // 2. Bracket pattern: e.g. "[INTERLUDE] Bass solo only"
  const bracketMatch = line.match(/^(\s*[•\-\*\d\.]*\s*)\[([^\]]+)\]\s*(.*)$/);
  if (bracketMatch) {
    const rawTag = bracketMatch[2].trim();
    const matched = SECTION_KEYWORDS.find((k) => k.test.test(rawTag));
    if (matched) {
      return {
        type: 'section',
        tag: rawTag,
        details: bracketMatch[3],
        raw: line,
        badgeClass: matched.badgeClass,
      };
    }
  }

  // 3. Word match at start: e.g. "STOP - all rest" or "CHORUS 1 full groove"
  for (const k of SECTION_KEYWORDS) {
    const wordMatch = line.match(new RegExp('^(\\s*[•\\-\\d\\.]*\\s*)(' + k.name + '(?:\\s*\\d+)?)\\b\\s*(?:[-—:]\\s*)?(.*)$', 'i'));
    if (wordMatch) {
      return {
        type: 'section',
        tag: wordMatch[2].trim(),
        details: wordMatch[3],
        raw: line,
        badgeClass: k.badgeClass,
      };
    }
  }

  return { type: 'normal', raw: line };
}

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

  // Cue font size: 14px, 17px, 20px, 24px
  const [cueFontSize, setCueFontSize] = useState<CueFontSize>(() => {
    const saved = localStorage.getItem('stagebeat_cue_font_size');
    if (saved && (FONT_SIZES as string[]).includes(saved)) {
      return saved as CueFontSize;
    }
    return '17px';
  });

  // Focus Notes mode (compact metronome bar + expanded cue sheet)
  const [isFocusNotes, setIsFocusNotes] = useState<boolean>(() => {
    const saved = localStorage.getItem('stagebeat_focus_notes');
    return saved === 'true';
  });

  const handleDecreaseFontSize = () => {
    setCueFontSize((curr) => {
      const idx = FONT_SIZES.indexOf(curr);
      if (idx > 0) {
        const next = FONT_SIZES[idx - 1];
        localStorage.setItem('stagebeat_cue_font_size', next);
        return next;
      }
      return curr;
    });
  };

  const handleIncreaseFontSize = () => {
    setCueFontSize((curr) => {
      const idx = FONT_SIZES.indexOf(curr);
      if (idx < FONT_SIZES.length - 1) {
        const next = FONT_SIZES[idx + 1];
        localStorage.setItem('stagebeat_cue_font_size', next);
        return next;
      }
      return curr;
    });
  };

  const handleToggleFocusNotes = () => {
    setIsFocusNotes((prev) => {
      const next = !prev;
      localStorage.setItem('stagebeat_focus_notes', String(next));
      return next;
    });
  };

  // Auto start metronome preference (default: true for instant live playing)
  const [autoStartMetronome, setAutoStartMetronome] = useState<boolean>(() => {
    const saved = localStorage.getItem('stagebeat_auto_start_metronome');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAutoStart = () => {
    setAutoStartMetronome((prev) => {
      const next = !prev;
      localStorage.setItem('stagebeat_auto_start_metronome', String(next));
      return next;
    });
  };

  // Keep screen awake
  const { isActive: isWakeLockActive } = useWakeLock(true);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<number | null>(null);

  const currentItem: SetlistItem | undefined = setlist.items[currentIndex];
  const currentSong: Song | undefined = currentItem ? songsMap.get(currentItem.songId) : undefined;
  const nextItem: SetlistItem | undefined = setlist.items[currentIndex + 1];
  const nextSong: Song | undefined = nextItem ? songsMap.get(nextItem.songId) : undefined;

  // Sync song attributes when navigating or entering stage mode
  useEffect(() => {
    if (currentSong) {
      const bpm = currentItem?.customBpm || currentSong.bpm;
      setActiveBpm(bpm);
      setActiveTimeSignature(currentSong.timeSignature);
      metronome.setBpm(bpm);
      metronome.setTimeSignature(currentSong.timeSignature);

      if (autoStartMetronome) {
        // Automatically start / restart metronome for instant groove
        metronome.stop();
        metronome.start(bpm);
        setIsMetronomeRunning(true);
      } else {
        // If auto-start disabled, stop metronome when switching songs to avoid tempo confusion
        if (metronome.getIsRunning()) {
          metronome.stop();
          setIsMetronomeRunning(false);
          setCurrentBeat(null);
        }
      }
    }
  }, [currentIndex, currentSong, currentItem, autoStartMetronome]);

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

        {/* Right: Controls & Indicators */}
        <div className="flex items-center gap-2">
          {/* Auto-Metronome Toggle */}
          <button
            onClick={handleToggleAutoStart}
            title={autoStartMetronome ? 'Auto-Start Metronome Aktif (Klik untuk Matikan)' : 'Auto-Start Metronome Mati (Klik untuk Aktifkan)'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold transition ${
              autoStartMetronome
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${autoStartMetronome ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'}`} />
            <span className="hidden sm:inline">Auto-Click:</span>
            <span>{autoStartMetronome ? 'ON' : 'OFF'}</span>
          </button>

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
        {isFocusNotes ? (
          /* COMPACT METRONOME BAR (FOCUS NOTES MODE) */
          <div className="my-2 p-3 sm:p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 shadow-lg flex flex-wrap items-center justify-between gap-3">
            {/* Visual Beat Pulse Row (Always Blinking) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {Array.from({ length: beatsPerBar }).map((_, i) => {
                const beatNum = i + 1;
                const isCurrent = currentBeat?.beatNumber === beatNum && isMetronomeRunning;
                const isAccentBeat = beatNum === 1;

                return (
                  <div
                    key={beatNum}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black font-mono text-sm sm:text-base border-2 transition-all ${
                      isCurrent
                        ? isAccentBeat
                          ? 'bg-red-500 text-white border-red-300 shadow-red-500/50 scale-110'
                          : 'bg-emerald-500 text-black border-emerald-300 shadow-emerald-500/50 scale-110'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                    }`}
                  >
                    {beatNum}
                  </div>
                );
              })}
            </div>

            {/* Compact BPM & Playback Controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5">
                <button
                  onClick={() => adjustBpm(-1)}
                  className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white"
                  title="-1 BPM"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-black font-mono text-amber-400 text-base sm:text-lg min-w-[50px] text-center">
                  {activeBpm}
                </span>
                <button
                  onClick={() => adjustBpm(1)}
                  className="w-7 h-7 flex items-center justify-center text-neutral-400 hover:text-white"
                  title="+1 BPM"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleTapTempo}
                className="px-2.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg font-mono text-[11px] font-bold active:scale-95 transition"
                title="Tap Tempo"
              >
                TAP
              </button>

              <button
                onClick={toggleMetronome}
                className={`px-3.5 py-1.5 rounded-lg font-bold text-xs font-mono flex items-center gap-1.5 shadow-md transition active:scale-95 ${
                  isMetronomeRunning
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/30'
                }`}
              >
                {isMetronomeRunning ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>STOP</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>START</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD FULL METRONOME VIEW */
          <div className="my-3 sm:my-4 p-4 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 shadow-2xl backdrop-blur-sm flex flex-col items-center">
            {/* VISUAL BEAT PULSE ROW */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-5 mb-4 w-full">
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
                      className={`w-9 h-9 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black font-mono text-base sm:text-xl border-2 transition-all shadow-lg ${
                        isCurrent
                          ? isAccentBeat
                            ? 'bg-red-500 text-white border-red-300 shadow-red-500/50'
                            : 'bg-emerald-500 text-black border-emerald-300 shadow-emerald-500/50'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      {beatNum}
                    </div>
                    <span className="text-[10px] font-mono mt-0.5 text-neutral-400">
                      {isAccentBeat ? 'ONE' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* HUGE BPM & CONTROLS */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 w-full">
              {/* BPM Adjusters */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => adjustBpm(-5)}
                  className="w-10 h-10 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-xs sm:text-sm active:scale-95 transition"
                  title="-5 BPM"
                >
                  -5
                </button>
                <button
                  onClick={() => adjustBpm(-1)}
                  className="w-10 h-10 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95 transition"
                  title="-1 BPM"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Big BPM Display */}
                <div className="flex flex-col items-center px-3 py-1 min-w-[130px] sm:min-w-[150px]">
                  <span className="text-5xl sm:text-8xl font-black font-mono tracking-tighter text-amber-400">
                    {activeBpm}
                  </span>
                  <span className="text-[10px] sm:text-xs font-mono tracking-widest text-neutral-400 uppercase font-bold">
                    BPM (Tempo)
                  </span>
                </div>

                <button
                  onClick={() => adjustBpm(1)}
                  className="w-10 h-10 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center active:scale-95 transition"
                  title="+1 BPM"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => adjustBpm(5)}
                  className="w-10 h-10 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 flex items-center justify-center font-bold text-xs sm:text-sm active:scale-95 transition"
                  title="+5 BPM"
                >
                  +5
                </button>
              </div>

              {/* Tap Tempo & Giant Metronome Trigger Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTapTempo}
                  className="px-4 py-3 bg-neutral-950 hover:bg-neutral-800 active:bg-amber-500 active:text-black border border-neutral-750 text-neutral-200 rounded-xl font-mono text-xs font-bold transition flex flex-col items-center gap-1 shadow-md active:scale-95"
                >
                  <Radio className="w-4 h-4 text-amber-400" />
                  <span>TAP TEMPO</span>
                </button>

                {/* GIANT PLAY/STOP CLICK BUTTON */}
                <button
                  onClick={toggleMetronome}
                  className={`px-6 sm:px-8 py-4 sm:py-5 rounded-2xl font-black text-base sm:text-xl flex items-center gap-2.5 sm:gap-3 shadow-2xl transition transform active:scale-95 ${
                    isMetronomeRunning
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/30'
                  }`}
                >
                  {isMetronomeRunning ? (
                    <>
                      <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                      <span>STOP CLICK</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
                      <span>START CLICK</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. DRUM CUE SHEET / STRUCTURE NOTE */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl flex-1 min-h-[200px] flex flex-col justify-start overflow-hidden">
          {/* Cue Sheet Header & Controls */}
          <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 pb-2.5 mb-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Struktur & Catatan Drum
              </span>
              <span className="text-[11px] font-mono text-neutral-500 hidden sm:inline">
                ({currentSong.timeSignature} | {activeBpm} BPM)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Font Size Adjusters: 14px to 24px */}
              <div 
                className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-0.5 text-xs font-mono"
                title="Atur Ukuran Teks (14px - 24px)"
              >
                <button
                  onClick={handleDecreaseFontSize}
                  disabled={cueFontSize === '14px'}
                  title="Perkecil Ukuran Teks (Min 14px)"
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                >
                  A-
                </button>
                <div className="flex items-center gap-1 px-1.5 font-bold text-amber-400 text-[11px] min-w-[42px] justify-center">
                  <Type className="w-3 h-3 opacity-60" />
                  <span>{cueFontSize}</span>
                </div>
                <button
                  onClick={handleIncreaseFontSize}
                  disabled={cueFontSize === '24px'}
                  title="Perbesar Ukuran Teks (Max 24px)"
                  className="px-2 py-1 hover:bg-neutral-800 rounded text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed font-bold"
                >
                  A+
                </button>
              </div>

              {/* Focus Notes / Fullscreen Toggle */}
              <button
                onClick={handleToggleFocusNotes}
                title={isFocusNotes ? 'Kembali ke Tampilan Standar' : 'Fokus Catatan (Perluas Teks Lagu di Layar HP)'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                  isFocusNotes
                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md'
                    : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                }`}
              >
                {isFocusNotes ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Standar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Fokus Catatan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Formatted Drum Cue Lines */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {currentSong.drumNotes ? (
              currentSong.drumNotes.split('\n').map((line, idx) => {
                const parsed = parseCueLine(line);
                if (parsed.type === 'section') {
                  return (
                    <div 
                      key={idx} 
                      className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 py-1 border-b border-neutral-800/40 last:border-0"
                      style={{ fontSize: cueFontSize }}
                    >
                      <span className={`inline-flex items-center self-start px-2.5 py-0.5 rounded-md font-black tracking-wide uppercase text-[0.75em] border shrink-0 ${parsed.badgeClass}`}>
                        {parsed.tag}
                      </span>
                      <span className="font-mono font-medium text-neutral-100 leading-relaxed break-words">
                        {parsed.details}
                      </span>
                    </div>
                  );
                }
                return (
                  <div 
                    key={idx} 
                    className="font-mono text-neutral-200 leading-relaxed py-0.5 break-words"
                    style={{ fontSize: cueFontSize }}
                  >
                    {parsed.raw || '\u00A0'}
                  </div>
                );
              })
            ) : (
              <span className="text-neutral-500 italic font-mono" style={{ fontSize: cueFontSize }}>
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
