import React, { useState, useRef, useEffect } from 'react';
import type { Song } from '../types';
import { Music, Play, Pause, RotateCcw, Volume2, FastForward, Link as LinkIcon } from 'lucide-react';
import { YoutubeIcon } from './icons';

interface Props {
  song: Song;
  onUpdateSongAudio?: (updatedSong: Partial<Song>) => void;
  compact?: boolean;
}

export const AudioPracticePlayer: React.FC<Props> = ({ song, onUpdateSongAudio, compact = false }) => {
  const [activeTab, setActiveTab] = useState<'youtube' | 'mp3'>(song.youtubeUrl ? 'youtube' : 'mp3');
  
  // YouTube state
  const [youtubeInput, setYoutubeInput] = useState(song.youtubeUrl || '');
  const [isEditingYoutube, setIsEditingYoutube] = useState(false);

  // MP3 state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [localAudioSrc, setLocalAudioSrc] = useState<string | null>(song.audioUrl || null);

  useEffect(() => {
    setYoutubeInput(song.youtubeUrl || '');
    setLocalAudioSrc(song.audioUrl || null);
    if (song.youtubeUrl && !song.audioUrl) {
      setActiveTab('youtube');
    } else if (song.audioUrl && !song.youtubeUrl) {
      setActiveTab('mp3');
    }
  }, [song]);

  // Extract YouTube Video ID
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = getYouTubeVideoId(youtubeInput);

  const handleSaveYoutube = () => {
    if (onUpdateSongAudio) {
      onUpdateSongAudio({ youtubeUrl: youtubeInput.trim() });
    }
    setIsEditingYoutube(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLocalAudioSrc(url);
      if (onUpdateSongAudio) {
        onUpdateSongAudio({ audioUrl: url });
      }
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'youtube'
                ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <YoutubeIcon className="w-4 h-4 text-red-500" />
            YouTube Embed
          </button>
          <button
            onClick={() => setActiveTab('mp3')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'mp3'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Music className="w-4 h-4 text-amber-500" />
            MP3 / Audio Player
          </button>
        </div>

        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          {activeTab === 'youtube' ? 'Media Latihan Online' : 'Latihan Bebas Iklan & Offline'}
        </span>
      </div>

      {/* Tab 1: YouTube Content */}
      {activeTab === 'youtube' && (
        <div className="space-y-3">
          {videoId ? (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black border border-neutral-800 shadow-md">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0&modestbranding=1`}
                title={`YouTube player for ${song.title}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="py-6 px-4 bg-neutral-950/60 rounded-lg border border-dashed border-neutral-800 text-center">
              <YoutubeIcon className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400 mb-2">Belum ada link YouTube untuk lagu ini.</p>
              <button
                onClick={() => setIsEditingYoutube(true)}
                className="text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg inline-flex items-center gap-1.5 font-medium transition"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Tambah Link YouTube
              </button>
            </div>
          )}

          {/* Edit YouTube Link Bar */}
          {(isEditingYoutube || !videoId) && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="Tempel URL YouTube (misal: https://youtu.be/...)"
                className="flex-1 bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-red-500"
              />
              <button
                onClick={handleSaveYoutube}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
              >
                Simpan
              </button>
            </div>
          )}

          {videoId && !isEditingYoutube && (
            <div className="flex justify-between items-center text-[11px] text-neutral-400 px-1">
              <span className="truncate max-w-[280px]">URL: {song.youtubeUrl}</span>
              <button
                onClick={() => setIsEditingYoutube(true)}
                className="text-neutral-400 hover:text-neutral-200 underline"
              >
                Ganti URL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: MP3 Player Content */}
      {activeTab === 'mp3' && (
        <div className="space-y-3">
          {localAudioSrc ? (
            <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800 space-y-3">
              <audio
                ref={audioRef}
                src={localAudioSrc}
                onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                onEnded={() => !isLooping && setIsPlaying(false)}
                loop={isLooping}
              />

              {/* Progress Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayAudio}
                    className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 transition active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={() => {
                      if (audioRef.current) audioRef.current.currentTime = 0;
                    }}
                    title="Ulang dari awal"
                    className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsLooping(!isLooping)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                      isLooping
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                    }`}
                  >
                    Loop: {isLooping ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Speed Rates */}
                <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                  <FastForward className="w-3.5 h-3.5 text-neutral-400 ml-1 mr-0.5" />
                  {[0.8, 0.9, 1.0, 1.1].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`text-[11px] px-2 py-0.5 rounded font-mono transition ${
                        playbackRate === rate
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Volume & File Picker */}
              <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 border-t border-neutral-850">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-neutral-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      if (audioRef.current) audioRef.current.volume = v;
                    }}
                    className="w-20 h-1 bg-neutral-800 rounded appearance-none accent-amber-500"
                  />
                </div>

                <label className="cursor-pointer text-[11px] text-amber-400 hover:underline">
                  Ganti File MP3
                  <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          ) : (
            <div className="py-6 px-4 bg-neutral-950/60 rounded-lg border border-dashed border-neutral-800 text-center">
              <Music className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
              <p className="text-xs text-neutral-400 mb-3">Upload file MP3 / audio rekaman latihan lagu ini.</p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold rounded-lg shadow-md transition">
                <Music className="w-4 h-4" />
                Pilih File Audio (MP3/WAV)
                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
