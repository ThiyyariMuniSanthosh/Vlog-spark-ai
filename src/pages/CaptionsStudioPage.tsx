import { useEffect, useState } from 'react';
import { Copy, Check, Save, RefreshCw, Loader2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import { generateCaptionsApi } from '../services/api';
import type { CaptionsPack } from '../types';

export function CaptionsStudioPage() {
  const { activeProject, saveProjectUpdates, notify } = useStudio();
  const [captions, setCaptions] = useState<CaptionsPack | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject) {
      setCaptions(activeProject.captions);
    }
  }, [activeProject]);

  if (!activeProject || !captions) {
    return <EmptyProjectNotice studioName="Captions & Hashtags Studio" />;
  }

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    notify('Copied to clipboard.', 'success');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProjectUpdates(
        activeProject.id,
        { captions },
        `Updated captions and hashtags for "${activeProject.title}"`,
      );
      notify('Captions and hashtags saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save captions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await generateCaptionsApi({
        topic: activeProject.topic,
        scriptText: activeProject.script.detailedScript,
        platform: activeProject.platform,
        language: activeProject.language,
        tone: activeProject.tone,
        category: activeProject.category,
      });
      setCaptions(res.captions);
      await saveProjectUpdates(
        activeProject.id,
        { captions: res.captions },
        'Regenerated social captions and hashtags',
      );
      notify('Fresh captions and hashtags generated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to regenerate captions.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const captionCards: { key: keyof CaptionsPack; title: string; subtitle: string }[] = [
    { key: 'shortCaption', title: 'Short Caption', subtitle: 'Punchy hook for Shorts, Reels & X' },
    {
      key: 'storytellingCaption',
      title: 'Storytelling Caption',
      subtitle: 'Narrative emotional hook for feed engagement',
    },
    {
      key: 'professionalCaption',
      title: 'Professional Caption',
      subtitle: 'Credible framing for LinkedIn & YouTube',
    },
    {
      key: 'engagingCaption',
      title: 'Engaging Caption',
      subtitle: 'Conversation starter designed for comments & shares',
    },
  ];

  const hashtagsString = captions.hashtags.join(' ');
  const keywordsString = captions.keywords.join(', ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Captions &amp; Hashtags Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Publish-ready titles, descriptions, caption variants, hashtags, and SEO keywords for{' '}
            {activeProject.platform}.
          </p>
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
            <span>Regenerate All</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Copy</span>
          </button>
        </div>
      </div>

      {/* Suggested Title & Description */}
      <div className="studio-panel rounded-2xl p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-blue-300">Suggested Post Title</label>
            <button
              onClick={() => copyText('title', captions.postTitle)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'title' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <input
            type="text"
            value={captions.postTitle}
            onChange={(e) => setCaptions({ ...captions, postTitle: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-blue-300">Suggested Post Description</label>
            <button
              onClick={() => copyText('desc', captions.postDescription)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
            >
              {copiedKey === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'desc' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={captions.postDescription}
            onChange={(e) => setCaptions({ ...captions, postDescription: e.target.value })}
            className="w-full p-3.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* 4 Caption Styles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {captionCards.map((card) => {
          const val = String(captions[card.key] || '');
          return (
            <article key={card.key} className="studio-panel rounded-2xl p-5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">{card.title}</h2>
                  <p className="text-xs text-slate-500">{card.subtitle}</p>
                </div>
                <button
                  onClick={() => copyText(card.key, `${val}\n\n${hashtagsString}`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs text-slate-200 whitespace-nowrap"
                >
                  {copiedKey === card.key ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === card.key ? 'Copied' : 'Copy + Tags'}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={val}
                onChange={(e) => setCaptions({ ...captions, [card.key]: e.target.value })}
                className="w-full p-3 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500"
              />
            </article>
          );
        })}
      </div>

      {/* Hashtags & Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="studio-panel rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Platform-Specific Hashtags</h2>
            <button
              onClick={() => copyText('hashtags', hashtagsString)}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              {copiedKey === 'hashtags' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'hashtags' ? 'Copied' : 'Copy All'}</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={hashtagsString}
            onChange={(e) =>
              setCaptions({
                ...captions,
                hashtags: e.target.value
                  .split(/\s+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full p-3 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-blue-300 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="studio-panel rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">SEO &amp; Discovery Keywords</h2>
            <button
              onClick={() => copyText('keywords', keywordsString)}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              {copiedKey === 'keywords' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'keywords' ? 'Copied' : 'Copy All'}</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={keywordsString}
            onChange={(e) =>
              setCaptions({
                ...captions,
                keywords: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full p-3 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
