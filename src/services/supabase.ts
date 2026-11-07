import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Song, Setlist } from '../types';

let clientInstance: SupabaseClient | null = null;
let currentConfigKey: string = '';

export function getSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  const finalUrl = url || import.meta.env.VITE_SUPABASE_URL;
  const finalKey = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!finalUrl || !finalKey) {
    return null;
  }

  const keyCombo = `${finalUrl}_${finalKey}`;
  if (clientInstance && currentConfigKey === keyCombo) {
    return clientInstance;
  }

  try {
    clientInstance = createClient(finalUrl, finalKey);
    currentConfigKey = keyCombo;
    return clientInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export const cloudSyncService = {
  isConfigured(url?: string, anonKey?: string): boolean {
    return Boolean((url || import.meta.env.VITE_SUPABASE_URL) && (anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY));
  },

  async fetchAllFromCloud(url?: string, anonKey?: string): Promise<{ songs: Song[]; setlists: Setlist[] } | null> {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return null;

    try {
      const [songsRes, setlistsRes] = await Promise.all([
        client.from('songs').select('*'),
        client.from('setlists').select('*'),
      ]);

      if (songsRes.error) throw songsRes.error;
      if (setlistsRes.error) throw setlistsRes.error;

      const songs: Song[] = (songsRes.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        bpm: row.bpm,
        timeSignature: row.time_signature,
        subdivision: row.subdivision,
        key: row.key_signature,
        drumNotes: row.drum_notes,
        youtubeUrl: row.youtube_url,
        audioUrl: row.audio_url,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      }));

      const setlists: Setlist[] = (setlistsRes.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        date: row.date,
        description: row.description,
        items: Array.isArray(row.items) ? row.items : JSON.parse(row.items || '[]'),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      }));

      return { songs, setlists };
    } catch (err) {
      console.error('Cloud fetch failed:', err);
      return null;
    }
  },

  async pushSongToCloud(song: Song, url?: string, anonKey?: string): Promise<boolean> {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return false;

    try {
      const { error } = await client.from('songs').upsert({
        id: song.id,
        title: song.title,
        artist: song.artist,
        bpm: song.bpm,
        time_signature: song.timeSignature,
        subdivision: song.subdivision,
        key_signature: song.key,
        drum_notes: song.drumNotes,
        youtube_url: song.youtubeUrl,
        audio_url: song.audioUrl,
        created_at: song.createdAt,
        updated_at: song.updatedAt,
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to push song to cloud:', err);
      return false;
    }
  },

  async deleteSongFromCloud(id: string, url?: string, anonKey?: string): Promise<boolean> {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return false;

    try {
      const { error } = await client.from('songs').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to delete song from cloud:', err);
      return false;
    }
  },

  async pushSetlistToCloud(setlist: Setlist, url?: string, anonKey?: string): Promise<boolean> {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return false;

    try {
      const { error } = await client.from('setlists').upsert({
        id: setlist.id,
        title: setlist.title,
        date: setlist.date,
        description: setlist.description,
        items: setlist.items,
        created_at: setlist.createdAt,
        updated_at: setlist.updatedAt,
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to push setlist to cloud:', err);
      return false;
    }
  },

  async deleteSetlistFromCloud(id: string, url?: string, anonKey?: string): Promise<boolean> {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return false;

    try {
      const { error } = await client.from('setlists').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Failed to delete setlist from cloud:', err);
      return false;
    }
  },

  subscribeToCloudChanges(
    url: string | undefined,
    anonKey: string | undefined,
    onDataChanged: () => void
  ): (() => void) | null {
    const client = getSupabaseClient(url, anonKey);
    if (!client) return null;

    const channel = client
      .channel('schema-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        onDataChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setlists' }, () => {
        onDataChanged();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  },
};
