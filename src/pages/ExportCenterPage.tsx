import { useState } from 'react';
import {
  Download,
  Film,
  Play,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import {
  pollVideoJobStatus,
  renderBrowserWebmVideo,
  startServerRenderJob,
  type VideoJobStatus,
} from '../services/api';
import type { AspectRatio, ExportRecord, VideoResolution } from '../types';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ExportCenterPage() {
  const { activeProject, health, saveProjectUpdates, notify } = useStudio();

  const [format, setFormat] = useState<'mp4' | 'webm'>('mp4');
  const [resolution, setResolution] = useState<VideoResolution>(
    activeProject?.editorConfig?.resolution || '720p',
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    activeProject?.editorConfig?.aspectRatio || '16:9',
  );
  const [includeCaptions, setIncludeCaptions] = useState(
    activeProject?.editorConfig?.includeCaptions ?? true,
  );
  const [includeAudio, setIncludeAudio] = useState(
    activeProject?.editorConfig?.includeAudio ?? true,
  );

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [previewExport, setPreviewExport] = useState<ExportRecord | null>(null);
  const [playbackVerified, setPlaybackVerified] = useState(false);

  if (!activeProject) {
    return <EmptyProjectNotice studioName="Video Export Center" />;
  }

  const exportsList = activeProject.exports || [];
  const activePreview = previewExport || exportsList[0] || null;

  const handleStartExport = async () => {
    setBusy(true);
    setError(null);
    setProgress(5);

    const exportEditorConfig = {
      ...activeProject.editorConfig,
      aspectRatio,
      resolution,
      includeCaptions,
      includeAudio,
    };

    try {
      if (format === 'mp4' && health?.ffmpegAvailable) {
        setStage('Submitting FFmpeg H.264 MP4 render job...');
        const job = await startServerRenderJob({
          projectTitle: activeProject.title,
          scenes: activeProject.scenes,
          editorConfig: exportEditorConfig,
          narrationUrl: activeProject.audio?.narrationUrl,
          narrationVolume: activeProject.audio?.narrationVolume ?? 1,
          trimStart: activeProject.audio?.trimStart ?? 0,
          trimEnd: activeProject.audio?.trimEnd ?? 0,
          bgMusicUrl: activeProject.audio?.bgMusicUrl,
          bgMusicVolume: activeProject.audio?.bgMusicVolume ?? 0.22,
        });

        let curr: VideoJobStatus = job;
        while (curr.status === 'pending' || curr.status === 'processing') {
          setProgress(curr.progress);
          setStage(curr.stage);
          await new Promise((r) => setTimeout(r, 850));
          curr = await pollVideoJobStatus(job.jobId);
        }

        if (curr.status === 'completed' && curr.outputUrl) {
          setProgress(100);
          setStage('MP4 video rendered and verified.');
          const record: ExportRecord = {
            id: curr.jobId,
            fileName: curr.fileName || `${activeProject.title}.mp4`,
            format: 'mp4',
            resolution,
            aspectRatio,
            durationSeconds: curr.durationSeconds || 10,
            fileSizeBytes: curr.fileSizeBytes || 0,
            url: curr.outputUrl,
            renderEngine: 'ffmpeg_server',
            includeCaptions,
            includeAudio,
            createdAt: new Date().toISOString(),
          };
          await saveProjectUpdates(
            activeProject.id,
            {
              status: 'exported',
              exports: [record, ...exportsList].slice(0, 20),
            },
            `Exported ${record.fileName} (${resolution} ${aspectRatio})`,
          );
          setPreviewExport(record);
          setPlaybackVerified(false);
          notify('MP4 export completed! Play below to verify or download.', 'success');
        } else {
          throw new Error(curr.error || 'FFmpeg render failed.');
        }
      } else {
        // Real Browser Canvas + MediaRecorder WebM Export
        setStage('Rendering playable WebM in browser...');
        const webm = await renderBrowserWebmVideo({
          scenes: activeProject.scenes,
          editorConfig: exportEditorConfig,
          narrationUrl: activeProject.audio?.narrationUrl,
          narrationVolume: activeProject.audio?.narrationVolume ?? 1,
          bgMusicUrl: activeProject.audio?.bgMusicUrl,
          bgMusicVolume: activeProject.audio?.bgMusicVolume ?? 0.22,
          onProgress: (p, st) => {
            setProgress(p);
            setStage(st);
          },
        });
        const fileName = `${activeProject.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 36)}_${resolution}.webm`;
        const localRecord: ExportRecord = {
          id: `webm_${Date.now()}`,
          fileName,
          format: 'webm',
          resolution,
          aspectRatio,
          durationSeconds: webm.durationSeconds,
          fileSizeBytes: webm.blob.size,
          url: webm.url,
          renderEngine: 'browser_canvas_webm',
          includeCaptions,
          includeAudio,
          createdAt: new Date().toISOString(),
        };
        setPreviewExport(localRecord);
        setPlaybackVerified(false);
        notify('Playable WebM video rendered in browser!', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Video Export Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Render social-media-ready MP4 (H.264/AAC via FFmpeg) or browser WebM exports and verify
          playback before publishing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Export Settings */}
        <section className="lg:col-span-5 studio-panel rounded-2xl p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-white">Export Configuration</h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1.5">Output Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormat('mp4')}
                  className={`py-2.5 px-3 rounded-xl border font-semibold text-left transition-colors ${
                    format === 'mp4'
                      ? 'bg-blue-600/20 border-blue-500 text-white'
                      : 'bg-[#090F24] border-slate-800 text-slate-400'
                  }`}
                >
                  <div>MP4 (H.264 + AAC)</div>
                  <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                    Server FFmpeg · Best compatibility
                  </div>
                </button>
                <button
                  onClick={() => setFormat('webm')}
                  className={`py-2.5 px-3 rounded-xl border font-semibold text-left transition-colors ${
                    format === 'webm'
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-[#090F24] border-slate-800 text-slate-400'
                  }`}
                >
                  <div>WebM (Browser)</div>
                  <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                    Client fallback · Instant save
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1.5">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as VideoResolution)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
                >
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
                >
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCaptions}
                  onChange={(e) => setIncludeCaptions(e.target.checked)}
                  className="accent-blue-500"
                />
                <span>Include Captions</span>
              </label>
              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="accent-blue-500"
                />
                <span>Include Audio</span>
              </label>
            </div>
          </div>

          {busy && (
            <div className="p-3.5 rounded-xl bg-[#090F24] border border-blue-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200">{stage}</span>
                <span className="font-mono tabular-nums text-blue-400">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleStartExport}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
            <span>{busy ? 'Rendering Video...' : `Render ${format.toUpperCase()} (${resolution})`}</span>
          </button>
        </section>

        {/* Playback Validation Player */}
        <section className="lg:col-span-7 studio-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              Export Playback Validator
            </h2>
            {playbackVerified && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Playable stream verified
              </span>
            )}
          </div>

          {activePreview ? (
            <div className="space-y-4">
              <div className="bg-[#050814] rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <video
                  key={activePreview.url}
                  src={activePreview.url}
                  controls
                  playsInline
                  onLoadedData={() => setPlaybackVerified(true)}
                  className="max-h-[380px] w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{activePreview.fileName}</p>
                  <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono tabular-nums">
                    <span>{activePreview.format.toUpperCase()}</span>
                    <span>·</span>
                    <span>{activePreview.resolution}</span>
                    <span>·</span>
                    <span>{activePreview.aspectRatio}</span>
                    <span>·</span>
                    <span>{activePreview.durationSeconds}s</span>
                    <span>·</span>
                    <span>{formatBytes(activePreview.fileSizeBytes)}</span>
                  </div>
                </div>

                <a
                  href={activePreview.url}
                  download={activePreview.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 font-semibold text-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Video</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="h-64 rounded-xl bg-[#090F24] border border-slate-800 flex flex-col items-center justify-center text-center p-6">
              <Play className="w-7 h-7 text-slate-500 mb-2" />
              <p className="text-sm text-slate-300 font-medium">No rendered exports yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Configure your format and resolution on the left, then click Render to generate a
                real playable video file.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Export History Table */}
      <section className="studio-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80">
          <h2 className="font-display text-sm font-semibold text-white">Saved Project Exports</h2>
        </div>
        {exportsList.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">
            Completed MP4 renders for this project will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800/80 bg-[#090F24]/60">
                <tr>
                  <th className="px-6 py-3 font-medium">File Name</th>
                  <th className="px-4 py-3 font-medium">Format</th>
                  <th className="px-4 py-3 font-medium">Resolution</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {exportsList.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/25">
                    <td className="px-6 py-3.5 text-white font-medium">{exp.fileName}</td>
                    <td className="px-4 py-3.5 text-slate-300 uppercase font-mono">{exp.format}</td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono tabular-nums">
                      {exp.resolution} ({exp.aspectRatio})
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono tabular-nums">
                      {exp.durationSeconds}s
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-mono tabular-nums">
                      {formatBytes(exp.fileSizeBytes)}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => {
                          setPreviewExport(exp);
                          setPlaybackVerified(false);
                        }}
                        className="px-2.5 py-1 rounded-md border border-slate-700 hover:border-slate-500 text-slate-200"
                      >
                        Play
                      </button>
                      <a
                        href={exp.url}
                        download={exp.fileName}
                        className="inline-block px-2.5 py-1 rounded-md bg-blue-600/25 border border-blue-500/35 text-blue-200 hover:bg-blue-600/40"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
