import React, { useEffect, useState } from 'react';
import { Save, Loader2, LogOut, ShieldCheck, Server } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { LANGUAGES, PLATFORMS, TONES, type AspectRatio, type VideoResolution } from '../types';

export function SettingsPage() {
  const { user, profile, health, saveProfileUpdates, handleSignOut, notify } = useStudio();
  const [displayName, setDisplayName] = useState('');
  const [defaultPlatform, setDefaultPlatform] = useState('YouTube');
  const [defaultLanguage, setDefaultLanguage] = useState('English');
  const [defaultTone, setDefaultTone] = useState('Casual and conversational');
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<AspectRatio>('16:9');
  const [defaultResolution, setDefaultResolution] = useState<VideoResolution>('720p');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || user?.displayName || '');
      setDefaultPlatform(profile.defaultPlatform || 'YouTube');
      setDefaultLanguage(profile.defaultLanguage || 'English');
      setDefaultTone(profile.defaultTone || 'Casual and conversational');
      setDefaultAspectRatio(profile.defaultAspectRatio || '16:9');
      setDefaultResolution(profile.defaultResolution || '720p');
    } else if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [profile, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      notify('Display name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveProfileUpdates({
        displayName: displayName.trim(),
        defaultPlatform,
        defaultLanguage,
        defaultTone,
        defaultAspectRatio,
        defaultResolution,
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">
          Studio Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your creator profile and default generation preferences synced to your Firebase
          account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="studio-panel rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-base font-semibold text-white">Creator Defaults</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Account Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24]/60 border border-slate-800/70 text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Default Platform</label>
            <select
              value={defaultPlatform}
              onChange={(e) => setDefaultPlatform(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Default Language</label>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
            >
              {LANGUAGES.filter((l) => l !== 'Other').map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Default Tone</label>
            <select
              value={defaultTone}
              onChange={(e) => setDefaultTone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Aspect Ratio</label>
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value as AspectRatio)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
              >
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Resolution</label>
              <select
                value={defaultResolution}
                onChange={(e) => setDefaultResolution(e.target.value as VideoResolution)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-white"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700 hover:border-red-500/40 text-xs font-medium text-slate-300 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Preferences</span>
          </button>
        </div>
      </form>

      {/* Studio Runtime & Privacy Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="studio-panel rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="font-display text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            Connected Production Services
          </h3>
          <dl className="space-y-2 text-slate-300">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Script &amp; Planning Engine</dt>
              <dd className="font-mono">{health?.models.script || 'gemini-4-hydrogen'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Server Video Renderer</dt>
              <dd>{health?.ffmpegAvailable ? 'FFmpeg MP4 Ready' : 'Browser WebM Active'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">AI Image &amp; Omni Video</dt>
              <dd className="text-slate-400">Uses server key (billing when enabled)</dd>
            </div>
          </dl>
        </div>

        <div className="studio-panel rounded-2xl p-5 space-y-3 text-xs">
          <h3 className="font-display text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Account &amp; Workspace Privacy
          </h3>
          <p className="text-slate-400 leading-relaxed">
            Your projects, scripts, scene plans, and preferences are protected by per-user Firestore
            security rules. Only your authenticated Firebase UID can read or modify your workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
