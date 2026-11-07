import type { Song, Setlist, AppSettings } from '../types';

const STORAGE_KEYS = {
  SONGS: 'stagebeat_songs_v1',
  SETLISTS: 'stagebeat_setlists_v1',
  SETTINGS: 'stagebeat_settings_v1',
  ACTIVE_SETLIST_ID: 'stagebeat_active_setlist_id',
};

const DEFAULT_SETTINGS: AppSettings = {
  metronomeSound: 'woodblock',
  metronomeVolume: 0.85,
  countInBars: 0,
  visualFlashEnabled: true,
  keepScreenAwake: true,
  theme: 'oled',
};

const SEED_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Goodness of God',
    artist: 'Bethel Music / Jenn Johnson',
    bpm: 68,
    timeSignature: '4/4',
    key: 'Ab',
    drumNotes: '• INTRO (4 bar): Snare rim click + hi-hat closed\n• VERSE 1: Rimshot lembut, kick on 1 & 3\n• CHORUS 1: Masuk snare normal, ride cymbal lembut\n• VERSE 2: Tom groove santai\n• BRIDGE: Build-up floor tom (16th notes) bertahap makin keras!\n• ENDING: Roll cymbal swell dan fade out halus',
    youtubeUrl: 'https://www.youtube.com/watch?v=-f4MUUMHaaQ',
    createdAt: Date.now() - 3600000 * 24 * 3,
    updatedAt: Date.now() - 3600000 * 24 * 3,
  },
  {
    id: 'song-2',
    title: 'Darah-Mu Yesus',
    artist: 'NDC Worship',
    bpm: 72,
    timeSignature: '4/4',
    key: 'E',
    drumNotes: '• INTRO: Drum REST (Keyboard/Pad saja)\n• VERSE 1: Masuk bar ke-8 dengan kick pelan\n• CHORUS: Full groove, snare punchy di ketukan 2 & 4\n• BRIDGE: Kick 4-on-the-floor, build snare crescendo!\n• OUTRO: Cymbal wash dan hit bareng di bar terakhir',
    youtubeUrl: 'https://www.youtube.com/watch?v=0k1L2M3N4P5',
    createdAt: Date.now() - 3600000 * 24 * 2,
    updatedAt: Date.now() - 3600000 * 24 * 2,
  },
  {
    id: 'song-3',
    title: 'Graves Into Gardens',
    artist: 'Elevation Worship',
    bpm: 70,
    timeSignature: '6/8',
    key: 'B',
    drumNotes: '⚠️ Birama 6/8! Hit snare aksen di beat 4.\n• VERSE 1: Hi-hat pedal saja pelan\n• CHORUS: Crash cymbal open, groove 6/8 megah\n• BRIDGE: Floor tom & Rack tom triplet feel build-up!\n• SOLO/PEAK: Powerful crash rolls',
    youtubeUrl: 'https://www.youtube.com/watch?v=KwX1f2gYKZg',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'song-4',
    title: 'Besar Anugerah-Mu',
    artist: 'JPCC Worship',
    bpm: 128,
    timeSignature: '4/4',
    key: 'G',
    drumNotes: '🔥 Fast Praise! Tempo 128 BPM.\n• INTRO: Four on the floor kick + snare roll fill masuk\n• VERSE: Open hi-hat di off-beat (disco/funk feel)\n• CHORUS: High energy crash ride!\n• INTERLUDE: Syncopated accents bareng bass',
    youtubeUrl: 'https://www.youtube.com/watch?v=x7Y8Z9AaBbC',
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000 * 12,
  },
];

const SEED_SETLISTS: Setlist[] = [
  {
    id: 'setlist-sunday-service',
    title: 'Ibadah Raya 1 (Minggu Pagi)',
    date: new Date().toISOString().split('T')[0],
    description: 'WL: Daniel, Keyboard: Jessica, Bass: Tommy. Fokus dinamika saat bridge.',
    items: [
      { id: 'item-1', songId: 'song-4', order: 1, customNotes: 'Praise pembuka: Energi tinggi, transisi cepat ke lagu 2' },
      { id: 'item-2', songId: 'song-2', order: 2, customNotes: 'Pemberesan: Turunkan dinamika drum ke rim click' },
      { id: 'item-3', songId: 'song-1', order: 3, customNotes: 'Worship utama: Bridge build up panjang' },
      { id: 'item-4', songId: 'song-3', order: 4, customNotes: 'Lagu respon: Perhatikan aksen 6/8 ketukan ke-4' },
    ],
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
  },
];

export const storageService = {
  getSongs(): Song[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SONGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(SEED_SONGS));
        return SEED_SONGS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load songs from storage', e);
      return SEED_SONGS;
    }
  },

  saveSong(song: Song): void {
    const songs = this.getSongs();
    const index = songs.findIndex((s) => s.id === song.id);
    if (index >= 0) {
      songs[index] = { ...song, updatedAt: Date.now() };
    } else {
      songs.push({ ...song, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
  },

  deleteSong(id: string): void {
    const songs = this.getSongs().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
  },

  getSetlists(): Setlist[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETLISTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(SEED_SETLISTS));
        return SEED_SETLISTS;
      }
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load setlists from storage', e);
      return SEED_SETLISTS;
    }
  },

  saveSetlist(setlist: Setlist): void {
    const setlists = this.getSetlists();
    const index = setlists.findIndex((s) => s.id === setlist.id);
    if (index >= 0) {
      setlists[index] = { ...setlist, updatedAt: Date.now() };
    } else {
      setlists.push({ ...setlist, createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(setlists));
  },

  deleteSetlist(id: string): void {
    const setlists = this.getSetlists().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(setlists));
  },

  getActiveSetlistId(): string {
    const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_SETLIST_ID);
    if (id) return id;
    const setlists = this.getSetlists();
    return setlists.length > 0 ? setlists[0].id : '';
  },

  setActiveSetlistId(id: string): void {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_SETLIST_ID, id);
  },

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        return DEFAULT_SETTINGS;
      }
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  exportBackupJson(): string {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      songs: this.getSongs(),
      setlists: this.getSetlists(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  },

  importBackupJson(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.songs)) {
        localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(parsed.songs));
      }
      if (Array.isArray(parsed.setlists)) {
        localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(parsed.setlists));
      }
      if (parsed.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
      }
      return true;
    } catch (e) {
      console.error('Invalid backup file', e);
      return false;
    }
  },
};
