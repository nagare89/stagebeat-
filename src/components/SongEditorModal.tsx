import React, { useState } from 'react';
import type { Song, TimeSignature } from '../types';
import { Sparkles, Music, Radio, X } from 'lucide-react';
import { YoutubeIcon } from './icons';

interface Props {
  song?: Song | null;
  onSave: (song: Song) => void;
  onClose: () => void;
}

const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8', '2/4', '5/4', '12/8'];
const COMMON_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const DRUM_SNIPPETS = [
  '• INTRO: ',
  '• VERSE 1: ',
  '• CHORUS: ',
  '• BRIDGE: ',
  '• OUTRO: ',
  'Rimshot',
  'Ride groove',
  'Tom build-up',
  '4-on-the-floor kick',
  'Crescendo',
  'Cymbal swell',
  'Drop / Silent',
];

export const SongEditorModal: React.FC<Props> = ({ song, onSave, onClose }) => {
  const [title, setTitle] = useState(song?.title || '');
  const [artist, setArtist] = useState(song?.artist || '');
  const [bpm, setBpm] = useState<number>(song?.bpm || 72);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(song?.timeSignature || '4/4');
  const [key, setKey] = useState(song?.key || 'G');
  const [drumNotes, setDrumNotes] = useState(song?.drumNotes || '');
  const [youtubeUrl, setYoutubeUrl] = useState(song?.youtubeUrl || '');
  const [audioUrl] = useState(song?.audioUrl || '');

  // Tap tempo
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const handleTap = () => {
    const now = Date.now();
    const updated = tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000 ? [now] : [...tapTimes, now];
    setTapTimes(updated);

    if (updated.length >= 2) {
      const intervals = [];
      for (let i = 1; i < updated.length; i++) {
        intervals.push(updated[i] - updated[i - 1]);
      }
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avg);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        setBpm(calculatedBpm);
      }
    }
  };

  const insertSnippet = (snippet: string) => {
    setDrumNotes((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newSong: Song = {
      id: song?.id || `song-${Date.now()}`,
      title: title.trim(),
      artist: artist.trim() || 'Worship Leader / Artist',
      bpm,
      timeSignature,
      key,
      drumNotes,
      youtubeUrl: youtubeUrl.trim(),
      audioUrl: audioUrl.trim(),
      createdAt: song?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(newSong);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-500" />
            {song ? 'Edit Lagu & Catatan Drum' : 'Tambah Lagu Baru'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Judul & Artis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Judul Lagu *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Goodness of God"
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Artis / Worship Band
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Contoh: Bethel Music / JPCC Worship"
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* BPM, Time Signature, Key */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-neutral-950/60 p-4 rounded-xl border border-neutral-850">
            {/* BPM Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Tempo (BPM)
                </label>
                <button
                  type="button"
                  onClick={handleTap}
                  className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 hover:bg-amber-500 hover:text-black font-mono text-amber-400 transition"
                >
                  <Radio className="w-3 h-3 inline mr-1" />
                  Tap
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBpm((prev) => Math.max(30, prev - 1))}
                  className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  min="30"
                  max="300"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value) || 60)}
                  className="w-full bg-neutral-900 border border-neutral-700 text-center font-mono font-bold text-amber-400 text-lg rounded-lg py-1.5"
                />
                <button
                  type="button"
                  onClick={() => setBpm((prev) => Math.min(300, prev + 1))}
                  className="w-9 h-9 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-bold flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {/* Time Signature */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Birama
              </label>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(e.target.value as TimeSignature)}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono"
              >
                {TIME_SIGNATURES.map((ts) => (
                  <option key={ts} value={ts}>
                    {ts}
                  </option>
                ))}
              </select>
            </div>

            {/* Key */}
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Kunci Nada (Key)
              </label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono"
              >
                {COMMON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    Key of {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Drum Cue Sheet & Structure */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Catatan Struktur Lagu & Cue Drum
              </label>
              <span className="text-[11px] text-neutral-400">Klik snippet di bawah untuk mengisi cepat:</span>
            </div>

            {/* Quick Snippets */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DRUM_SNIPPETS.map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => insertSnippet(snippet)}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-750 transition"
                >
                  +{snippet}
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={drumNotes}
              onChange={(e) => setDrumNotes(e.target.value)}
              placeholder="Contoh:&#10;• INTRO (4 bar): Snare rim click&#10;• VERSE 1: Cross-stick lembut&#10;• CHORUS: Masuk ride cymbal&#10;• BRIDGE: Build-up 16th floor tom keras!"
              className="w-full bg-neutral-950 border border-neutral-700 text-neutral-100 font-mono text-xs sm:text-sm rounded-xl p-3 focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Hybrid Audio Section */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <YoutubeIcon className="w-4 h-4 text-red-500" />
                Link Video / Audio YouTube (Untuk Latihan & Referensi)
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg shadow-amber-500/20 transition"
            >
              Simpan Lagu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
