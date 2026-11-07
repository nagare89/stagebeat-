export type TimeSignature = '4/4' | '3/4' | '6/8' | '2/4' | '5/4' | '12/8';
export type MetronomeSound = 'woodblock' | 'beep' | 'cowbell' | 'click' | 'silent';
export type Subdivision = 'quarter' | 'eighth' | 'sixteenth' | 'triplet';

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  timeSignature: TimeSignature;
  subdivision?: Subdivision;
  key?: string;
  drumNotes: string; // Struktur lagu & cue drum (Intro, Verse, Chorus, Bridge, Outro, groove notes)
  youtubeUrl?: string; // Link video YouTube untuk latihan/referensi
  audioUrl?: string; // File audio MP3 atau direct link
  createdAt: number;
  updatedAt: number;
}

export interface SetlistItem {
  id: string;
  songId: string;
  customBpm?: number;
  customNotes?: string;
  order: number;
}

export interface Setlist {
  id: string;
  title: string;
  date: string; // Format YYYY-MM-DD
  description?: string;
  items: SetlistItem[];
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  metronomeSound: MetronomeSound;
  metronomeVolume: number; // 0 to 1
  countInBars: number; // 0 = no count-in, 1 = 1 bar, 2 = 2 bars
  visualFlashEnabled: boolean;
  keepScreenAwake: boolean;
  theme: 'dark' | 'oled';
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
