import React, { useState } from 'react';
import type { AppSettings, MetronomeSound } from '../types';
import { X, Volume2, ShieldCheck, Download, Upload, Smartphone, Check, Sparkles, Database, Cloud, RefreshCw } from 'lucide-react';
import { metronome } from '../utils/metronome';
import { cloudSyncService } from '../services/supabase';
import { aiCueService } from '../services/aiCueGenerator';

interface Props {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onManualCloudSync?: () => Promise<void>;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  settings,
  onSaveSettings,
  onExportBackup,
  onImportBackup,
  onManualCloudSync,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleSoundChange = (sound: MetronomeSound) => {
    setLocalSettings((prev) => ({ ...prev, metronomeSound: sound }));
    metronome.setSound(sound);
    metronome.start();
    setTimeout(() => metronome.stop(), 800);
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleTestCloudSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Menghubungkan ke cloud...');
    try {
      const isOk = cloudSyncService.isConfigured(localSettings.supabaseUrl, localSettings.supabaseAnonKey);
      if (!isOk) {
        setSyncStatus('URL dan Anon Key wajib diisi.');
        setIsSyncing(false);
        return;
      }

      if (onManualCloudSync) {
        await onManualCloudSync();
        setSyncStatus('✅ Berhasil terhubung & tersinkronisasi!');
      } else {
        const data = await cloudSyncService.fetchAllFromCloud(localSettings.supabaseUrl, localSettings.supabaseAnonKey);
        if (data) {
          setSyncStatus(`✅ Berhasil! Ditemukan ${data.songs.length} lagu & ${data.setlists.length} setlist di cloud.`);
        } else {
          setSyncStatus('⚠️ Gagal mengambil data. Pastikan URL & Key benar.');
        }
      }
    } catch {
      setSyncStatus('❌ Koneksi gagal. Cek kembali credentials Supabase Anda.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  const currentUrl = window.location.origin;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Pengaturan & Sinkronisasi
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          
          {/* 1. Cloud Sync (Supabase) */}
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" />
                Cloud Sync Otomatis (Supabase)
              </label>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
                Realtime Auto-Sync
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Hubungkan ke Supabase (gratis) agar Anda bisa mengedit di Laptop dan seketika langsung muncul di APK HP tanpa kabel.
            </p>

            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Project URL
                </label>
                <input
                  type="text"
                  value={localSettings.supabaseUrl || ''}
                  onChange={(e) => setLocalSettings((prev) => ({ ...prev, supabaseUrl: e.target.value.trim() }))}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-neutral-900 border border-neutral-750 text-neutral-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Anon Public Key
                </label>
                <input
                  type="password"
                  value={localSettings.supabaseAnonKey || ''}
                  onChange={(e) => setLocalSettings((prev) => ({ ...prev, supabaseAnonKey: e.target.value.trim() }))}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                  className="w-full bg-neutral-900 border border-neutral-750 text-neutral-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestCloudSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Menyinkronkan...' : 'Tes & Sinkronkan Sekarang'}
                </button>

                {syncStatus && (
                  <span className="text-[11px] font-mono text-neutral-300 truncate max-w-[240px]">
                    {syncStatus}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AI Drum Cue Generator (Google Gemini) */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-purple-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>AI Drum Cue Generator (Google Gemini)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                100% Gratis
              </span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Membuat notasi struktur & cue drum otomatis langsung dari link video YouTube atau file audio aransemen yang diulik.
            </p>

            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={localSettings.geminiApiKey || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setLocalSettings((prev) => ({ ...prev, geminiApiKey: val }));
                  aiCueService.setStoredApiKey(val);
                }}
                placeholder="AIzaSy..."
                className="w-full bg-neutral-900 border border-neutral-750 text-neutral-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-1">
                <span>Dapatkan kunci gratis dari Google di</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-400 hover:text-purple-300 font-medium underline"
                >
                  aistudio.google.com/app/apikey ↗
                </a>
              </p>
            </div>
          </div>

          {/* 2. Metronome Sound Profile */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Suara Audio Metronom
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'woodblock', label: 'Woodblock (Natural)' },
                { id: 'beep', label: 'Digital Beep (Tajam)' },
                { id: 'cowbell', label: 'Cowbell (808 Style)' },
                { id: 'click', label: 'Classic Studio Click' },
                { id: 'silent', label: 'Silent (Visual Saja)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSoundChange(s.id as MetronomeSound)}
                  className={`p-2.5 rounded-xl text-left border text-xs font-medium transition ${
                    localSettings.metronomeSound === s.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="pt-2 flex items-center justify-between bg-neutral-950 p-3 rounded-xl border border-neutral-850">
              <span className="text-xs text-neutral-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-500" />
                Volume Metronom
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={localSettings.metronomeVolume}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setLocalSettings((prev) => ({ ...prev, metronomeVolume: vol }));
                    metronome.setVolume(vol);
                  }}
                  className="w-32 h-1.5 bg-neutral-800 rounded appearance-none accent-amber-500"
                />
                <span className="font-mono text-xs w-8 text-right text-neutral-400">
                  {Math.round(localSettings.metronomeVolume * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* 3. Screen Wake Lock */}
          <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex items-center justify-between">
            <div className="pr-4">
              <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Screen Always On (Wake-Lock)
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Mencegah layar HP/tablet mati atau sleep otomatis saat di atas panggung drum.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.keepScreenAwake}
              onChange={(e) => setLocalSettings((prev) => ({ ...prev, keepScreenAwake: e.target.checked }))}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* 4. Cara Buka di Android dari Komputer */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Smartphone className="w-4 h-4" />
              Cara Membuka di HP Android Anda
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              1. Pastikan laptop dan HP Anda terhubung ke <strong>Wi-Fi yang sama</strong>.<br/>
              2. Buka browser Chrome di HP Anda, lalu ketik alamat IP laptop Anda.<br/>
              3. Di Chrome HP, tap tanda <strong>titik 3 di kanan atas &gt; "Install App" / "Tambahkan ke Layar Utama"</strong>. Aplikasi akan terpasang layaknya aplikasi Android native!
            </p>
            <div className="flex items-center justify-between bg-black/60 px-3 py-2 rounded-lg font-mono text-xs border border-amber-500/30">
              <span className="text-neutral-300 truncate">{currentUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 shrink-0 ml-2"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Salin URL'}
              </button>
            </div>
          </div>

          {/* 5. Backup & Sinkronisasi JSON */}
          <div className="space-y-3 pt-2 border-t border-neutral-800">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-4 h-4 text-cyan-400" />
              Backup Manual (Offline JSON)
            </label>
            <p className="text-xs text-neutral-400">
              Alternatif tanpa cloud: unduh data setlist menjadi 1 file `.json`, lalu kirim lewat WhatsApp / Drive ke HP Anda untuk di-import.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onExportBackup}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 text-xs font-semibold transition"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                Export Backup (JSON)
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-750 text-neutral-200 text-xs font-semibold transition cursor-pointer">
                <Upload className="w-4 h-4 text-amber-400" />
                Import Backup (JSON)
                <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-bold transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-lg transition"
          >
            Simpan Perubahan
          </button>
        </div>

      </div>
    </div>
  );
};
