import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import { generateScenesApi } from '../services/api';
import type { SceneItem, TransitionType } from '../types';

function normalizeSceneTimings(scenes: SceneItem[]): SceneItem[] {
  let cursor = 0;
  return scenes.map((scene, idx) => {
    const dur = Math.max(2, Math.round(scene.endTime - scene.startTime) || 5);
    const startTime = cursor;
    const endTime = cursor + dur;
    cursor = endTime;
    return {
      ...scene,
      sceneNumber: idx + 1,
      startTime,
      endTime,
    };
  });
}

export function ScenePlannerPage() {
  const { activeProject, saveProjectUpdates, navigate, notify } = useStudio();
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setScenes(activeProject.scenes || []);
    }
  }, [activeProject]);

  if (!activeProject) {
    return <EmptyProjectNotice studioName="Scene Planner" />;
  }

  const totalSeconds = scenes.reduce((acc, s) => acc + Math.max(1, s.endTime - s.startTime), 0);

  const updateScene = (index: number, patch: Partial<SceneItem>) => {
    setScenes((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return patch.startTime !== undefined || patch.endTime !== undefined
        ? next
        : next;
    });
  };

  const updateSceneDuration = (index: number, newDuration: number) => {
    const clamped = Math.max(2, Math.min(45, newDuration || 5));
    setScenes((prev) => {
      const next = prev.map((s, i) =>
        i === index ? { ...s, endTime: s.startTime + clamped } : s,
      );
      return normalizeSceneTimings(next);
    });
  };

  const moveScene = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= scenes.length) return;
    const copy = [...scenes];
    const [removed] = copy.splice(index, 1);
    copy.splice(target, 0, removed);
    setScenes(normalizeSceneTimings(copy));
  };

  const addScene = () => {
    const lastEnd = scenes.length > 0 ? scenes[scenes.length - 1].endTime : 0;
    const newScene: SceneItem = {
      id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sceneNumber: scenes.length + 1,
      startTime: lastEnd,
      endTime: lastEnd + 6,
      voiceover: '',
      cameraAngle: 'Medium shot',
      cameraMovement: 'Static on tripod',
      visualDescription: 'Creator explaining key point directly to camera',
      backgroundSuggestion: 'Clean lit desk backdrop',
      bRollSuggestion: 'Relevant cutaway detail shot',
      textOverlay: 'Key Takeaway',
      transition: 'fade',
      visualPrompt: `Cinematic shot related to ${activeProject.topic}`,
    };
    setScenes((prev) => normalizeSceneTimings([...prev, newScene]));
  };

  const removeScene = (index: number) => {
    if (scenes.length <= 1) {
      notify('A video project needs at least one scene.', 'info');
      return;
    }
    setScenes((prev) => normalizeSceneTimings(prev.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const normalized = normalizeSceneTimings(scenes);
      setScenes(normalized);
      await saveProjectUpdates(
        activeProject.id,
        { scenes: normalized, status: activeProject.status === 'draft' ? 'in_progress' : activeProject.status },
        `Updated ${normalized.length}-scene production plan`,
      );
      notify('Scene plan saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save scenes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await generateScenesApi({
        topic: activeProject.topic,
        scriptText: activeProject.script.detailedScript,
        platform: activeProject.platform,
        duration: activeProject.duration,
        tone: activeProject.tone,
        language: activeProject.language,
      });
      setScenes(res.scenes);
      await saveProjectUpdates(
        activeProject.id,
        { scenes: res.scenes },
        `Regenerated ${res.scenes.length} scenes from script`,
      );
      notify('Scene plan regenerated from your current script.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to regenerate scenes.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Scene-by-Scene Video Planner
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span className="tabular-nums">{scenes.length} scenes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{totalSeconds}s planned runtime</span>
            <span aria-hidden="true">·</span>
            <span>{activeProject.platform}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 disabled:opacity-50"
          >
            {regenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Rebuild from Script</span>
          </button>
          <button
            onClick={addScene}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scene</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Plan</span>
          </button>
          <button
            onClick={() => navigate('visuals')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold"
          >
            <span>Visual Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {scenes.map((scene, idx) => {
          const duration = Math.max(2, scene.endTime - scene.startTime);
          return (
            <article key={scene.id} className="studio-panel rounded-2xl p-5 sm:p-6 space-y-4">
              {/* Top Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-blue-400">
                    Scene {String(scene.sceneNumber).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {scene.startTime}s – {scene.endTime}s
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Duration:</span>
                    <input
                      type="number"
                      min={2}
                      max={45}
                      value={duration}
                      onChange={(e) => updateSceneDuration(idx, Number(e.target.value))}
                      className="w-14 px-2 py-1 rounded bg-[#090F24] border border-slate-700 text-xs text-white font-mono tabular-nums"
                    />
                    <span>s</span>
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => moveScene(idx, -1)}
                    disabled={idx === 0}
                    title="Move scene up"
                    className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveScene(idx, 1)}
                    disabled={idx === scenes.length - 1}
                    title="Move scene down"
                    className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeScene(idx)}
                    title="Remove scene"
                    className="p-1.5 rounded-lg border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Voiceover & Overlay */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7">
                  <label className="block text-xs text-slate-400 mb-1.5">Voiceover Line</label>
                  <textarea
                    rows={2}
                    value={scene.voiceover}
                    onChange={(e) => updateScene(idx, { voiceover: e.target.value })}
                    className="w-full p-3 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Text Overlay</label>
                    <input
                      type="text"
                      value={scene.textOverlay}
                      onChange={(e) => updateScene(idx, { textOverlay: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">Transition</label>
                    <select
                      value={scene.transition}
                      onChange={(e) =>
                        updateScene(idx, { transition: e.target.value as TransitionType })
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="fade">Fade</option>
                      <option value="cut">Hard Cut</option>
                      <option value="zoom">Smooth Zoom</option>
                      <option value="slide">Slide</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Camera & Visual Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Camera Angle</label>
                  <input
                    type="text"
                    value={scene.cameraAngle}
                    onChange={(e) => updateScene(idx, { cameraAngle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Camera Movement</label>
                  <input
                    type="text"
                    value={scene.cameraMovement}
                    onChange={(e) => updateScene(idx, { cameraMovement: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Background Suggestion</label>
                  <input
                    type="text"
                    value={scene.backgroundSuggestion}
                    onChange={(e) => updateScene(idx, { backgroundSuggestion: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">B-Roll Suggestion</label>
                  <input
                    type="text"
                    value={scene.bRollSuggestion}
                    onChange={(e) => updateScene(idx, { bRollSuggestion: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Visual Description</label>
                  <input
                    type="text"
                    value={scene.visualDescription}
                    onChange={(e) => updateScene(idx, { visualDescription: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Visual Generation Prompt</label>
                  <input
                    type="text"
                    value={scene.visualPrompt}
                    onChange={(e) => updateScene(idx, { visualPrompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-slate-100"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
