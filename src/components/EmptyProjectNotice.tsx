import { Sparkles, FolderKanban } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export function EmptyProjectNotice({ studioName }: { studioName: string }) {
  const { navigate, projects } = useStudio();
  return (
    <div className="studio-panel rounded-2xl p-10 text-center max-w-xl mx-auto mt-8">
      <h2 className="font-display text-xl font-semibold text-white mb-2">
        Select or create a project to open {studioName}
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Generate a fresh video concept with VlogSpark AI or reopen one of your saved projects.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => navigate('generator')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold"
        >
          <Sparkles className="w-4 h-4" />
          Generate New Content
        </button>
        {projects.length > 0 && (
          <button
            onClick={() => navigate('projects')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-200 text-sm font-medium"
          >
            <FolderKanban className="w-4 h-4" />
            Open My Projects
          </button>
        )}
      </div>
    </div>
  );
}
