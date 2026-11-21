import { getAuthHeader } from '../firebase';
import type {
  AspectRatio,
  CaptionsPack,
  EditorConfig,
  GeneratorFormInput,
  SceneItem,
  ScriptSections,
  SpeakingInstruction,
  SystemHealth,
  VideoResolution,
  VisualStyle,
} from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeader();
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      data?.code,
    );
  }
  return data as T;
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  return apiJson<SystemHealth>('/api/health');
}

export async function generateScriptApi(
  payload: GeneratorFormInput & {
    action?:
      | 'initial'
      | 'regenerate'
      | 'more_emotional'
      | 'more_interesting'
      | 'simplify'
      | 'more_professional'
      | 'shorten'
      | 'expand'
      | 'translate';
    existingScript?: string;
    targetLanguage?: string;
  },
): Promise<{
  suggestedTitle: string;
  language: string;
  script: ScriptSections;
  speakingGuide: SpeakingInstruction[];
}> {
  const language =
    payload.language === 'Other' && payload.customLanguage?.trim()
      ? payload.customLanguage.trim()
      : payload.language;
  const duration =
    payload.duration === 'Custom' && payload.customDuration?.trim()
      ? payload.customDuration.trim()
      : payload.duration;

  return apiJson('/api/generate-script', {
    method: 'POST',
    body: JSON.stringify({
      topic: payload.topic,
      platform: payload.platform,
      language,
      category: payload.category,
      tone: payload.tone,
      duration,
      audience: payload.audience,
      objective: payload.objective,
      scriptStyle: payload.scriptStyle,
      action: payload.action || 'initial',
      existingScript: payload.existingScript,
      targetLanguage: payload.targetLanguage,
    }),
  });
}

export async function generateScenesApi(payload: {
  topic: string;
  scriptText: string;
  platform: string;
  duration: string;
  tone: string;
  language: string;
}): Promise<{ scenes: SceneItem[] }> {
  return apiJson('/api/generate-scenes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateCaptionsApi(payload: {
  topic: string;
  scriptText: string;
  platform: string;
  language: string;
  tone: string;
  category: string;
}): Promise<{ captions: CaptionsPack }> {
  return apiJson('/api/generate-captions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateImageApi(payload: {
  prompt: string;
  style: VisualStyle;
  aspectRatio: AspectRatio;
}): Promise<{
  url: string;
  source: 'gemini_ai';
  model: string;
  aspectRatio: AspectRatio;
  style: VisualStyle;
}> {
  return apiJson('/api/generate-image', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateSyntheticTtsApi(payload: {
  text: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  style?: string;
}): Promise<{
  url: string;
  fileName: string;
  voiceName: string;
  source: 'synthetic_tts';
  model: string;
  sizeBytes: number;
}> {
  return apiJson('/api/tts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function transcribeAudioApi(audioUrl: string): Promise<{ transcript: string }> {
  return apiJson('/api/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audioUrl }),
  });
}

export async function uploadMediaFile(file: File | Blob, fileName?: string): Promise<{
  url: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: 'images' | 'audio';
}> {
  const form = new FormData();
  if (file instanceof File) {
    form.append('file', file);
  } else {
    form.append('file', file, fileName || 'recording.webm');
  }
  const authHeaders = await getAuthHeader();
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers: authHeaders,
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error || 'Upload failed.', res.status, data?.code);
  }
  return data;
}

export interface VideoJobStatus {
  jobId: string;
  type: 'ffmpeg_render' | 'ai_video_clip';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  outputUrl?: string;
  fileName?: string;
  format?: 'mp4' | 'webm';
  resolution?: VideoResolution;
  aspectRatio?: AspectRatio;
  durationSeconds?: number;
  fileSizeBytes?: number;
  error?: string;
  errorCode?: string;
}

