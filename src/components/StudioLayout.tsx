import React, { useState } from 'react';
import {
  LayoutDashboard,
  Sparkles,
  FileText,
  Mic,
  Clapperboard,
  Image as ImageIcon,
  Radio,
  Film,
  Hash,
  FolderKanban,
  Download,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { VlogSparkLogo } from './Logo';
import type { AppPage } from '../types';

interface NavGroup {
  heading: string;
  items: { id: AppPage; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'generator', label: 'AI Generator', icon: Sparkles },
      { id: 'projects', label: 'My Projects', icon: FolderKanban },
    ],
  },
  {
    heading: 'Production Studio',
    items: [
      { id: 'script', label: 'Script Editor', icon: FileText },
      { id: 'speaking', label: 'Speaking Guide', icon: Radio },
      { id: 'scenes', label: 'Scene Planner', icon: Clapperboard },
      { id: 'visuals', label: 'AI Image Studio', icon: ImageIcon },
      { id: 'voice', label: 'Voice Studio', icon: Mic },
      { id: 'editor', label: 'Video Editor', icon: Film },
      { id: 'captions', label: 'Captions & Tags', icon: Hash },
      { id: 'export', label: 'Export Center', icon: Download },
    ],
  },
  {
    heading: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'help', label: 'Help & Tutorials', icon: HelpCircle },
    ],
  },
];

const PAGE_LABELS: Record<AppPage, string> = {
  landing: 'Home',
  auth: 'Sign In',
  dashboard: 'Creator Dashboard',
  generator: 'AI Content Generator',
  script: 'Script Editor',
  speaking: 'Speaking Guide & Teleprompter',
  scenes: 'Scene Planner',
  visuals: 'AI Visual Studio',
  voice: 'Voice Recording Studio',
  editor: 'Video Editor',
  captions: 'Captions & Hashtags Studio',
  projects: 'My Projects',
  export: 'Video Export Center',
  settings: 'Studio Settings',
  help: 'Help & Tutorials',
};

export function StudioLayout({ children }: { children: React.ReactNode }) {
  const {
    user,
    profile,
    projects,
    activeProject,
    currentPage,
    navigate,
    selectProject,
    handleSignOut,
    toasts,
    dismissToast,
  } = useStudio();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (page: AppPage) => {
    navigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen studio-canvas-bg text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-slate-800/80 bg-[#080D1F]/90 sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center border-b border-slate-800/80">
          <button
            onClick={() => navigate('landing')}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <VlogSparkLogo />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="px-3 mb-2 text-xs font-medium text-slate-500">{group.heading}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-gradient-to-r from-blue-600/25 to-violet-600/20 text-white border border-blue-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user && (
          <div className="p-3 border-t border-slate-800/80">
            <div className="flex items-center gap-3 px-2 py-2">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={profile?.displayName || user.displayName || 'Creator avatar'}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-semibold text-indigo-200 shrink-0">
                  {(profile?.displayName || user.displayName || user.email || 'C')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">
                  {profile?.displayName || user.displayName || 'Creator'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#080D1F] border-r border-slate-800 h-full flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800">
              <VlogSparkLogo />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {NAV_GROUPS.map((group) => (
                <div key={group.heading}>
                  <p className="px-3 mb-2 text-xs font-medium text-slate-500">{group.heading}</p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = currentPage === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNav(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                            active
                              ? 'bg-blue-600/20 text-white border border-blue-500/30'
                              : 'text-slate-300 hover:bg-slate-800/70'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            {user && (
              <div className="p-4 border-t border-slate-800">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Top Bar */}
        <header className="h-16 sticky top-0 z-30 border-b border-slate-800/80 bg-[#070B19]/85 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-500 hidden sm:inline whitespace-nowrap">Studio</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="font-medium text-white truncate">{PAGE_LABELS[currentPage]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {projects.length > 0 && (
              <select
                aria-label="Select active project"
                value={activeProject?.id || ''}
                onChange={(e) => selectProject(e.target.value || null)}
                className="hidden md:block max-w-[220px] truncate rounded-lg bg-[#0F172F] border border-slate-700/80 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => navigate('generator')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Video</span>
            </button>
          </div>
        </header>

        {/* Unverified Email Notice for Email/Password users */}
        {user && !user.emailVerified && (
          <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 lg:px-8 py-2.5 text-xs text-amber-200 flex items-center justify-between gap-4">
            <span>
              Verify your email address to enable cloud project saving in Firestore, or sign in with Google for instant verified access.
            </span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm backdrop-blur-md ${
                toast.tone === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/35 text-emerald-100'
                  : toast.tone === 'error'
                    ? 'bg-red-950/90 border-red-500/35 text-red-100'
                    : 'bg-slate-900/95 border-slate-700 text-slate-100'
              }`}
            >
              {toast.tone === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : toast.tone === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              )}
              <span className="flex-1 leading-snug">{toast.text}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss message"
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
