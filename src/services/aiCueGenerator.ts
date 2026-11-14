import type { TimeSignature } from '../types';

export interface GeneratedCueResult {
  bpm: number;
  timeSignature: TimeSignature;
  key?: string;
  drumNotes: string;
  detectedTitle?: string;
  detectedArtist?: string;
}

export const aiCueService = {
  getStoredApiKey(): string {
    return (
      localStorage.getItem('stagebeat_gemini_api_key') ||
      import.meta.env.VITE_GEMINI_API_KEY ||
      ''
    );
  },

  setStoredApiKey(key: string): void {
    if (key.trim()) {
      localStorage.setItem('stagebeat_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('stagebeat_gemini_api_key');
    }
  },

  async fetchYouTubeMetadata(url: string): Promise<{ title?: string; author?: string }> {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title,
          author: data.author_name,
        };
      }
    } catch (err) {
      console.warn('Could not fetch YouTube oEmbed metadata:', err);
    }
    return {};
  },

  async fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Format is data:<mimeType>;base64,<data>
        const matches = result.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          resolve({
            mimeType: matches[1],
            base64: matches[2],
          });
        } else {
          reject(new Error('Format file audio tidak valid'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },

  async generateCue(params: {
    youtubeUrl?: string;
    audioFile?: File;
    songTitle?: string;
    artist?: string;
    customApiKey?: string;
  }): Promise<GeneratedCueResult> {
    const apiKey = params.customApiKey || this.getStoredApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API Key belum dimasukkan. Silakan masukkan API Key di Pengaturan atau pada jendela AI ini.'
      );
    }

    if (!params.youtubeUrl && !params.audioFile) {
      throw new Error(
        'Masukkan link YouTube aransemen atau pilih file audio latihan terlebih dahulu agar AI menganalisis aransemen yang tepat.'
      );
    }

    // Try multiple available Gemini models (2.5-flash -> 1.5-flash)
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const contentsParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

        // If audio file is provided, attach as multimodal inline audio
        if (params.audioFile) {
          const { base64, mimeType } = await this.fileToBase64(params.audioFile);
          contentsParts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          });
        }

        // Fetch YouTube metadata if link given
        let youtubeContext = '';
        if (params.youtubeUrl) {
          const meta = await this.fetchYouTubeMetadata(params.youtubeUrl);
          youtubeContext = `\nSumber YouTube: ${params.youtubeUrl}\nJudul Video YouTube: ${meta.title || params.songTitle || 'Versi pada link tersebut'}\nChannel/Artis: ${meta.author || params.artist || 'Tidak diketahui'}`;
        }

        const prompt = `Anda adalah seorang Drummer Pelayanan Gereja (Worship Drummer) profesional dan Music Director berpengalaman.
Tugas Anda adalah menganalisis aransemen lagu dari sumber audio/video yang diberikan secara SPESIFIK dan membuatkan Drum Cue Sheet (panduan struktur ketukan drum) yang siap dipakai di atas panggung.

${youtubeContext ? `SUMBER ARANSEMEN KHUSUS DARI LINK YOUTUBE:${youtubeContext}\nPENTING: Analisis versi/aransemen yang persis sesuai video YouTube tersebut! Jangan gunakan aransemen versi album lain jika video ini adalah versi live/akustik/khusus.` : 'SUMBER ARANSEMEN: Audio rekaman latihan terlampir. Dengarkan aransemen dan perpindahan bagian lagunya.'}

Judul Lagu yang Sedang Diedit: ${params.songTitle || 'Sesuai video'}
Artis: ${params.artist || 'Sesuai video'}

FORMAT OUTPUT YANG DIHARAPKAN:
Keluarkan respon HANYA dalam format JSON valid murni (tanpa penjelasan tambahan di luar JSON) dengan struktur persis seperti ini:
{
  "bpm": 72,
  "timeSignature": "4/4",
  "key": "G",
  "detectedTitle": "Judul Lagu Terdeteksi",
  "detectedArtist": "Artis Terdeteksi",
  "drumNotes": "• INTRO (4 bar): Snare rim click + hi-hat closed\\n• VERSE 1: Rimshot lembut, kick on 1 & 3\\n• PRE-CHORUS: Masuk floor tom pelan\\n• CHORUS: Full groove, ride cymbal lembut, snare punchy\\n• INTERLUDE: Sinkopasi bareng bass\\n• BRIDGE: Build-up 16th floor tom bertahap\\n• ENDING: Roll cymbal swell dan fade out"
}

ATURAN PENULISAN CUE SHEET (drumNotes):
1. Setiap baris harus menggunakan format poin '• ' diikuti salah satu tag penanda bagian dengan huruf kapital, contoh:
   - • INTRO:
   - • VERSE 1:
   - • VERSE 2:
   - • PRE-CHORUS:
   - • CHORUS:
   - • INTERLUDE: (Wajib disertakan jika ada bagian interlude!)
   - • BRIDGE:
   - • OUTRO: atau • ENDING:
   - • STOP: (Jika ada ketukan berhenti / rest)
   - • BUILD: (Jika ada crescendo / build-up)
2. Setelah tanda titik dua (:), tuliskan catatan drum praktis yang sangat berguna bagi drummer (misal: rimshot, dinamika lembut/sedang/keras, hihat half-open/closed, ride bell, kick 4-on-the-floor, snare roll build-up).
3. Pastikan BPM dan Time Signature (pilih salah satu: 4/4, 3/4, 6/8, 2/4, 5/4, 12/8) akurat sesuai aransemen.`;

        contentsParts.push({ text: prompt });

        const requestBody = {
          contents: [
            {
              parts: contentsParts,
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
          throw new Error(errMsg);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean markdown JSON wrapper if present
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawText];
        const jsonStr = (jsonMatch[1] || rawText).trim();

        const parsed = JSON.parse(jsonStr);

        // Validate & normalize
        const validTimeSignatures: TimeSignature[] = ['4/4', '3/4', '6/8', '2/4', '5/4', '12/8'];
        const normalizedSig: TimeSignature = validTimeSignatures.includes(parsed.timeSignature)
          ? parsed.timeSignature
          : '4/4';

        const normalizedBpm = typeof parsed.bpm === 'number' && parsed.bpm >= 30 && parsed.bpm <= 300
          ? Math.round(parsed.bpm)
          : 72;

        return {
          bpm: normalizedBpm,
          timeSignature: normalizedSig,
          key: parsed.key || 'G',
          drumNotes: parsed.drumNotes || '',
          detectedTitle: parsed.detectedTitle,
          detectedArtist: parsed.detectedArtist,
        };
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, attempting next if available...`, err);
      }
    }

    throw lastError || new Error('Gagal menganalisis aransemen dengan AI.');
  },
};
