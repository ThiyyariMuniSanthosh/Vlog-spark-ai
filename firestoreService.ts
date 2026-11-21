import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { ActivityLog, UserProfile, VlogProject } from '../types';

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    try {
      return (val as Timestamp).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}

function clampStr(val: string | undefined, max: number, fallback = ''): string {
  return (val ?? fallback).trim().slice(0, max);
}

// Sanitize payload strictly matching firebase-blueprint.json & firestore.rules constraints
function sanitizeProjectForWrite(
  project: Omit<VlogProject, 'id' | 'createdAt' | 'updatedAt'>,
  ownerId: string,
) {
  return {
    ownerId,
    title: clampStr(project.title, 160, 'Untitled Video'),
    topic: clampStr(project.topic, 600, 'General Topic'),
    platform: clampStr(project.platform, 60, 'YouTube'),
    language: clampStr(project.language, 60, 'English'),
    category: clampStr(project.category, 60, 'Education'),
    tone: clampStr(project.tone, 80, 'Casual and conversational'),
    duration: clampStr(project.duration, 40, '60 seconds'),
    audience: clampStr(project.audience, 200, 'General viewers'),
    objective: clampStr(project.objective, 200, 'Educate and engage'),
    scriptStyle: clampStr(project.scriptStyle, 120, 'Direct-to-camera vlog'),
    status: project.status || 'draft',
    script: project.script || {
      hook: '',
      introduction: '',
      mainPoints: [],
      relatableStory: '',
      detailedScript: '',
      emotionalConnection: '',
      takeaway: '',
      closing: '',
      callToAction: '',
    },
    speakingGuide: (project.speakingGuide || []).slice(0, 120),
    scenes: (project.scenes || []).slice(0, 50),
    captions: project.captions || {
      shortCaption: '',
      storytellingCaption: '',
      professionalCaption: '',
      engagingCaption: '',
      hashtags: [],
      keywords: [],
      postTitle: '',
      postDescription: '',
    },
    audio: project.audio || {
      narrationVolume: 1,
      trimStart: 0,
      trimEnd: 0,
      bgMusicVolume: 0.25,
    },
    editorConfig: project.editorConfig || {
      aspectRatio: '16:9',
      resolution: '720p',
      includeIntro: true,
      introTitle: clampStr(project.title, 120, 'Untitled Video'),
      introSubtitle: 'VlogSpark AI Studio',
      includeOutro: true,
      outroText: 'Subscribe & follow for more',
      includeCaptions: true,
      includeAudio: true,
      captionPosition: 'bottom',
      defaultTransition: 'fade',
    },
    exports: (project.exports || []).slice(0, 30),
  };
}

export async function ensureUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: user.uid,
        displayName: String(data.displayName || user.displayName || 'Creator'),
        email: String(data.email || user.email || ''),
        photoURL: data.photoURL ? String(data.photoURL) : user.photoURL || undefined,
        defaultPlatform: String(data.defaultPlatform || 'YouTube'),
        defaultLanguage: String(data.defaultLanguage || 'English'),
        defaultTone: String(data.defaultTone || 'Casual and conversational'),
        defaultAspectRatio: (data.defaultAspectRatio as UserProfile['defaultAspectRatio']) || '16:9',
        defaultResolution: (data.defaultResolution as UserProfile['defaultResolution']) || '720p',
        createdAt: tsToIso(data.createdAt),
        updatedAt: tsToIso(data.updatedAt),
      };
    }

    const newProfile = {
      uid: user.uid,
      displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'Creator', 120, 'Creator'),
      email: clampStr(user.email || 'creator@vlogspark.app', 254),
      photoURL: clampStr(user.photoURL || '', 512),
      defaultPlatform: 'YouTube',
      defaultLanguage: 'English',
      defaultTone: 'Casual and conversational',
      defaultAspectRatio: '16:9' as const,
      defaultResolution: '720p' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, newProfile);
    return {
      ...newProfile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
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
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.displayName !== undefined) {
      clean.displayName = clampStr(updates.displayName, 120, 'Creator');
    }
    if (updates.defaultPlatform !== undefined) {
      clean.defaultPlatform = clampStr(updates.defaultPlatform, 60, 'YouTube');
    }
    if (updates.defaultLanguage !== undefined) {
      clean.defaultLanguage = clampStr(updates.defaultLanguage, 60, 'English');
    }
    if (updates.defaultTone !== undefined) {
      clean.defaultTone = clampStr(updates.defaultTone, 80, 'Casual and conversational');
    }
    if (updates.defaultAspectRatio !== undefined) {
      clean.defaultAspectRatio = updates.defaultAspectRatio;
    }
    if (updates.defaultResolution !== undefined) {
      clean.defaultResolution = updates.defaultResolution;
    }
    await updateDoc(ref, clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserProjects(
  uid: string,
  onData: (projects: VlogProject[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const colPath = 'projects';
  const q = query(collection(db, colPath), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: VlogProject[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || uid),
            title: String(data.title || 'Untitled Video'),
            topic: String(data.topic || ''),
            platform: String(data.platform || 'YouTube'),
            language: String(data.language || 'English'),
            category: String(data.category || 'Education'),
            tone: String(data.tone || 'Casual and conversational'),
            duration: String(data.duration || '60 seconds'),
            audience: String(data.audience || ''),
            objective: String(data.objective || ''),
            scriptStyle: String(data.scriptStyle || ''),
            status: (data.status as VlogProject['status']) || 'draft',
            script: data.script || {
              hook: '',
              introduction: '',
              mainPoints: [],
              relatableStory: '',
              detailedScript: '',
              emotionalConnection: '',
              takeaway: '',
              closing: '',
              callToAction: '',
            },
            speakingGuide: Array.isArray(data.speakingGuide) ? data.speakingGuide : [],
            scenes: Array.isArray(data.scenes) ? data.scenes : [],
            captions: data.captions || {
              shortCaption: '',
              storytellingCaption: '',
              professionalCaption: '',
              engagingCaption: '',
              hashtags: [],
              keywords: [],
              postTitle: '',
              postDescription: '',
            },
            audio: data.audio || {
              narrationVolume: 1,
              trimStart: 0,
              trimEnd: 0,
              bgMusicVolume: 0.25,
            },
            editorConfig: data.editorConfig || {
              aspectRatio: '16:9',
              resolution: '720p',
              includeIntro: true,
              introTitle: String(data.title || ''),
              introSubtitle: 'VlogSpark AI Studio',
              includeOutro: true,
              outroText: 'Thanks for watching',
              includeCaptions: true,
              includeAudio: true,
              captionPosition: 'bottom',
              defaultTransition: 'fade',
            },
            exports: Array.isArray(data.exports) ? data.exports : [],
            createdAt: tsToIso(data.createdAt),
            updatedAt: tsToIso(data.updatedAt),
          };
        })
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) onError(wrapped);
      }
    },
  );
}

