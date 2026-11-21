import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Copy,
  Trash2,
  Pencil,
  Check,
  X,
  FolderOpen,
  FileText,
  Film,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { PLATFORMS, type VlogProject } from '../types';

export function ProjectsPage() {
  const {
    projects,
    projectsLoading,
    activeProjectId,
    selectProject,
    saveProjectUpdates,
    duplicateProject,
    deleteProject,
    navigate,
    notify,
  } = useStudio();

  const [query, setQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<VlogProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (platformFilter !== 'All' && p.platform !== platformFilter) return false;
        if (!q) return true;
        return (
          p.title.toLowerCase().includes(q) ||
          p.topic.toLowerCase().includes(q) ||
          p.language.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'created') return (b.createdAt || '').localeCompare(a.createdAt || '');
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [projects, query, platformFilter, sortBy]);

  const startRename = (proj: VlogProject) => {
    setRenamingId(proj.id);
    setRenameValue(proj.title);
  };

  const commitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    try {
      await saveProjectUpdates(id, { title: trimmed }, `Renamed project to "${trimmed}"`);
      setRenamingId(null);
      notify('Project renamed.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Rename failed.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteProject(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">My Projects</h1>
          <p className="text-sm text-slate-400 mt-1">
            All scripts, scene plans, recordings, and video exports saved privately to your Firebase
            account.
          </p>
        </div>

        <button
          onClick={() => navigate('generator')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter & Sort Controls */}
      <div className="studio-panel rounded-2xl p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects by title, topic, or language..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          aria-label="Filter by platform"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-200"
        >
          <option value="All">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort projects"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'updated' | 'created' | 'title')}
          className="px-3.5 py-2.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-200"
        >
          <option value="updated">Sort: Recently Updated</option>
          <option value="created">Sort: Date Created</option>
          <option value="title">Sort: Alphabetical</option>
        </select>
      </div>

      {/* Project List */}
      {projectsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="studio-panel rounded-2xl p-12 text-center">
          <FolderOpen className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">
            {projects.length === 0 ? 'No projects saved yet' : 'No matching projects'}
          </h2>
          <p className="text-sm text-slate-400 mb-5">
            {projects.length === 0
              ? 'Generate your first video concept to populate your workspace.'
              : 'Try adjusting your search or platform filter.'}
          </p>
          {projects.length === 0 && (
            <button
              onClick={() => navigate('generator')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              Generate Content
            </button>
          )}
        </div>
      ) : (
        <div className="studio-panel rounded-2xl divide-y divide-slate-800/80 overflow-hidden">
          {filtered.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <div
                key={proj.id}
                className={`p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                  isActive ? 'bg-blue-600/8' : 'hover:bg-slate-800/25'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {renamingId === proj.id ? (
                    <div className="flex items-center gap-2 max-w-md">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename(proj.id)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#090F24] border border-blue-500 text-sm text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => commitRename(proj.id)}
                        aria-label="Save rename"
                        className="p-1.5 rounded-lg bg-emerald-600 text-white"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        aria-label="Cancel rename"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => selectProject(proj.id, 'script')}
                      className="text-left font-semibold text-base text-white hover:text-blue-400 transition-colors truncate block max-w-full"
                    >
                      {proj.title}
                    </button>
                  )}

                  <p className="text-xs text-slate-400 truncate mt-1">{proj.topic}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-2">
                    <span>{proj.platform}</span>
                    <span aria-hidden="true">·</span>
                    <span>{proj.language}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{proj.scenes.length} scenes</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{proj.exports.length} exports</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      Updated {proj.updatedAt ? new Date(proj.updatedAt).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => selectProject(proj.id, 'script')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs text-slate-200"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Open
                  </button>
                  <button
                    onClick={() => selectProject(proj.id, 'editor')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-xs text-blue-200"
                  >
                    <Film className="w-3.5 h-3.5" />
                    Editor
                  </button>
                  <button
                    onClick={() => startRename(proj)}
                    title="Rename project"
                    aria-label="Rename project"
                    className="p-2 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => duplicateProject(proj)}
                    title="Duplicate project"
                    aria-label="Duplicate project"
                    className="p-2 rounded-lg border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(proj)}
                    title="Delete project"
                    aria-label="Delete project"
                    className="p-2 rounded-lg border border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safe In-App Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="studio-panel rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-bold text-white">Delete this project?</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              &ldquo;{confirmDelete.title}&rdquo; will be permanently removed from your Firestore
              workspace. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
