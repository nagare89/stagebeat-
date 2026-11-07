-- ========================================================
-- STAGEBEAT SUPABASE DATABASE SCHEMA
-- Jalankan skrip SQL ini di Supabase SQL Editor (1-Click Run)
-- ========================================================

-- 1. Table Songs (Bank Lagu)
CREATE TABLE IF NOT EXISTS public.songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    bpm INTEGER NOT NULL DEFAULT 120,
    time_signature TEXT NOT NULL DEFAULT '4/4',
    subdivision TEXT DEFAULT 'quarter',
    key_signature TEXT DEFAULT 'C',
    drum_notes TEXT DEFAULT '',
    youtube_url TEXT DEFAULT '',
    audio_url TEXT DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 2. Table Setlists (Daftar Stage List)
CREATE TABLE IF NOT EXISTS public.setlists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    updated_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 3. Enable Row Level Security (RLS) & Public Read/Write Policies for easy personal syncing
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read and write songs" ON public.songs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read and write setlists" ON public.setlists
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable Realtime Publications (agar HP langsung update saat PC menyimpan data)
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;