export async function createProjectInFirestore(
  ownerId: string,
  project: Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
): Promise<VlogProject> {
  const projectId = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `projects/${projectId}`;
  const clean = sanitizeProjectForWrite({ ...project, ownerId }, ownerId);
  try {
    await setDoc(doc(db, 'projects', projectId), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = new Date().toISOString();
    return {
      id: projectId,
      ...clean,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateProjectInFirestore(
  projectId: string,
  updates: Partial<Omit<VlogProject, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.title !== undefined) clean.title = clampStr(updates.title, 160, 'Untitled Video');
    if (updates.topic !== undefined) clean.topic = clampStr(updates.topic, 600, 'General Topic');
    if (updates.platform !== undefined) clean.platform = clampStr(updates.platform, 60, 'YouTube');
    if (updates.language !== undefined) clean.language = clampStr(updates.language, 60, 'English');
    if (updates.category !== undefined) clean.category = clampStr(updates.category, 60);
    if (updates.tone !== undefined) clean.tone = clampStr(updates.tone, 80);
    if (updates.duration !== undefined) clean.duration = clampStr(updates.duration, 40);
    if (updates.audience !== undefined) clean.audience = clampStr(updates.audience, 200);
    if (updates.objective !== undefined) clean.objective = clampStr(updates.objective, 200);
    if (updates.scriptStyle !== undefined) clean.scriptStyle = clampStr(updates.scriptStyle, 120);
    if (updates.status !== undefined) clean.status = updates.status;
    if (updates.script !== undefined) clean.script = updates.script;
    if (updates.speakingGuide !== undefined) clean.speakingGuide = updates.speakingGuide.slice(0, 120);
    if (updates.scenes !== undefined) clean.scenes = updates.scenes.slice(0, 50);
    if (updates.captions !== undefined) clean.captions = updates.captions;
    if (updates.audio !== undefined) clean.audio = updates.audio;
    if (updates.editorConfig !== undefined) clean.editorConfig = updates.editorConfig;
    if (updates.exports !== undefined) clean.exports = updates.exports.slice(0, 30);

    await updateDoc(doc(db, 'projects', projectId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProjectInFirestore(projectId: string): Promise<void> {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function logCreatorActivity(
  userId: string,
  action: string,
  summary: string,
  projectId?: string,
): Promise<void> {
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/activities/${activityId}`;
  try {
    const payload: Record<string, unknown> = {
      userId,
      action: clampStr(action, 80, 'update'),
      summary: clampStr(summary, 280, 'Updated studio project'),
      createdAt: serverTimestamp(),
    };
    if (projectId && /^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) {
      payload.projectId = projectId;
    }
    await setDoc(doc(db, 'users', userId, 'activities', activityId), payload);
  } catch (error) {
    // Log structured error without blocking the primary creator workflow
    console.warn('Activity log skipped:', path, error);
  }
}

export function subscribeUserActivities(
  userId: string,
  onData: (activities: ActivityLog[]) => void,
): Unsubscribe {
  const colPath = `users/${userId}/activities`;
  const q = query(
    collection(db, 'users', userId, 'activities'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(15),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: ActivityLog[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId || userId),
          projectId: data.projectId ? String(data.projectId) : undefined,
          action: String(data.action || 'Activity'),
          summary: String(data.summary || ''),
          createdAt: tsToIso(data.createdAt),
        };
      });
      onData(items);
    },
    (error) => {
      console.warn('Activity stream notice:', colPath, error.message);
    },
  );
}
