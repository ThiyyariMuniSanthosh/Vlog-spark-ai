import React, { useState } from 'react';
import {
  Sparkles,
  Upload,
  Layers,
  Loader2,
  Maximize2,
  X,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import {
  generateImageApi,
  renderStudioCardAndUpload,
  uploadMediaFile,
} from '../services/api';
import { VISUAL_STYLES, type AspectRatio, type SceneItem, type VisualStyle } from '../types';

export function VisualStudioPage() {
  const { activeProject, saveProjectUpdates, navigate, notify } = useStudio();
  const [style, setStyle] = useState<VisualStyle>('Cinematic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    activeProject?.editorConfig?.aspectRatio || '16:9',
  );
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!activeProject) {
    return <EmptyProjectNotice studioName="AI Visual Studio" />;
  }

  const scenes = activeProject.scenes || [];

  const persistSceneVisual = async (
    sceneId: string,
    patch: Pick<SceneItem, 'imageUrl' | 'imageSource' | 'imageStyle'>,
    summary: string,
  ) => {
    const updated = scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s));
    await saveProjectUpdates(
      activeProject.id,
      { scenes: updated, status: activeProject.status === 'draft' ? 'in_progress' : activeProject.status },
      summary,
    );
  };

  const handleGenerateAiImage = async (scene: SceneItem) => {
    setBusySceneId(scene.id);
    setBillingNotice(null);
    try {
      const result = await generateImageApi({
        prompt: scene.visualPrompt || scene.visualDescription || scene.voiceover,
        style,
        aspectRatio,
      });
      await persistSceneVisual(
        scene.id,
        { imageUrl: result.url, imageSource: 'gemini_ai', imageStyle: style },
        `Generated Gemini AI visual for Scene ${scene.sceneNumber}`,
      );
      notify(`AI visual generated for Scene ${scene.sceneNumber}.`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed.';
      if (msg.toLowerCase().includes('billing') || msg.toLowerCase().includes('quota')) {
        setBillingNotice(msg);
      }
      notify(msg, 'error');
    } finally {
      setBusySceneId(null);
    }
  };

  const handleCreateStudioCard = async (scene: SceneItem) => {
    setBusySceneId(scene.id);
    try {
      const url = await renderStudioCardAndUpload({
        sceneNumber: scene.sceneNumber,
        headline: scene.textOverlay || scene.voiceover.slice(0, 64),
        description: scene.visualDescription || scene.bRollSuggestion,
        cameraHint: `${scene.cameraAngle} · ${scene.cameraMovement}`,
        style,
        aspectRatio,
      });
      await persistSceneVisual(
        scene.id,
        { imageUrl: url, imageSource: 'studio_card', imageStyle: style },
        `Created Studio Graphic Card for Scene ${scene.sceneNumber}`,
      );
      notify(`Studio Graphic Card saved for Scene ${scene.sceneNumber}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create Studio Card.', 'error');
    } finally {
      setBusySceneId(null);
    }
  };

  const handleUploadSceneImage = async (
    scene: SceneItem,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusySceneId(scene.id);
    try {
      const uploaded = await uploadMediaFile(file);
      await persistSceneVisual(
        scene.id,
        { imageUrl: uploaded.url, imageSource: 'user_upload', imageStyle: style },
        `Uploaded custom photo for Scene ${scene.sceneNumber}`,
      );
      notify(`Uploaded custom image for Scene ${scene.sceneNumber}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setBusySceneId(null);
    }
  };

  const handleBatchStudioCards = async () => {
    const missing = scenes.filter((s) => !s.imageUrl);
    if (missing.length === 0) {
      notify('Every scene already has a visual asset attached.', 'info');
      return;
    }
    setBatchBusy(true);
    try {
      const updated = [...scenes];
      for (const s of missing) {
        const url = await renderStudioCardAndUpload({
          sceneNumber: s.sceneNumber,
          headline: s.textOverlay || s.voiceover.slice(0, 64),
          description: s.visualDescription || s.bRollSuggestion,
          cameraHint: `${s.cameraAngle} · ${s.cameraMovement}`,
          style,
          aspectRatio,
        });
        const idx = updated.findIndex((x) => x.id === s.id);
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            imageUrl: url,
            imageSource: 'studio_card',
            imageStyle: style,
          };
        }
      }
      await saveProjectUpdates(
        activeProject.id,
        { scenes: updated },
        `Built Studio Graphic Cards for ${missing.length} scenes`,
      );
      notify(`Created ${missing.length} Studio Graphic Cards ready for video export.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Batch card creation failed.', 'error');
    } finally {
      setBatchBusy(false);
    }
  };

  const sourceLabel = (src?: SceneItem['imageSource']) => {
    if (src === 'gemini_ai') return 'Gemini AI Image';
    if (src === 'user_upload') return 'Uploaded Photo';
    if (src === 'studio_card') return 'Studio Graphic Card';
    return 'No visual yet';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            AI Visual Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Generate scene visuals with Gemini Image API, upload your own photos, or render crisp
            Studio Graphic Cards for every scene.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleBatchStudioCards}
            disabled={batchBusy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 disabled:opacity-50"
          >
            {batchBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
            <span>Build Missing Studio Cards</span>
          </button>
          <button
            onClick={() => navigate('voice')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold"
          >
            <span>Next: Voice Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Style & Aspect Controls */}
      <div className="studio-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Visual Style</label>
            <div className="flex flex-wrap gap-1.5">
              {VISUAL_STYLES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStyle(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    style === st
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#090F24] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Aspect Ratio</label>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090F24] border border-slate-800">
            {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ar) => (
              <button
                key={ar}
                onClick={() => setAspectRatio(ar)}
                className={`px-3 py-1 rounded-md text-xs font-mono ${
                  aspectRatio === ar ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ar}
              </button>
            ))}
          </div>
        </div>
      </div>

      {billingNotice && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{billingNotice}</span>
        </div>
      )}

      {/* Scene Visual Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {scenes.map((scene) => {
          const isBusy = busySceneId === scene.id;
          return (
            <article key={scene.id} className="studio-panel rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-video bg-[#090F24] relative flex items-center justify-center overflow-hidden border-b border-slate-800/80">
                {scene.imageUrl ? (
                  <>
                    <img
                      src={scene.imageUrl}
                      alt={`Scene ${scene.sceneNumber}: ${scene.visualDescription}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setPreviewUrl(scene.imageUrl || null)}
                      aria-label="Preview full image"
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/65 hover:bg-black/85 text-white transition-colors"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <div className="p-6 text-center">
                    <p className="font-mono text-xs text-slate-500 mb-1">
                      Scene {String(scene.sceneNumber).padStart(2, '0')}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-3">
                      {scene.visualDescription || scene.visualPrompt}
                    </p>
                  </div>
                )}

                {isBusy && (
                  <div className="absolute inset-0 bg-[#070B19]/80 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    <span className="text-xs text-slate-200">Preparing scene visual...</span>
                  </div>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="font-mono text-blue-400 font-medium">
                      Scene {String(scene.sceneNumber).padStart(2, '0')}
                    </span>
                    <span>{sourceLabel(scene.imageSource)}</span>
                  </div>
                  <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                    {scene.visualPrompt || scene.visualDescription}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    disabled={isBusy}
                    onClick={() => handleGenerateAiImage(scene)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{scene.imageUrl ? 'Regenerate AI Image' : 'Generate AI Image'}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isBusy}
                      onClick={() => handleCreateStudioCard(scene)}
                      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0B122A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 disabled:opacity-50"
                    >
                      <Layers className="w-3.5 h-3.5 text-violet-400" />
                      <span>Studio Card</span>
                    </button>

                    <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0B122A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => handleUploadSceneImage(scene, e)}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              aria-label="Close preview"
              className="absolute -top-10 right-0 p-2 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewUrl}
              alt="Scene visual preview"
              referrerPolicy="no-referrer"
              className="w-full max-h-[82vh] object-contain rounded-xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