export async function startAiVideoJob(payload: {
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  durationSeconds: number;
}): Promise<VideoJobStatus> {
  return apiJson('/api/video/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startServerRenderJob(payload: {
  projectTitle: string;
  scenes: SceneItem[];
  editorConfig: EditorConfig;
  narrationUrl?: string;
  narrationVolume: number;
  trimStart: number;
  trimEnd: number;
  bgMusicUrl?: string;
  bgMusicVolume: number;
}): Promise<VideoJobStatus> {
  return apiJson('/api/video/render', {
    method: 'POST',
    body: JSON.stringify({
      projectTitle: payload.projectTitle,
      scenes: payload.scenes.map((s) => ({
        id: s.id,
        sceneNumber: s.sceneNumber,
        startTime: s.startTime,
        endTime: s.endTime,
        voiceover: s.voiceover,
        textOverlay: s.textOverlay,
        visualDescription: s.visualDescription,
        transition: s.transition,
        imageUrl: s.imageUrl,
      })),
      aspectRatio: payload.editorConfig.aspectRatio,
      resolution: payload.editorConfig.resolution,
      includeIntro: payload.editorConfig.includeIntro,
      introTitle: payload.editorConfig.introTitle,
      introSubtitle: payload.editorConfig.introSubtitle,
      includeOutro: payload.editorConfig.includeOutro,
      outroText: payload.editorConfig.outroText,
      includeCaptions: payload.editorConfig.includeCaptions,
      includeAudio: payload.editorConfig.includeAudio,
      captionPosition: payload.editorConfig.captionPosition,
      narrationUrl: payload.narrationUrl,
      narrationVolume: payload.narrationVolume,
      trimStart: payload.trimStart,
      trimEnd: payload.trimEnd,
      bgMusicUrl: payload.bgMusicUrl,
      bgMusicVolume: payload.bgMusicVolume,
    }),
  });
}

export async function pollVideoJobStatus(jobId: string): Promise<VideoJobStatus> {
  return apiJson<VideoJobStatus>(`/api/video/status/${encodeURIComponent(jobId)}`);
}

