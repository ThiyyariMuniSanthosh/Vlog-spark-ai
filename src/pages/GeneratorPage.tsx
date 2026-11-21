import React, { useEffect, useState } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import {
  generateCaptionsApi,
  generateScenesApi,
  generateScriptApi,
} from '../services/api';
import {
  CATEGORIES,
  DURATIONS,
  LANGUAGES,
  PLATFORMS,
  SCRIPT_STYLES,
  TONES,
  type AspectRatio,
  type GeneratorFormInput,
} from '../types';

interface GeneratorPageProps {
  initialTopic?: string;
  onClearInitialTopic?: () => void;
}

const SAMPLE_IDEAS = [
  'Why most college students burn out before exams and 3 realistic habits to stay calm',
  'How electric vehicle regenerative braking actually saves battery range in city traffic',
  'Street food tour storytelling: What makes Hyderabad Irani chai unforgettable',
];

export function GeneratorPage({ initialTopic, onClearInitialTopic }: GeneratorPageProps) {
  const { profile, createProject, navigate, notify } = useStudio();

  const [form, setForm] = useState<GeneratorFormInput>({
    topic: initialTopic || '',
    platform: profile?.defaultPlatform || 'YouTube',
    language: profile?.defaultLanguage || 'English',
    customLanguage: '',
    category: 'Education',
    tone: profile?.defaultTone || 'Casual and conversational',
    duration: '60 seconds',
    customDuration: '',
    audience: 'Curious everyday viewers and learners',
    objective: 'Hook attention fast and leave viewers with one clear practical takeaway',
    scriptStyle: 'Direct-to-camera vlog',
  });

  const [generating, setGenerating] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTopic) {
      setForm((prev) => ({ ...prev, topic: initialTopic }));
      onClearInitialTopic?.();
    }
  }, [initialTopic, onClearInitialTopic]);

  const stages = [
    'Understanding topic & writing natural human script + speaking guide...',
    'Building scene-by-scene production plan & camera directions...',
    'Creating platform captions, SEO keywords & hashtags...',
    'Saving complete production project to your workspace...',
  ];

  const inferAspectRatio = (platform: string): AspectRatio => {
    if (['YouTube Shorts', 'Instagram Reels', 'TikTok'].includes(platform)) return '9:16';
    if (platform === 'Instagram Posts') return '1:1';
    return profile?.defaultAspectRatio || '16:9';
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.topic.trim().length < 3) {
      setError('Please enter a topic or video idea (at least 3 characters).');
      return;
    }

    setError(null);
    setGenerating(true);
    setStageIndex(0);

    try {
      const resolvedLanguage =
        form.language === 'Other' && form.customLanguage?.trim()
          ? form.customLanguage.trim()
          : form.language;
      const resolvedDuration =
        form.duration === 'Custom' && form.customDuration?.trim()
          ? form.customDuration.trim()
          : form.duration;

      // 1. Script + Speaking Guide
      const scriptRes = await generateScriptApi(form);

      // 2. Scene Plan & Captions in parallel once script is ready
      setStageIndex(1);
      const [scenesRes, captionsRes] = await Promise.all([
        generateScenesApi({
          topic: form.topic.trim(),
          scriptText: scriptRes.script.detailedScript,
          platform: form.platform,
          duration: resolvedDuration,
          tone: form.tone,
          language: resolvedLanguage,
        }),
        generateCaptionsApi({
          topic: form.topic.trim(),
          scriptText: scriptRes.script.detailedScript,
          platform: form.platform,
          language: resolvedLanguage,
          tone: form.tone,
          category: form.category,
        }),
      ]);

      setStageIndex(3);
      const aspectRatio = inferAspectRatio(form.platform);

      await createProject(
        {
          title: scriptRes.suggestedTitle || form.topic.trim().slice(0, 80),
          topic: form.topic.trim(),
          platform: form.platform,
          language: resolvedLanguage,
          category: form.category,
          tone: form.tone,
          duration: resolvedDuration,
          audience: form.audience.trim() || 'General viewers',
          objective: form.objective.trim() || 'Engage and inform',
          scriptStyle: form.scriptStyle,
          status: 'draft',
          script: scriptRes.script,
          speakingGuide: scriptRes.speakingGuide,
          scenes: scenesRes.scenes,
          captions: captionsRes.captions,
          audio: {
            narrationVolume: 1,
            trimStart: 0,
            trimEnd: 0,
            bgMusicVolume: 0.22,
          },
          editorConfig: {
            aspectRatio,
            resolution: profile?.defaultResolution || '720p',
            includeIntro: true,
            introTitle: scriptRes.suggestedTitle || form.topic.trim().slice(0, 60),
            introSubtitle: `${form.platform} · ${resolvedLanguage}`,
            includeOutro: true,
            outroText: scriptRes.script.callToAction?.slice(0, 90) || 'Follow for more stories',
            includeCaptions: true,
            includeAudio: true,
            captionPosition: 'bottom',
            defaultTransition: 'fade',
          },
          exports: [],
        },
        `Generated full production package for "${scriptRes.suggestedTitle}"`,
      );

      notify('Your complete content package is ready!', 'success');
      navigate('script');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to generate content. Please check your connection and try again.';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          AI Content Generator
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Describe your idea once. VlogSpark AI creates your natural script, speaking guide, scene
          production plan, and platform captions together.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGenerate} className="studio-panel rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Topic */}
        <div>
          <label htmlFor="topic" className="block text-sm font-semibold text-white mb-2">
            Topic or Video Idea
          </label>
          <textarea
            id="topic"
            rows={3}
            required
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="What do you want to talk about? Share a raw thought, question, review, or tutorial topic..."
            className="w-full px-4 py-3 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-y"
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SAMPLE_IDEAS.map((idea, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setForm({ ...form, topic: idea })}
                className="text-xs text-slate-400 hover:text-blue-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-colors text-left"
              >
                Try: {idea.slice(0, 56)}...
              </button>
            ))}
          </div>
        </div>

        {/* Core Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {form.language === 'Other' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Custom Language
              </label>
              <input
                type="text"
                value={form.customLanguage}
                onChange={(e) => setForm({ ...form, customLanguage: e.target.value })}
                placeholder="e.g., Japanese, Arabic, Hinglish"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Content Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Tone</label>
            <select
              value={form.tone}
              onChange={(e) => setForm({ ...form, tone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Video Duration
            </label>
            <select
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {form.duration === 'Custom' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Custom Duration
              </label>
              <input
                type="text"
                value={form.customDuration}
                onChange={(e) => setForm({ ...form, customDuration: e.target.value })}
                placeholder="e.g., 2 minutes 30 seconds"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Script Style</label>
            <select
              value={form.scriptStyle}
              onChange={(e) => setForm({ ...form, scriptStyle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {SCRIPT_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Audience & Objective */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Audience
            </label>
            <input
              type="text"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              placeholder="e.g., First-year college students, indie founders"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Content Objective
            </label>
            <input
              type="text"
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="e.g., Spark discussion in comments, teach a quick workflow"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Generation Progress Display */}
        {generating && (
          <div className="rounded-xl bg-[#090F24] border border-blue-500/30 p-5 space-y-2.5">
            {stages.map((label, idx) => (
              <div key={label} className="flex items-center gap-2.5 text-xs">
                {idx < stageIndex ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : idx === stageIndex ? (
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 inline-block" />
                )}
                <span className={idx <= stageIndex ? 'text-slate-100' : 'text-slate-500'}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            Creates Script A–I · Speaking Guide · Scene Planner · Captions &amp; Hashtags
          </p>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>DIRECTING CONTENT...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>GENERATE MY CONTENT</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
