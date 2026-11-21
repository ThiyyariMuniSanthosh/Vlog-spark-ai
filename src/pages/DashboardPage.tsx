import React, { useState } from 'react';
import {
  Plus,
  Sparkles,
  ArrowRight,
  Film,
  FileText,
  Clock,
  Lightbulb,
  FolderOpen,
  FolderKanban,
  FilePenLine,
  TrendingUp,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';

interface DashboardPageProps {
  onQuickStartTopic: (topic: string) => void;
}

const CREATOR_TIPS = [
  {
    title: 'Hook within the first 3 seconds',
    body: 'Open with a sharp relatable question or clear outcome before introducing yourself.',
  },
  {
    title: 'Use the Teleprompter at eye level',
    body: 'Set font size to 32px+ and match scroll speed to your natural breathing pace for effortless eye contact.',
  },
  {
    title: 'Layer subtle music under your voice',
    body: 'Keep background music around 15–25% volume so your recorded narration always stays crisp and clear.',
  },
];

export function DashboardPage({ onQuickStartTopic }: DashboardPageProps) {
  const { user, profile, projects, projectsLoading, activities, navigate, selectProject } =
    useStudio();
  const [quickIdea, setQuickIdea] = useState('');

  const totalProjects = projects.length;
  const activeDrafts = projects.filter((p) => p.status !== 'exported').length;
  const exportedProjects = projects.filter((p) => p.status === 'exported').length;
  const completedExports = projects.reduce((sum, p) => sum + (p.exports?.length || 0), 0);
  const totalScenes = projects.reduce((sum, p) => sum + (p.scenes?.length || 0), 0);
  const exportProgressPct =
    totalProjects > 0 ? Math.round((exportedProjects / totalProjects) * 100) : 0;

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickIdea.trim()) {
      navigate('generator');
      return;
    }
    onQuickStartTopic(quickIdea.trim());
    setQuickIdea('');
  };

  const firstName = (profile?.displayName || user?.displayName || 'Creator').split(' ')[0];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="studio-panel rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-blue-400 mb-1.5">Creator Workspace</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xl">
            Turn a simple idea into a natural script, speaking guide, scene plan, and verified MP4 video.
          </p>
        </div>

        <button
          onClick={() => navigate('generator')}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>CREATE NEW VIDEO</span>
        </button>
      </section>

      {/* Production Summary Card */}
      <section className="studio-panel rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Production Summary</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live snapshot of your workspace drafts and video export progress
            </p>
          </div>
          <button
            onClick={() => navigate('projects')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-blue-500/60 text-xs font-medium text-blue-300 hover:text-white transition-colors whitespace-nowrap"
          >
            <span>Open All Projects</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
          <div className="flex items-start gap-3.5 pb-4 md:pb-0 md:pr-5 border-b md:border-b-0 md:border-r border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-blue-500/12 border border-blue-500/25 flex items-center justify-center shrink-0">
              <FolderKanban className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Projects Created</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white mt-1">
                {totalProjects}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {totalScenes} total planned scenes
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 pb-4 md:pb-0 md:pr-5 border-b md:border-b-0 md:border-r border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-violet-500/12 border border-violet-500/25 flex items-center justify-center shrink-0">
              <FilePenLine className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Active Drafts</p>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white mt-1">
                {activeDrafts}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">In scripting or editing</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/12 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-slate-400">Export Progress</p>
                <span className="font-mono tabular-nums text-xs font-semibold text-emerald-400">
                  {exportProgressPct}%
                </span>
              </div>
              <p className="font-mono tabular-nums text-2xl font-semibold text-white mt-1">
                {exportedProjects}
                <span className="text-sm text-slate-500 font-normal"> / {totalProjects}</span>
              </p>
              <div className="h-2 rounded-full bg-slate-800/90 overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${exportProgressPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
                {completedExports} playable video export{completedExports === 1 ? '' : 's'} saved
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quick AI Generator Bar */}
      <section className="studio-panel rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h2 className="font-display text-lg font-semibold text-white">Quick AI Generator</h2>
        </div>
        <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={quickIdea}
            onChange={(e) => setQuickIdea(e.target.value)}
            placeholder="Enter a topic idea (e.g., 5 smartphone habits destroying student focus)..."
            className="flex-1 px-4 py-3 rounded-xl bg-[#090F24] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <span>Configure &amp; Generate</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* Main Split: Recent Projects + Activity & Tips */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Projects */}
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Recent Projects</h2>
            <button
              onClick={() => navigate('projects')}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All Projects
            </button>
          </div>

          {projectsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="studio-panel rounded-2xl p-10 text-center">
              <FolderOpen className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">No video projects yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
                Start with any topic or idea. VlogSpark AI will craft your script, speaking guide,
                scene storyboard, and captions in seconds.
              </p>
              <button
                onClick={() => navigate('generator')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create Your First Video
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 studio-panel rounded-2xl overflow-hidden">
              {projects.slice(0, 6).map((proj) => (
                <div
                  key={proj.id}
                  className="p-5 hover:bg-slate-800/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <button
                      onClick={() => selectProject(proj.id, 'script')}
                      className="text-left font-semibold text-white hover:text-blue-400 transition-colors truncate block max-w-full"
                    >
                      {proj.title}
                    </button>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1.5">
                      <span>{proj.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.language}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{proj.scenes.length} scenes</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {proj.status === 'exported'
                          ? 'Exported'
                          : proj.status === 'in_progress'
                            ? 'In Progress'
                            : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => selectProject(proj.id, 'script')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Script
                    </button>
                    <button
                      onClick={() => selectProject(proj.id, 'editor')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-xs font-medium text-blue-200 transition-colors whitespace-nowrap"
                    >
                      <Film className="w-3.5 h-3.5" />
                      Editor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Recent Activity & Creator Tips */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-violet-400" />
              <h2 className="font-display text-base font-semibold text-white">Recent Activity</h2>
            </div>
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500">
                Your script generations, recordings, and video exports will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {activities.slice(0, 6).map((act) => (
                  <li key={act.id} className="text-xs pb-3 border-b border-slate-800/70 last:border-0 last:pb-0">
                    <p className="text-slate-200 leading-snug">{act.summary}</p>
                    <p className="text-slate-500 mt-1 tabular-nums">
                      {act.createdAt ? new Date(act.createdAt).toLocaleString() : 'Just now'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="studio-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <h2 className="font-display text-base font-semibold text-white">Creator Tips</h2>
            </div>
            <div className="space-y-4">
              {CREATOR_TIPS.map((tip) => (
                <div key={tip.title}>
                  <p className="text-xs font-semibold text-slate-200">{tip.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tip.body}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