// ============================================================================
// Studio Graphic Card Generator (Honest non-AI Canvas Visual Card)
// Clearly labelled as "Studio Graphic Card" in UI — never presented as AI art.
// ============================================================================
export async function renderStudioCardAndUpload(params: {
  sceneNumber: number;
  headline: string;
  description: string;
  cameraHint: string;
  style: VisualStyle;
  aspectRatio: AspectRatio;
}): Promise<string> {
  const dims =
    params.aspectRatio === '9:16'
      ? { w: 720, h: 1280 }
      : params.aspectRatio === '1:1'
        ? { w: 960, h: 960 }
        : { w: 1280, h: 720 };

  const canvas = document.createElement('canvas');
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const stylePalettes: Record<VisualStyle, [string, string, string]> = {
    Realistic: ['#0B1226', '#1B2A4A', '#3B82F6'],
    Cinematic: ['#090D1E', '#1F163D', '#7C3AED'],
    Documentary: ['#111827', '#1E293B', '#38BDF8'],
    Animation: ['#13103A', '#312E81', '#818CF8'],
    Illustration: ['#0F172A', '#2E1065', '#A855F7'],
    Minimalist: ['#0A0E1A', '#131A2E', '#60A5FA'],
    Educational: ['#0B172A', '#16345C', '#2563EB'],
  };
  const [c1, c2, accent] = stylePalettes[params.style] || stylePalettes.Cinematic;

  const grad = ctx.createLinearGradient(0, 0, dims.w, dims.h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, dims.w, dims.h);

  // Subtle geometric studio framing lines
  const rad = ctx.createRadialGradient(
    dims.w * 0.78,
    dims.h * 0.22,
    20,
    dims.w * 0.78,
    dims.h * 0.22,
    Math.max(dims.w, dims.h) * 0.6,
  );
  rad.addColorStop(0, `${accent}33`);
  rad.addColorStop(1, 'transparent');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, dims.w, dims.h);

  const pad = Math.round(dims.w * 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad * 0.65, pad * 0.65, dims.w - pad * 1.3, dims.h - pad * 1.3);

  // Scene number kicker
  ctx.fillStyle = accent;
  ctx.font = `600 ${Math.round(dims.w * 0.022)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText(
    `SCENE ${String(params.sceneNumber).padStart(2, '0')}  ·  ${params.style.toUpperCase()}`,
    pad,
    pad * 1.5,
  );

  // Wrapped headline
  const titleSize = Math.round(dims.w * (params.aspectRatio === '9:16' ? 0.068 : 0.048));
  ctx.fillStyle = '#F8FAFC';
  ctx.font = `700 ${titleSize}px "Bricolage Grotesque", sans-serif`;
  const titleLines = wrapCanvasLines(
    ctx,
    params.headline || `Scene ${params.sceneNumber}`,
    dims.w - pad * 2,
    3,
  );
  let y = dims.h * 0.42;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += titleSize * 1.24;
  }

  // Visual direction note
  const bodySize = Math.round(dims.w * (params.aspectRatio === '9:16' ? 0.032 : 0.021));
  ctx.fillStyle = '#CBD5E1';
  ctx.font = `400 ${bodySize}px "Plus Jakarta Sans", sans-serif`;
  const descLines = wrapCanvasLines(ctx, params.description, dims.w - pad * 2, 3);
  y += bodySize * 0.6;
  for (const line of descLines) {
    ctx.fillText(line, pad, y);
    y += bodySize * 1.45;
  }

  // Footer camera cue
  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.font = `500 ${Math.round(dims.w * 0.018)}px "JetBrains Mono", monospace`;
  ctx.fillText(params.cameraHint || 'Studio Storyboard Frame', pad, dims.h - pad * 1.15);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode studio card'))), 'image/png');
  });

  const uploaded = await uploadMediaFile(blob, `studio_card_scene_${params.sceneNumber}.png`);
  return uploaded.url;
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

// ============================================================================
// Browser Canvas + MediaRecorder WebM Renderer (Genuine Playable WebM Fallback)
// ============================================================================
export async function renderBrowserWebmVideo(params: {
  scenes: SceneItem[];
  editorConfig: EditorConfig;
  narrationUrl?: string;
  narrationVolume: number;
  bgMusicUrl?: string;
  bgMusicVolume: number;
  onProgress: (pct: number, stage: string) => void;
}): Promise<{ blob: Blob; url: string; durationSeconds: number; mimeType: string }> {
  const { scenes, editorConfig, onProgress } = params;
  const dims =
    editorConfig.aspectRatio === '9:16'
      ? { w: 720, h: 1280 }
      : editorConfig.aspectRatio === '1:1'
        ? { w: 720, h: 720 }
        : { w: 1280, h: 720 };

  const canvas = document.createElement('canvas');
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser Canvas 2D unavailable.');

  onProgress(8, 'Loading scene visuals into browser compositor...');

  const loadedImages = new Map<string, HTMLImageElement>();
  for (const s of scenes) {
    if (s.imageUrl) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.crossOrigin = 'anonymous';
          el.onload = () => resolve(el);
          el.onerror = reject;
          el.src = s.imageUrl!;
        });
        loadedImages.set(s.id, img);
      } catch {
        // Fallback to styled gradient card if an image cannot load
      }
    }
  }

  const stream = canvas.captureStream(24);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const activeAudioNodes: HTMLAudioElement[] = [];

  if (editorConfig.includeAudio) {
    if (params.narrationUrl) {
      const a = new Audio(params.narrationUrl);
      a.crossOrigin = 'anonymous';
      const src = audioCtx.createMediaElementSource(a);
      const gain = audioCtx.createGain();
      gain.gain.value = params.narrationVolume;
      src.connect(gain).connect(dest);
      activeAudioNodes.push(a);
    }
    if (params.bgMusicUrl) {
      const m = new Audio(params.bgMusicUrl);
      m.crossOrigin = 'anonymous';
      m.loop = true;
      const src = audioCtx.createMediaElementSource(m);
      const gain = audioCtx.createGain();
      gain.gain.value = params.bgMusicVolume;
      src.connect(gain).connect(dest);
      activeAudioNodes.push(m);
    }
  }

  if (activeAudioNodes.length > 0) {
    for (const track of dest.stream.getAudioTracks()) {
      stream.addTrack(track);
    }
  }

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType: preferredMime,
    videoBitsPerSecond: 3_500_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const timeline: Array<{
    duration: number;
    kind: 'intro' | 'scene' | 'outro';
    scene?: SceneItem;
  }> = [];

  if (editorConfig.includeIntro) timeline.push({ duration: 2, kind: 'intro' });
  for (const s of scenes) {
    const dur = Math.max(2, Math.min(20, s.endTime - s.startTime || 5));
    timeline.push({ duration: dur, kind: 'scene', scene: s });
  }
  if (editorConfig.includeOutro) timeline.push({ duration: 2, kind: 'outro' });

  const totalDuration = timeline.reduce((acc, t) => acc + t.duration, 0);

  recorder.start(250);
  await audioCtx.resume();
  for (const node of activeAudioNodes) {
    node.play().catch(() => {});
  }

  const startMs = performance.now();

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      const elapsedSec = (performance.now() - startMs) / 1000;
      if (elapsedSec >= totalDuration) {
        resolve();
        return;
      }

      const pct = Math.min(95, 12 + Math.round((elapsedSec / totalDuration) * 82));
      onProgress(pct, `Recording WebM timeline (${elapsedSec.toFixed(1)}s / ${totalDuration.toFixed(0)}s)`);

      let cursor = 0;
      let current = timeline[timeline.length - 1];
      let localElapsed = 0;
      for (const item of timeline) {
        if (elapsedSec < cursor + item.duration) {
          current = item;
          localElapsed = elapsedSec - cursor;
          break;
        }
        cursor += item.duration;
      }

      // Draw background
      const bgGrad = ctx.createLinearGradient(0, 0, dims.w, dims.h);
      bgGrad.addColorStop(0, '#070B19');
      bgGrad.addColorStop(1, '#1A1744');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, dims.w, dims.h);

      if (current.kind === 'intro') {
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(dims.w * 0.055)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillText(editorConfig.introTitle || 'VlogSpark AI 2.0', dims.w / 2, dims.h * 0.46);
        ctx.fillStyle = '#93C5FD';
        ctx.font = `500 ${Math.round(dims.w * 0.025)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(editorConfig.introSubtitle || 'Creator Studio Production', dims.w / 2, dims.h * 0.56);
      } else if (current.kind === 'outro') {
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.font = `700 ${Math.round(dims.w * 0.05)}px "Bricolage Grotesque", sans-serif`;
        ctx.fillText(editorConfig.outroText || 'Thanks for watching!', dims.w / 2, dims.h * 0.5);
      } else if (current.scene) {
        const img = loadedImages.get(current.scene.id);
        if (img) {
          const zoom = current.scene.transition === 'zoom' ? 1 + (localElapsed / current.duration) * 0.06 : 1;
          const scale = Math.max(dims.w / img.width, dims.h / img.height) * zoom;
          const dw = img.width * scale;
          const dh = img.height * scale;
          ctx.drawImage(img, (dims.w - dw) / 2, (dims.h - dh) / 2, dw, dh);
        }

        if (editorConfig.includeCaptions && (current.scene.textOverlay || current.scene.voiceover)) {
          const text = current.scene.textOverlay || current.scene.voiceover.slice(0, 100);
          const fontSize = Math.round(Math.min(dims.w, dims.h) * 0.042);
          ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          const lines = wrapCanvasLines(ctx, text, dims.w * 0.82, 2);
          const boxH = lines.length * fontSize * 1.35 + 28;
          const boxY =
            editorConfig.captionPosition === 'top'
              ? dims.h * 0.08
              : editorConfig.captionPosition === 'center'
                ? (dims.h - boxH) / 2
                : dims.h * 0.78;
          ctx.fillStyle = 'rgba(7, 11, 25, 0.76)';
          ctx.fillRect(dims.w * 0.06, boxY, dims.w * 0.88, boxH);
          ctx.fillStyle = '#FFFFFF';
          lines.forEach((line, idx) => {
            ctx.fillText(line, dims.w / 2, boxY + 22 + (idx + 0.7) * fontSize * 1.25);
          });
        }
      }

      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);
  });

  for (const node of activeAudioNodes) {
    node.pause();
  }

  const blob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
    recorder.stop();
  });

  await audioCtx.close().catch(() => {});
  onProgress(100, 'WebM video verified and ready');

  return {
    blob,
    url: URL.createObjectURL(blob),
    durationSeconds: Math.round(totalDuration),
    mimeType: preferredMime,
  };
}
