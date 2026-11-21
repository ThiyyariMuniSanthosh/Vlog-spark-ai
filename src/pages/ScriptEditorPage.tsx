import { useEffect, useState } from 'react';
import {
  Save,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Languages,
  ArrowRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import { generateScriptApi } from '../services/api';
import { LANGUAGES, type ScriptSections } from '../types';

const REWRITE_ACTIONS = [
  { id: 'regenerate', label: 'Generate another version' },
  { id: 'more_emotional', label: 'Make it more emotional' },
  { id: 'more_interesting', label: 'Make it more interesting' },
  { id: 'simplify', label: 'Simplify the language' },
  { id: 'more_professional', label: 'Make it more professional' },
  { id: 'shorten', label: 'Shorten the script' },
  { id: 'expand', label: 'Expand the script' },
] as const;

export function ScriptEditorPage() {
  const { activeProject, saveProjectUpdates, navigate, notify } = useStudio();
  const [script, setScript] = useState<ScriptSections | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('Hindi');
  const [saving, setSaving] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setScript(activeProject.script);
    }
  }, [activeProject]);

  if (!activeProject || !script) {
    return <EmptyProjectNotice studioName="Script Editor" />;
  }

  const wordCount = script.detailedScript
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const estSeconds = Math.max(5, Math.round((wordCount / 140) * 60));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProjectUpdates(
        activeProject.id,
        { script, status: activeProject.status === 'draft' ? 'in_progress' : activeProject.status },
        `Saved script edits for "${activeProject.title}"`,
      );
      notify('Script saved to your project.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save script.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRewrite = async (
    action: (typeof REWRITE_ACTIONS)[number]['id'] | 'translate',
  ) => {
    setRewriting(action);
    try {
      const result = await generateScriptApi({
        topic: activeProject.topic,
        platform: activeProject.platform,
        language: activeProject.language,
        category: activeProject.category,
        tone: activeProject.tone,
        duration: activeProject.duration,
        audience: activeProject.audience,
        objective: activeProject.objective,
        scriptStyle: activeProject.scriptStyle,
        action,
        existingScript: script.detailedScript,
        targetLanguage: action === 'translate' ? targetLanguage : undefined,
      });

      setScript(result.script);
      await saveProjectUpdates(
        activeProject.id,
        {
          script: result.script,
          speakingGuide: result.speakingGuide,
          language: result.language,
          status: activeProject.status === 'draft' ? 'in_progress' : activeProject.status,
        },
        action === 'translate'
          ? `Rewrote script in ${result.language}`
          : `Refined script (${action.replace('_', ' ')})`,
      );
      notify(
        action === 'translate'
          ? `Script and speaking guide rewritten in ${result.language}.`
          : 'Script and speaking guide updated.',
        'success',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'AI rewrite failed.', 'error');
    } finally {
      setRewriting(null);
    }
  };

  const handleCopyFull = async () => {
    await navigator.clipboard.writeText(script.detailedScript);
    setCopied(true);
    notify('Full speaking script copied to clipboard.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const updatePoint = (index: number, value: string) => {
    const next = [...script.mainPoints];
    next[index] = value;
    setScript({ ...script, mainPoints: next });
  };

  const addPoint = () => {
    setScript({ ...script, mainPoints: [...script.mainPoints, ''] });
  };

  const removePoint = (index: number) => {
    setScript({
      ...script,
      mainPoints: script.mainPoints.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            {activeProject.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{activeProject.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{activeProject.language}</span>
            <span aria-hidden="true">·</span>
            <span>{activeProject.tone}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{wordCount} words</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">~{estSeconds}s read time</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleCopyFull}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Script'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Changes</span>
          </button>
          <button
            onClick={() => navigate('speaking')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold"
          >
            <span>Open Speaking Guide</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* AI Script Rewrite Controls */}
      <section className="studio-panel rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">AI Script Direction Tools</h2>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-blue-400 shrink-0" />
            <select
              aria-label="Target rewrite language"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="rounded-lg bg-[#090F24] border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            >
              {LANGUAGES.filter((l) => l !== 'Other').map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button
              disabled={rewriting !== null}
              onClick={() => handleRewrite('translate')}
              className="px-3 py-1.5 rounded-lg bg-violet-600/25 hover:bg-violet-600/40 border border-violet-500/35 text-xs font-medium text-violet-100 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {rewriting === 'translate' ? 'Rewriting...' : 'Rewrite in Language'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {REWRITE_ACTIONS.map((btn) => (
            <button
              key={btn.id}
              disabled={rewriting !== null}
              onClick={() => handleRewrite(btn.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B122A] hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50"
            >
              {rewriting === btn.id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              ) : (
                <RefreshCw className="w-3 h-3 text-blue-400" />
              )}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Main Split: Detailed Speaking Script + Structured A-I Blueprint */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* E. Detailed Speaking Script */}
        <section className="lg:col-span-7 studio-panel rounded-2xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-white">
              E. Detailed Speaking Script
            </h2>
            <span className="text-xs text-slate-400">Read-aloud master draft</span>
          </div>
          <textarea
            rows={18}
            value={script.detailedScript}
            onChange={(e) => setScript({ ...script, detailedScript: e.target.value })}
            className="w-full p-4 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm sm:text-base text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
          />
        </section>

        {/* Structured Sections A-I */}
        <section className="lg:col-span-5 space-y-4">
          {[
            { key: 'hook', label: 'A. Attention-Grabbing Hook', rows: 2 },
            { key: 'introduction', label: 'B. Natural Introduction', rows: 2 },
            { key: 'relatableStory', label: 'D. Relatable Example or Story', rows: 3 },
            { key: 'emotionalConnection', label: 'F. Emotional Connection', rows: 2 },
            { key: 'takeaway', label: 'G. Useful Takeaway', rows: 2 },
            { key: 'closing', label: 'H. Natural Closing', rows: 2 },
            { key: 'callToAction', label: 'I. Call to Action', rows: 2 },
          ].map((sec) => (
            <div key={sec.key} className="studio-panel rounded-xl p-4">
              <label className="block text-xs font-semibold text-blue-300 mb-2">{sec.label}</label>
              <textarea
                rows={sec.rows}
                value={script[sec.key as keyof Omit<ScriptSections, 'mainPoints'>]}
                onChange={(e) =>
                  setScript({
                    ...script,
                    [sec.key]: e.target.value,
                  })
                }
                className="w-full p-3 rounded-lg bg-[#090F24] border border-slate-800 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>
          ))}

          {/* C. Main Talking Points */}
          <div className="studio-panel rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300">C. Main Talking Points</span>
              <button
                type="button"
                onClick={addPoint}
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Add point
              </button>
            </div>
            {script.mainPoints.map((pt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500 w-5">{idx + 1}.</span>
                <input
                  type="text"
                  value={pt}
                  onChange={(e) => updatePoint(idx, e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => removePoint(idx)}
                  aria-label="Remove talking point"
                  className="p-1.5 text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
