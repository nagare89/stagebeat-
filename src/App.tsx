import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Song, Setlist, SetlistItem, AppSettings } from './types';
import { storageService } from './services/storage';
import { cloudSyncService } from './services/supabase';
import { StageModeView } from './components/StageModeView';
import { SongEditorModal } from './components/SongEditorModal';
import { SettingsModal } from './components/SettingsModal';
import { AudioPracticePlayer } from './components/AudioPracticePlayer';
import { metronome } from './utils/metronome';
import { 
  Play, Plus, Music, Settings, Trash2, ArrowUp, ArrowDown, 
  Search, Calendar, Edit3, Smartphone, Cloud, CloudOff
} from 'lucide-react';
import { YoutubeIcon } from './components/icons';

export function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [activeSetlistId, setActiveSetlistId] = useState<string>('');
  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Views & Modals
  const [isStageMode, setIsStageMode] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [isCreatingSetlist, setIsCreatingSetlist] = useState(false);
  const [newSetlistTitle, setNewSetlistTitle] = useState('');
  const [newSetlistDate, setNewSetlistDate] = useState(new Date().toISOString().split('T')[0]);

  // Search & filter
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [expandedPracticeSongId, setExpandedPracticeSongId] = useState<string | null>(null);

  // Quick preview click
  const [previewingSongId, setPreviewingSongId] = useState<string | null>(null);

  // Cloud Sync Handler
  const syncWithCloud = useCallback(async (currentSettings: AppSettings) => {
    if (!cloudSyncService.isConfigured(currentSettings.supabaseUrl, currentSettings.supabaseAnonKey)) {
      setIsCloudConnected(false);
      return;
    }

    try {
      const cloudData = await cloudSyncService.fetchAllFromCloud(
        currentSettings.supabaseUrl,
        currentSettings.supabaseAnonKey
      );

      if (cloudData && (cloudData.songs.length > 0 || cloudData.setlists.length > 0)) {
        setIsCloudConnected(true);
        // Save to local storage for instant offline access
        cloudData.songs.forEach((s) => storageService.saveSong(s));
        cloudData.setlists.forEach((sl) => storageService.saveSetlist(sl));

        setSongs(storageService.getSongs());
        setSetlists(storageService.getSetlists());
      } else {
        setIsCloudConnected(true);
      }
    } catch (err) {
      console.warn('Could not sync with cloud, using local offline data:', err);
      setIsCloudConnected(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    const loadedSongs = storageService.getSongs();
    const loadedSetlists = storageService.getSetlists();
    const activeId = storageService.getActiveSetlistId();
    const currentSettings = storageService.getSettings();

    setSongs(loadedSongs);
    setSetlists(loadedSetlists);
    setSettings(currentSettings);
    setActiveSetlistId(activeId || (loadedSetlists[0]?.id ?? ''));

    // Try cloud sync on startup
    syncWithCloud(currentSettings);

    // Subscribe to cloud realtime changes
    const unsubscribe = cloudSyncService.subscribeToCloudChanges(
      currentSettings.supabaseUrl,
      currentSettings.supabaseAnonKey,
      () => {
        syncWithCloud(currentSettings);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [syncWithCloud]);

  // Quick Map of Songs by ID for fast lookup
  const songsMap = useMemo(() => {
    const map = new Map<string, Song>();
    songs.forEach((s) => map.set(s.id, s));
    return map;
  }, [songs]);

  // Current active setlist
  const activeSetlist = useMemo(() => {
    return setlists.find((s) => s.id === activeSetlistId) || setlists[0];
  }, [setlists, activeSetlistId]);

  // Save active setlist change
  const handleSelectSetlist = (id: string) => {
    setActiveSetlistId(id);
    storageService.setActiveSetlistId(id);
  };

  // Song CRUD
  const handleSaveSong = async (song: Song) => {
    storageService.saveSong(song);
    setSongs(storageService.getSongs());
    setEditingSong(undefined);

    // Push to cloud in background
    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSongToCloud(song, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const handleDeleteSong = async (id: string) => {
    if (confirm('Yakin ingin menghapus lagu ini dari database?')) {
      storageService.deleteSong(id);
      setSongs(storageService.getSongs());
      const updatedSetlists = setlists.map((sl) => ({
        ...sl,
        items: sl.items.filter((item) => item.songId !== id),
      }));
      updatedSetlists.forEach((sl) => storageService.saveSetlist(sl));
      setSetlists(storageService.getSetlists());

      if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
        cloudSyncService.deleteSongFromCloud(id, settings.supabaseUrl, settings.supabaseAnonKey);
        updatedSetlists.forEach((sl) =>
          cloudSyncService.pushSetlistToCloud(sl, settings.supabaseUrl, settings.supabaseAnonKey)
        );
      }
    }
  };

  // Setlist operations
  const handleCreateSetlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetlistTitle.trim()) return;

    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      title: newSetlistTitle.trim(),
      date: newSetlistDate,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    storageService.saveSetlist(newSetlist);
    setSetlists(storageService.getSetlists());
    setActiveSetlistId(newSetlist.id);
    storageService.setActiveSetlistId(newSetlist.id);
    setIsCreatingSetlist(false);
    setNewSetlistTitle('');

    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSetlistToCloud(newSetlist, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const handleDeleteSetlist = (id: string) => {
    if (setlists.length <= 1) {
      alert('Harus ada minimal satu setlist.');
      return;
    }
    if (confirm('Hapus stage list ini?')) {
      storageService.deleteSetlist(id);
      const remaining = storageService.getSetlists();
      setSetlists(remaining);
      setActiveSetlistId(remaining[0].id);
      storageService.setActiveSetlistId(remaining[0].id);

      if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
        cloudSyncService.deleteSetlistFromCloud(id, settings.supabaseUrl, settings.supabaseAnonKey);
      }
    }
  };

  const handleAddSongToSetlist = (songId: string) => {
    if (!activeSetlist) return;

    const newItem: SetlistItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      songId,
      order: activeSetlist.items.length + 1,
    };

    const updatedSetlist: Setlist = {
      ...activeSetlist,
      items: [...activeSetlist.items, newItem],
    };

    storageService.saveSetlist(updatedSetlist);
    setSetlists(storageService.getSetlists());
    setIsSongPickerOpen(false);

    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSetlistToCloud(updatedSetlist, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const handleRemoveItemFromSetlist = (itemId: string) => {
    if (!activeSetlist) return;
    const updatedItems = activeSetlist.items
      .filter((i) => i.id !== itemId)
      .map((item, idx) => ({ ...item, order: idx + 1 }));

    const updatedSetlist: Setlist = {
      ...activeSetlist,
      items: updatedItems,
    };

    storageService.saveSetlist(updatedSetlist);
    setSetlists(storageService.getSetlists());

    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSetlistToCloud(updatedSetlist, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!activeSetlist) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeSetlist.items.length) return;

    const items = [...activeSetlist.items];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;

    const reordered = items.map((item, idx) => ({ ...item, order: idx + 1 }));
    const updatedSetlist: Setlist = {
      ...activeSetlist,
      items: reordered,
    };

    storageService.saveSetlist(updatedSetlist);
    setSetlists(storageService.getSetlists());

    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSetlistToCloud(updatedSetlist, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const handleUpdateItemNote = (itemId: string, note: string) => {
    if (!activeSetlist) return;
    const updatedItems = activeSetlist.items.map((i) =>
      i.id === itemId ? { ...i, customNotes: note } : i
    );
    const updatedSetlist = { ...activeSetlist, items: updatedItems };
    storageService.saveSetlist(updatedSetlist);
    setSetlists(storageService.getSetlists());

    if (cloudSyncService.isConfigured(settings.supabaseUrl, settings.supabaseAnonKey)) {
      cloudSyncService.pushSetlistToCloud(updatedSetlist, settings.supabaseUrl, settings.supabaseAnonKey);
    }
  };

  const togglePreviewClick = (song: Song) => {
    if (previewingSongId === song.id) {
      metronome.stop();
      setPreviewingSongId(null);
    } else {
      metronome.stop();
      metronome.setTimeSignature(song.timeSignature);
      metronome.start(song.bpm);
      setPreviewingSongId(song.id);
    }
  };

  const handleExportBackup = () => {
    const json = storageService.exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StageBeat_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && storageService.importBackupJson(content)) {
        setSongs(storageService.getSongs());
        setSetlists(storageService.getSetlists());
        setSettings(storageService.getSettings());
        alert('Data berhasil di-import dan disinkronisasi!');
        setIsSettingsOpen(false);
      } else {
        alert('File backup tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const filteredSongs = useMemo(() => {
    if (!songSearchQuery.trim()) return songs;
    const q = songSearchQuery.toLowerCase();
    return songs.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q) || s.drumNotes.toLowerCase().includes(q)
    );
  }, [songs, songSearchQuery]);

  if (isStageMode && activeSetlist) {
    return (
      <StageModeView
        setlist={activeSetlist}
        songsMap={songsMap}
        onExit={() => setIsStageMode(false)}
        onUpdateSong={(updated) => handleSaveSong(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      
      {/* 1. TOP NAVBAR */}
      <header className="bg-black/90 border-b border-neutral-850 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                StageBeat <span className="text-[10px] font-mono font-bold bg-amber-500 text-black px-1.5 py-0.2 rounded">DRUMS</span>
              </span>
              <p className="text-[10px] text-neutral-400 font-mono hidden sm:block -mt-0.5">
                Worship Drummer Companion
              </p>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            
            {/* Cloud Sync Status Badge */}
            <div
              title={isCloudConnected ? 'Cloud Sync: Terhubung' : 'Mode Offline / Local Storage'}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono"
            >
              {isCloudConnected ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-400 font-semibold">Cloud Sync</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-neutral-500" />
                  <span className="text-neutral-500">Offline Local</span>
                </>
              )}
            </div>

            {/* Song Bank Button */}
            <button
              onClick={() => setIsSongPickerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold transition"
            >
              <Music className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Bank Lagu ({songs.length})</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              title="Pengaturan & Backup"
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* GIANT START STAGE MODE BUTTON */}
            {activeSetlist && activeSetlist.items.length > 0 && (
              <button
                onClick={() => {
                  metronome.stop();
                  setPreviewingSongId(null);
                  setIsStageMode(true);
                }}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>MULAI STAGE MODE</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. SUBHEADER: SETLIST SELECTOR & PC EDITING BAR */}
      <div className="bg-neutral-900/60 border-b border-neutral-850 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-bold">
              Stage List Aktif:
            </span>
            <select
              value={activeSetlistId}
              onChange={(e) => handleSelectSetlist(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 text-white font-bold text-xs sm:text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {setlists.map((sl) => (
                <option key={sl.id} value={sl.id}>
                  {sl.title} ({sl.date})
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCreatingSetlist(true)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              Setlist Baru
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ketik setlist di Laptop, bawa HP ke panggung!</span>
          </div>

        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        
        {/* SETLIST OVERVIEW HEADER */}
        {activeSetlist && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span>{activeSetlist.date}</span>
                <span>•</span>
                <span>{activeSetlist.items.length} Lagu Siap Dimainkan</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {activeSetlist.title}
              </h1>
              {activeSetlist.description && (
                <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                  {activeSetlist.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSongPickerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md transition"
              >
                <Plus className="w-4 h-4" />
                Tambah Lagu ke List
              </button>

              <button
                onClick={() => handleDeleteSetlist(activeSetlist.id)}
                title="Hapus setlist ini"
                className="p-2.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SETLIST SONG ITEMS */}
        {activeSetlist && activeSetlist.items.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-neutral-800 rounded-2xl bg-neutral-900/30">
            <Music className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-200">Stage List masih kosong</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-4 max-w-md mx-auto">
              Tambahkan lagu-lagu pelayanan Anda dari Bank Lagu untuk mengatur urutan, catatan drum, dan metronom.
            </p>
            <button
              onClick={() => setIsSongPickerOpen(true)}
              className="px-5 py-2.5 bg-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-lg hover:bg-amber-400 transition"
            >
              + Pilih Lagu Sekarang
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeSetlist?.items.map((item, index) => {
              const song = songsMap.get(item.songId);
              if (!song) return null;

              const isPreviewing = previewingSongId === song.id;
              const isPracticeExpanded = expandedPracticeSongId === song.id;

              return (
                <div
                  key={item.id}
                  className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-4 sm:p-5 transition shadow-sm space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Left: Order, Title, Metronome Specs */}
                    <div className="flex items-start sm:items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-neutral-950 border border-neutral-800 text-amber-400 font-mono font-black text-sm flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg text-white">
                            {song.title}
                          </h3>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {song.bpm} BPM
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                            {song.timeSignature}
                          </span>
                          {song.key && (
                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              Key: {song.key}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{song.artist}</p>
                      </div>
                    </div>

                    {/* Right: Actions & Metronome Preview */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        onClick={() => togglePreviewClick(song)}
                        title={isPreviewing ? 'Stop Click' : 'Cek Click Metronome'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition ${
                          isPreviewing
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                            : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {isPreviewing ? 'STOP' : 'TES CLICK'}
                      </button>

                      {(song.youtubeUrl || song.audioUrl) && (
                        <button
                          onClick={() => setExpandedPracticeSongId(isPracticeExpanded ? null : song.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                            isPracticeExpanded
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                          }`}
                        >
                          <YoutubeIcon className="w-3.5 h-3.5 text-red-400" />
                          <span>Latihan</span>
                        </button>
                      )}

                      <button
                        onClick={() => setEditingSong(song)}
                        title="Edit Catatan & Info Lagu"
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0}
                        title="Geser ke atas"
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-20 rounded-lg transition"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === activeSetlist.items.length - 1}
                        title="Geser ke bawah"
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-20 rounded-lg transition"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleRemoveItemFromSetlist(item.id)}
                        title="Hapus dari setlist ini"
                        className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                  {song.drumNotes && (
                    <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-850 font-mono text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed">
                      {song.drumNotes}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider shrink-0">
                      Catatan WL / Khusus:
                    </span>
                    <input
                      type="text"
                      defaultValue={item.customNotes || ''}
                      onBlur={(e) => handleUpdateItemNote(item.id, e.target.value)}
                      placeholder="Misal: Segway langsung tanpa henti, atau chorus ulang 2x"
                      className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  {isPracticeExpanded && (
                    <div className="pt-2 animate-in fade-in duration-200">
                      <AudioPracticePlayer
                        song={song}
                        onUpdateSongAudio={(updates) => handleSaveSong({ ...song, ...updates })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* 4. MODAL: SONG BANK / PICKER */}
      {isSongPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-amber-500" />
                Bank Lagu Pelayanan
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingSong(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Buat Lagu Baru
                </button>
                <button
                  onClick={() => setIsSongPickerOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                >
                  <XIcon />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-neutral-800 bg-neutral-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={songSearchQuery}
                  onChange={(e) => setSongSearchQuery(e.target.value)}
                  placeholder="Cari lagu berdasarkan judul, artis, atau cue notes..."
                  className="w-full bg-neutral-950 border border-neutral-750 text-white text-xs sm:text-sm rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Song List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {filteredSongs.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-xs">
                  Tidak ada lagu ditemukan. Klik "Buat Lagu Baru" untuk menambah lagu.
                </div>
              ) : (
                filteredSongs.map((song) => {
                  const isInCurrentSetlist = activeSetlist?.items.some((i) => i.songId === song.id);

                  return (
                    <div
                      key={song.id}
                      className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-850 hover:border-neutral-750 flex items-center justify-between gap-3 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">{song.title}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-amber-400 font-bold">
                            {song.bpm} BPM
                          </span>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                            {song.timeSignature}
                          </span>
                          {song.key && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-cyan-400">
                              Key {song.key}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{song.artist}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingSong(song)}
                          className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteSong(song.id)}
                          title="Hapus lagu"
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-850 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleAddSongToSetlist(song.id)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                            isInCurrentSetlist
                              ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                              : 'bg-amber-500 hover:bg-amber-400 text-black shadow-sm'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isInCurrentSetlist ? 'Tambah Lagi' : 'Pilih Lagu'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL: CREATE NEW SETLIST */}
      {isCreatingSetlist && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Buat Stage List Pelayanan Baru</h3>
            <form onSubmit={handleCreateSetlist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Nama Stage List
                </label>
                <input
                  type="text"
                  required
                  value={newSetlistTitle}
                  onChange={(e) => setNewSetlistTitle(e.target.value)}
                  placeholder="Contoh: Ibadah Raya 2 - 10 Nov 2026"
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase mb-1">
                  Tanggal Ibadah
                </label>
                <input
                  type="date"
                  value={newSetlistDate}
                  onChange={(e) => setNewSetlistDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingSetlist(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 text-black font-bold text-xs rounded-xl hover:bg-amber-400 shadow-md"
                >
                  Buat Stage List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: SONG EDITOR */}
      {editingSong !== undefined && (
        <SongEditorModal
          song={editingSong}
          onSave={handleSaveSong}
          onClose={() => setEditingSong(undefined)}
        />
      )}

      {/* 7. MODAL: SETTINGS & BACKUP */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSaveSettings={(s) => {
            setSettings(s);
            storageService.saveSettings(s);
            syncWithCloud(s);
          }}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onManualCloudSync={() => syncWithCloud(settings)}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
export default App;
