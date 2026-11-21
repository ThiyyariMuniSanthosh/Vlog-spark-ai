import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Sparkles,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import {
  pollVideoJobStatus,
  renderBrowserWebmVideo,
  startAiVideoJob,
  startServerRenderJob,
  type VideoJobStatus,
} from '../services/api';
import type { AspectRatio, EditorConfig, ExportRecord, TransitionType, VideoResolution } from '../types';

export function VideoEditorPage() {
  const { activeProject, health, saveProjectUpdates, navigate, notify } = useStudio();
  const [config, setConfig] = useState<EditorConfig | null>(null);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [saving, setSaving] = useState(false);

  // Server FFmpeg render state
  const [renderJob, setRenderJob] = useState<VideoJobStatus | null>(null);
  const [rendering, setRendering] = useState(false);

  // Browser WebM fallback state
  const [webmBusy, setWebmBusy] = useState(false);
  const [webmProgress, setWebmProgress] = useState(0);
  const [webmStage, setWebmStage] = useState('');

  // Async AI Video Clip (Omni Flash / Veo) state
  const [aiClipPrompt, setAiClipPrompt] = useState('');
  const [aiClipJob, setAiClipJob] = useState<VideoJobStatus | null>(null);
  const [aiClipBusy, setAiClipBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (activeProject) {
      setConfig(activeProject.editorConfig);
      setAiClipPrompt(
        activeProject.scenes[0]?.visualPrompt ||
          activeProject.scenes[0]?.visualDescription ||
          activeProject.topic,
      );
      // Preload scene images for live preview canvas
      activeProject.scenes.forEach((s) => {
        if (s.imageUrl && !loadedImgsRef.current.has(s.imageUrl)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = s.imageUrl;
          img.onload = () => loadedImgsRef.current.set(s.imageUrl!, img);
        }
      });
    }
  }, [activeProject]);

  const scenes = activeProject?.scenes || [];
  const totalDuration =
    (config?.includeIntro ? 2.5 : 0) +
    scenes.reduce((sum, s) => sum + Math.max(2, s.endTime - s.startTime || 5), 0) +
    (config?.includeOutro ? 2.5 : 0);

  // Draw live preview canvas frame whenever playhead or config updates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !config || !activeProject) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dims =
      config.aspectRatio === '9:16'
        ? { w: 360, h: 640 }
        : config.aspectRatio === '1:1'
          ? { w: 480, h: 480 }
          : { w: 640, h: 360 };
    if (canvas.width !== dims.w || canvas.height !== dims.h) {
      canvas.width = dims.w;
      canvas.height = dims.h;
    }

    const bg = ctx.createLinearGradient(0, 0, dims.w, dims.h);
    bg.addColorStop(0, '#070B19');
    bg.addColorStop(1, '#1B1542');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dims.w, dims.h);

    let cursor = 0;
    if (config.includeIntro && playheadSec < 2.5) {
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(dims.w * 0.055)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillText((config.introTitle || activeProject.title).slice(0, 36), dims.w / 2, dims.h * 0.46);
      ctx.fillStyle = '#93C5FD';
      ctx.font = `500 ${Math.round(dims.w * 0.028)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillText(config.introSubtitle || 'VlogSpark AI Studio', dims.w / 2, dims.h * 0.56);
      return;
    }
    if (config.includeIntro) cursor += 2.5;

    let activeScene = scenes[selectedSceneIdx] || scenes[0];
    for (const s of scenes) {
      const dur = Math.max(2, s.endTime - s.startTime || 5);
      if (playheadSec >= cursor && playheadSec < cursor + dur) {
        activeScene = s;
        break;
      }
      cursor += dur;
    }

    if (config.includeOutro && playheadSec >= totalDuration - 2.5) {
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(dims.w * 0.05)}px "Bricolage Grotesque", sans-serif`;
      ctx.fillText((config.outroText || 'Thanks for watching!').slice(0, 42), dims.w / 2, dims.h * 0.5);
      return;
    }

    if (activeScene) {
      const img = activeScene.imageUrl ? loadedImgsRef.current.get(activeScene.imageUrl) : undefined;
      if (img) {
        const scale = Math.max(dims.w / img.width, dims.h / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (dims.w - dw) / 2, (dims.h - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = 'rgba(255,255,255,0.16)';
        ctx.strokeRect(24, 24, dims.w - 48, dims.h - 48);
        ctx.fillStyle = '#93C5FD';
        ctx.textAlign = 'center';
        ctx.font = `600 14px "JetBrains Mono", monospace`;
        ctx.fillText(`SCENE ${String(activeScene.sceneNumber).padStart(2, '0')}`, dims.w / 2, dims.h * 0.42);
        ctx.fillStyle = '#E2E8F0';
        ctx.font = `500 15px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText((activeScene.visualDescription || activeScene.textOverlay).slice(0, 48), dims.w / 2, dims.h * 0.52);
      }

      if (config.includeCaptions && (activeScene.textOverlay || activeScene.voiceover)) {
        const captionText = (activeScene.textOverlay || activeScene.voiceover).slice(0, 68);
        const y =
          config.captionPosition === 'top'
            ? dims.h * 0.14
            : config.captionPosition === 'center'
              ? dims.h * 0.5
              : dims.h * 0.84;
        ctx.fillStyle = 'rgba(7, 11, 25, 0.78)';
        ctx.fillRect(dims.w * 0.08, y - 24, dims.w * 0.84, 42);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = `600 ${Math.round(Math.min(dims.w, dims.h) * 0.045)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillText(captionText, dims.w / 2, y + 4);
      }
    }
  }, [playheadSec, config, activeProject, scenes, selectedSceneIdx, totalDuration]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlayheadSec((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          audioRef.current?.pause();
          musicRef.current?.pause();
          return 0;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, totalDuration]);

  if (!activeProject || !config) {
    return <EmptyProjectNotice studioName="Video Editor" />;
  }

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      audioRef.current?.pause();
      musicRef.current?.pause();
    } else {
      if (config.includeAudio && audioRef.current && activeProject.audio.narrationUrl) {
        audioRef.current.volume = Math.min(1, activeProject.audio.narrationVolume ?? 1);
        audioRef.current.currentTime = Math.max(0, playheadSec - (config.includeIntro ? 2.5 : 0));
        audioRef.current.play().catch(() => {});
      }
      if (config.includeAudio && musicRef.current && activeProject.audio.bgMusicUrl) {
        musicRef.current.volume = Math.min(1, activeProject.audio.bgMusicVolume ?? 0.22);
        musicRef.current.play().catch(() => {});
      }
      setPlaying(true);
    }
  };

  const handleSaveEditorConfig = async () => {
    setSaving(true);
    try {
      await saveProjectUpdates(
        activeProject.id,
        { editorConfig: config },
        'Saved video editor timeline settings',
      );
      notify('Editor timeline configuration saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save editor config.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRenderMp4 = async () => {
    setRendering(true);
    setRenderJob(null);
    try {
      const initialJob = await startServerRenderJob({
        projectTitle: activeProject.title,
        scenes,
        editorConfig: config,
        narrationUrl: activeProject.audio?.narrationUrl,
        narrationVolume: activeProject.audio?.narrationVolume ?? 1,
        trimStart: activeProject.audio?.trimStart ?? 0,
        trimEnd: activeProject.audio?.trimEnd ?? 0,
        bgMusicUrl: activeProject.audio?.bgMusicUrl,
        bgMusicVolume: activeProject.audio?.bgMusicVolume ?? 0.22,
      });
      setRenderJob(initialJob);

      // Poll until completed or failed
      let status = initialJob;
      while (status.status === 'pending' || status.status === 'processing') {
        await new Promise((r) => setTimeout(r, 900));
        status = await pollVideoJobStatus(initialJob.jobId);
        setRenderJob(status);
      }

      if (status.status === 'completed' && status.outputUrl) {
        const record: ExportRecord = {
          id: status.jobId,
          fileName: status.fileName || `${activeProject.title}.mp4`,
          format: 'mp4',
          resolution: config.resolution,
          aspectRatio: config.aspectRatio,
          durationSeconds: status.durationSeconds || Math.round(totalDuration),
          fileSizeBytes: status.fileSizeBytes || 0,
          url: status.outputUrl,
          renderEngine: 'ffmpeg_server',
          includeCaptions: config.includeCaptions,
          includeAudio: config.includeAudio,
          createdAt: new Date().toISOString(),
        };
        await saveProjectUpdates(
          activeProject.id,
          {
            editorConfig: config,
            status: 'exported',
            exports: [record, ...(activeProject.exports || [])].slice(0, 20),
          },
          `Rendered ${config.resolution} MP4 (${config.aspectRatio})`,
        );
        notify('Playable MP4 rendered and verified! Opening Export Center.', 'success');
        navigate('export');
      } else {
        notify(status.error || 'MP4 rendering failed.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Server rendering failed.', 'error');
    } finally {
      setRendering(false);
    }
  };

  const handleRenderWebmFallback = async () => {
    setWebmBusy(true);
    setWebmProgress(5);
    setWebmStage('Initializing browser WebM recorder...');
    try {
      const result = await renderBrowserWebmVideo({
        scenes,
        editorConfig: config,
        narrationUrl: activeProject.audio?.narrationUrl,
        narrationVolume: activeProject.audio?.narrationVolume ?? 1,
        bgMusicUrl: activeProject.audio?.bgMusicUrl,
        bgMusicVolume: activeProject.audio?.bgMusicVolume ?? 0.22,
        onProgress: (pct, stage) => {
          setWebmProgress(pct);
          setWebmStage(stage);
        },
      });
      const fileName = `${activeProject.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36)}_${config.resolution}.webm`;
      const a = document.createElement('a');
      a.href = result.url;
      a.download = fileName;
      a.click();
      notify('Playable WebM video rendered in browser and downloaded.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Browser WebM rendering failed.', 'error');
    } finally {
      setWebmBusy(false);
    }
  };

  const handleGenerateAiVideoClip = async () => {
    if (!aiClipPrompt.trim()) return;
    setAiClipBusy(true);
    setAiClipJob(null);
    try {
      const started = await startAiVideoJob({
        prompt: aiClipPrompt.trim(),
        aspectRatio: config.aspectRatio === '9:16' ? '9:16' : '16:9',
        durationSeconds: 5,
      });
      setAiClipJob(started);

      let curr = started;
      while (curr.status === 'pending' || curr.status === 'processing') {
        await new Promise((r) => setTimeout(r, 2000));
        curr = await pollVideoJobStatus(started.jobId);
        setAiClipJob(curr);
      }

      if (curr.status === 'completed' && curr.outputUrl) {
        notify('AI video clip generated successfully!', 'success');
      } else {
        notify(curr.error || 'AI video clip generation unavailable.', 'error');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to start AI video job.', 'error');
    } finally {
      setAiClipBusy(false);
    }
  };

  const selectedScene = scenes[selectedSceneIdx];

  return (
    <div className="space-y-6">
      {activeProject.audio?.narrationUrl && (
        <audio ref={audioRef} src={activeProject.audio.narrationUrl} className="hidden" />
      )}
      {activeProject.audio?.bgMusicUrl && (
        <audio ref={musicRef} src={activeProject.audio.bgMusicUrl} loop className="hidden" />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Video Editor &amp; Timeline
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span className="font-mono tabular-nums">{totalDuration.toFixed(1)}s runtime</span>
            <span aria-hidden="true">·</span>
            <span>{config.aspectRatio}</span>
            <span aria-hidden="true">·</span>
            <span>{config.resolution}</span>
            <span aria-hidden="true">·</span>
            <span>
              {health?.ffmpegAvailable ? 'FFmpeg MP4 Renderer Ready' : 'Browser WebM Renderer'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSaveEditorConfig}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Timeline</span>
          </button>
          <button
            onClick={handleRenderMp4}
            disabled={rendering || webmBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {rendering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
            <span>{rendering ? 'Rendering MP4...' : 'Render MP4 Video'}</span>
          </button>
          <button
            onClick={handleRenderWebmFallback}
            disabled={rendering || webmBusy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{webmBusy ? 'Recording WebM...' : 'Browser WebM'}</span>
          </button>
        </div>
      </div>

      {/* Render Progress Banner */}
      {(renderJob || webmBusy) && (
        <div className="studio-panel rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-200 font-medium">
              {webmBusy ? webmStage : renderJob?.stage}
            </span>
            <span className="font-mono tabular-nums text-blue-400">
              {webmBusy ? webmProgress : renderJob?.progress}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
              style={{ width: `${webmBusy ? webmProgress : renderJob?.progress || 0}%` }}
            />
          </div>
          {renderJob?.status === 'failed' && renderJob.error && (
            <p className="text-xs text-red-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {renderJob.error}
            </p>
          )}
        </div>
      )}

      {/* Workspace Split: Live Canvas Preview + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Preview Monitor */}
        <section className="lg:col-span-7 studio-panel rounded-2xl p-5 flex flex-col items-center justify-between gap-4">
          <div className="w-full flex items-center justify-center bg-[#050814] rounded-xl p-4 min-h-[340px] border border-slate-800/80">
            <canvas
              ref={canvasRef}
              className="max-h-[400px] max-w-full rounded-lg border border-slate-800 shadow-lg"
            />
          </div>

          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{playing ? 'Pause' : 'Preview'}</span>
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setPlayheadSec(0);
                  audioRef.current?.pause();
                  musicRef.current?.pause();
                }}
                className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white"
                aria-label="Reset playhead"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 flex items-center gap-3 min-w-[180px]">
              <input
                type="range"
                min={0}
                max={totalDuration || 10}
                step={0.1}
                value={playheadSec}
                onChange={(e) => setPlayheadSec(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="font-mono tabular-nums text-xs text-slate-400 whitespace-nowrap">
                {playheadSec.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </span>
            </div>
          </div>
        </section>

        {/* Right Inspector Panel */}
        <aside className="lg:col-span-5 space-y-5">
          <div className="studio-panel rounded-2xl p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-white">Composition Settings</h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Aspect Ratio</label>
                <select
                  value={config.aspectRatio}
                  onChange={(e) =>
                    setConfig({ ...config, aspectRatio: e.target.value as AspectRatio })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-700 text-white"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical (Reels/Shorts)</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Resolution</label>
                <select
                  value={config.resolution}
                  onChange={(e) =>
                    setConfig({ ...config, resolution: e.target.value as VideoResolution })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-700 text-white"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeCaptions}
                  onChange={(e) => setConfig({ ...config, includeCaptions: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Burn-in Captions</span>
              </label>
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeAudio}
                  onChange={(e) => setConfig({ ...config, includeAudio: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Include Audio Mix</span>
              </label>
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeIntro}
                  onChange={(e) => setConfig({ ...config, includeIntro: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Intro Title Card</span>
              </label>
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeOutro}
                  onChange={(e) => setConfig({ ...config, includeOutro: e.target.checked })}
                  className="accent-blue-500"
                />
                <span>Outro CTA Card</span>
              </label>
            </div>

            {config.includeIntro && (
              <div className="space-y-2 text-xs">
                <input
                  type="text"
                  value={config.introTitle}
                  onChange={(e) => setConfig({ ...config, introTitle: e.target.value })}
                  placeholder="Intro title"
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-white"
                />
                <input
                  type="text"
                  value={config.introSubtitle}
                  onChange={(e) => setConfig({ ...config, introSubtitle: e.target.value })}
                  placeholder="Intro subtitle"
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-200"
                />
              </div>
            )}

            {config.includeOutro && (
              <input
                type="text"
                value={config.outroText}
                onChange={(e) => setConfig({ ...config, outroText: e.target.value })}
                placeholder="Outro call-to-action"
                className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-xs text-white"
              />
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Caption Position</label>
                <select
                  value={config.captionPosition}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      captionPosition: e.target.value as EditorConfig['captionPosition'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-white"
                >
                  <option value="bottom">Bottom Third</option>
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Default Transition</label>
                <select
                  value={config.defaultTransition}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      defaultTransition: e.target.value as TransitionType,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-white"
                >
                  <option value="fade">Cross Fade</option>
                  <option value="cut">Hard Cut</option>
                  <option value="zoom">Smooth Zoom</option>
                  <option value="slide">Slide</option>
                </select>
              </div>
            </div>
          </div>

          {/* Async AI Video Clip Generator (Gemini Omni / Veo — Honest Status) */}
          <div className="studio-panel rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                AI B-Roll Clip (Gemini Omni / Veo)
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Submit an async AI video clip generation job when a billing-enabled API key is attached.
              Otherwise, use the FFmpeg MP4 Studio Renderer above to produce a real video from your
              scene visuals and narration.
            </p>
            <textarea
              rows={2}
              value={aiClipPrompt}
              onChange={(e) => setAiClipPrompt(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-[#090F24] border border-slate-800 text-xs text-white"
            />
            <button
              onClick={handleGenerateAiVideoClip}
              disabled={aiClipBusy}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600/25 hover:bg-violet-600/40 border border-violet-500/35 text-xs font-semibold text-violet-100 disabled:opacity-50"
            >
              {aiClipBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{aiClipBusy ? 'Polling AI Video Job...' : 'Start AI Video Clip Job'}</span>
            </button>

            {aiClipJob && (
              <div className="p-3 rounded-lg bg-[#090F24] border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400">Job: {aiClipJob.jobId.slice(0, 14)}</span>
                  <span className="capitalize text-blue-300">{aiClipJob.status}</span>
                </div>
                {aiClipJob.status === 'failed' && aiClipJob.error && (
                  <p className="text-amber-200 leading-relaxed">{aiClipJob.error}</p>
                )}
                {aiClipJob.status === 'completed' && aiClipJob.outputUrl && (
                  <div className="space-y-2">
                    <p className="text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Clip ready!
                    </p>
                    <video
                      src={aiClipJob.outputUrl}
                      controls
                      className="w-full rounded-lg border border-slate-700"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Multi-Track Visual Timeline */}
      <section className="studio-panel rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">Multi-Track Timeline</h2>
          {selectedScene && (
            <span className="text-xs text-slate-400">
              Selected: Scene {selectedScene.sceneNumber} ({selectedScene.startTime}s–{selectedScene.endTime}s)
            </span>
          )}
        </div>

        {/* Video / Scene Track */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">Video &amp; Scene Track</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {scenes.map((scene, idx) => (
              <button
                key={scene.id}
                onClick={() => {
                  setSelectedSceneIdx(idx);
                  const offset =
                    (config.includeIntro ? 2.5 : 0) +
                    scenes
                      .slice(0, idx)
                      .reduce((sum, s) => sum + Math.max(2, s.endTime - s.startTime || 5), 0);
                  setPlayheadSec(offset + 0.1);
                }}
                className={`min-w-[140px] flex-1 p-3 rounded-xl border text-left transition-colors ${
                  selectedSceneIdx === idx
                    ? 'bg-blue-600/20 border-blue-500/60 text-white'
                    : 'bg-[#090F24] border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-blue-400">
                  <span>S{scene.sceneNumber}</span>
                  <span>{Math.max(2, scene.endTime - scene.startTime)}s</span>
                </div>
                <p className="text-xs truncate mt-1">
                  {scene.textOverlay || scene.visualDescription}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {scene.imageUrl ? 'Visual attached' : 'Title backdrop'} · {scene.transition}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Audio & Text Tracks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#090F24] border border-slate-800">
            <p className="text-[11px] text-slate-500 mb-1">Narration Track</p>
            <p className="text-slate-200 truncate">
              {activeProject.audio?.narrationFileName || 'No narration recorded yet'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#090F24] border border-slate-800">
            <p className="text-[11px] text-slate-500 mb-1">Background Music Track</p>
            <p className="text-slate-200 truncate">
              {activeProject.audio?.bgMusicFileName || 'No background music'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-[#090F24] border border-slate-800">
            <p className="text-[11px] text-slate-500 mb-1">Text &amp; Captions Track</p>
            <p className="text-slate-200">
              {config.includeCaptions
                ? `Enabled (${config.captionPosition})`
                : 'Disabled'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
