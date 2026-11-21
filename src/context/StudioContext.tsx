import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, testFirestoreConnection, signOutUser } from '../firebase';
import {
  createProjectInFirestore,
  deleteProjectInFirestore,
  ensureUserProfile,
  logCreatorActivity,
  subscribeUserActivities,
  subscribeUserProjects,
  updateProjectInFirestore,
  updateUserProfile,
} from '../services/firestoreService';
import { fetchSystemHealth } from '../services/api';
import type { ActivityLog, AppPage, SystemHealth, UserProfile, VlogProject } from '../types';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface StudioContextValue {
  user: User | null;
  authReady: boolean;
  profile: UserProfile | null;
  projects: VlogProject[];
  projectsLoading: boolean;
  activities: ActivityLog[];
  activeProject: VlogProject | null;
  activeProjectId: string | null;
  currentPage: AppPage;
  health: SystemHealth | null;
  toasts: ToastMessage[];
  navigate: (page: AppPage) => void;
  selectProject: (projectId: string | null, nextPage?: AppPage) => void;
  createProject: (
    data: Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
    activitySummary?: string,
  ) => Promise<VlogProject>;
  saveProjectUpdates: (
    projectId: string,
    updates: Partial<Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
    activitySummary?: string,
  ) => Promise<void>;
  duplicateProject: (project: VlogProject) => Promise<VlogProject>;
  deleteProject: (projectId: string) => Promise<void>;
  saveProfileUpdates: (
    updates: Partial<
      Pick<
        UserProfile,
        | 'displayName'
        | 'defaultPlatform'
        | 'defaultLanguage'
        | 'defaultTone'
        | 'defaultAspectRatio'
        | 'defaultResolution'
      >
    >,
  ) => Promise<void>;
  notify: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: (id: string) => void;
  handleSignOut: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

const PROTECTED_PAGES = new Set<AppPage>([
  'dashboard',
  'generator',
  'script',
  'speaking',
  'scenes',
  'visuals',
  'voice',
  'editor',
  'captions',
  'projects',
  'export',
  'settings',
]);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<VlogProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<AppPage>('landing');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Boot check: Firestore reachability + server health
  useEffect(() => {
    testFirestoreConnection().catch(() => {});
    fetchSystemHealth()
      .then(setHealth)
      .catch(() => {});
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);

      if (fbUser) {
        if (fbUser.emailVerified) {
          try {
            const prof = await ensureUserProfile({
              uid: fbUser.uid,
              displayName: fbUser.displayName,
              email: fbUser.email,
              photoURL: fbUser.photoURL,
            });
            setProfile(prof);
          } catch (err) {
            console.error('Profile sync error:', err);
          }
        }
        setCurrentPage((prev) => (prev === 'auth' ? 'dashboard' : prev));
      } else {
        setProfile(null);
        setProjects([]);
        setActivities([]);
        setActiveProjectId(null);
        setCurrentPage((prev) => (PROTECTED_PAGES.has(prev) ? 'auth' : prev));
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to user's Firestore projects & activities only after auth is ready
  useEffect(() => {
    if (!authReady || !user) {
      setProjects([]);
      setActivities([]);
      return;
    }
    setProjectsLoading(true);
    const unsubProjects = subscribeUserProjects(
      user.uid,
      (list) => {
        setProjects(list);
        setProjectsLoading(false);
        setActiveProjectId((curr) => {
          if (curr && list.some((p) => p.id === curr)) return curr;
          return list[0]?.id ?? null;
        });
      },
      (err) => {
        setProjectsLoading(false);
        notify(
          err.message.includes('Quota exceeded')
            ? 'Firestore daily free-tier read quota exceeded. It resets tomorrow.'
            : 'Unable to sync projects right now. Check your account verification and connection.',
          'error',
        );
      },
    );

    const unsubActs = subscribeUserActivities(user.uid, setActivities);
    return () => {
      unsubProjects();
      unsubActs();
    };
  }, [authReady, user, notify]);

  const navigate = useCallback(
    (page: AppPage) => {
      if (PROTECTED_PAGES.has(page) && !user) {
        setCurrentPage('auth');
        notify('Sign in to open your creator studio and save projects.', 'info');
        return;
      }
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [user, notify],
  );

  const selectProject = useCallback((projectId: string | null, nextPage?: AppPage) => {
    setActiveProjectId(projectId);
    if (nextPage) {
      setCurrentPage(nextPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  const createProject = useCallback(
    async (
      data: Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
      activitySummary?: string,
    ) => {
      if (!user) throw new Error('Please sign in to create a project.');
      if (!user.emailVerified) {
        throw new Error('Please verify your email address (or sign in with Google) to save projects.');
      }
      const created = await createProjectInFirestore(user.uid, data);
      setActiveProjectId(created.id);
      await logCreatorActivity(
        user.uid,
        'project_created',
        activitySummary || `Created "${created.title}" for ${created.platform}`,
        created.id,
      );
      return created;
    },
    [user],
  );

  const saveProjectUpdates = useCallback(
    async (
      projectId: string,
      updates: Partial<Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
      activitySummary?: string,
    ) => {
      if (!user) throw new Error('Please sign in to save changes.');
      if (!user.emailVerified) {
        throw new Error('Verify your email address to save changes to Firestore.');
      }
      await updateProjectInFirestore(projectId, updates);
      if (activitySummary) {
        await logCreatorActivity(user.uid, 'project_updated', activitySummary, projectId);
      }
    },
    [user],
  );

  const duplicateProject = useCallback(
    async (project: VlogProject) => {
      const { id: _id, ownerId: _ownerId, createdAt: _c, updatedAt: _u, ...rest } = project;
      const copy = await createProject(
        {
          ...rest,
          title: `${project.title.slice(0, 145)} (Copy)`,
          status: 'draft',
          exports: [],
        },
        `Duplicated "${project.title}"`,
      );
      notify(`Duplicated "${project.title}"`, 'success');
      return copy;
    },
    [createProject, notify],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      if (!user) return;
      const target = projects.find((p) => p.id === projectId);
      await deleteProjectInFirestore(projectId);
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
      }
      await logCreatorActivity(
        user.uid,
        'project_deleted',
        `Deleted project "${target?.title || projectId}"`,
      );
      notify('Project permanently deleted.', 'success');
    },
    [user, projects, activeProjectId, notify],
  );

  const saveProfileUpdates = useCallback(
    async (
      updates: Partial<
        Pick<
          UserProfile,
          | 'displayName'
          | 'defaultPlatform'
          | 'defaultLanguage'
          | 'defaultTone'
          | 'defaultAspectRatio'
          | 'defaultResolution'
        >
      >,
    ) => {
      if (!user) return;
      await updateUserProfile(user.uid, updates);
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      notify('Studio preferences saved.', 'success');
    },
    [user, notify],
  );

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    setCurrentPage('landing');
    notify('Signed out of VlogSpark AI.', 'info');
  }, [notify]);

  return (
    <StudioContext.Provider
      value={{
        user,
        authReady,
        profile,
        projects,
        projectsLoading,
        activities,
        activeProject,
        activeProjectId,
        currentPage,
        health,
        toasts,
        navigate,
        selectProject,
        createProject,
        saveProjectUpdates,
        duplicateProject,
        deleteProject,
        saveProfileUpdates,
        notify,
        dismissToast,
        handleSignOut,
      }}
    >
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
