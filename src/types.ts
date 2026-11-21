export type AppPage =
  | 'landing'
  | 'auth'
  | 'dashboard'
  | 'generator'
  | 'script'
  | 'speaking'
  | 'scenes'
  | 'visuals'
  | 'voice'
  | 'editor'
  | 'captions'
  | 'projects'
  | 'export'
  | 'settings'
  | 'help';

export type AspectRatio = '9:16' | '16:9' | '1:1';
export type VideoResolution = '720p' | '1080p';
export type ProjectStatus = 'draft' | 'in_progress' | 'exported';

export type VisualStyle =
  | 'Realistic'
  | 'Cinematic'
  | 'Documentary'
  | 'Animation'
  | 'Illustration'
  | 'Minimalist'
  | 'Educational';

export type TransitionType = 'cut' | 'fade' | 'slide' | 'zoom';

export interface ScriptSections {
  hook: string;
  introduction: string;
  mainPoints: string[];
  relatableStory: string;
  detailedScript: string;
  emotionalConnection: string;
  takeaway: string;
  closing: string;
  callToAction: string;
}

export interface SpeakingInstruction {
  id: string;
  sentence: string;
  howToSay: string;
  pauseAt: string;
  emphasizeWords: string[];
  facialExpression: string;
  speakingSpeed: 'Slow' | 'Measured' | 'Natural' | 'Upbeat' | 'Energetic';
  emotion: string;
}

export interface SceneItem {
  id: string;
  sceneNumber: number;
  startTime: number;
  endTime: number;
  voiceover: string;
  cameraAngle: string;
  cameraMovement: string;
  visualDescription: string;
  backgroundSuggestion: string;
  bRollSuggestion: string;
  textOverlay: string;
  transition: TransitionType;
  visualPrompt: string;
  imageUrl?: string;
  imageSource?: 'gemini_ai' | 'user_upload' | 'studio_card';
  imageStyle?: VisualStyle;
  videoClipUrl?: string;
  videoClipSource?: 'gemini_omni' | 'user_upload';
  audioUrl?: string;
}

export interface CaptionsPack {
  shortCaption: string;
  storytellingCaption: string;
  professionalCaption: string;
  engagingCaption: string;
  hashtags: string[];
  keywords: string[];
  postTitle: string;
  postDescription: string;
}

export interface AudioTrackConfig {
  narrationUrl?: string;
  narrationFileName?: string;
  narrationSource?: 'mic_recording' | 'audio_upload' | 'synthetic_tts';
  narrationDuration?: number;
  narrationVolume: number; // 0 - 1.5
  trimStart: number;
  trimEnd: number;
  bgMusicUrl?: string;
  bgMusicFileName?: string;
  bgMusicVolume: number; // 0 - 1
  transcript?: string;
}

export interface EditorConfig {
  aspectRatio: AspectRatio;
  resolution: VideoResolution;
  includeIntro: boolean;
  introTitle: string;
  introSubtitle: string;
  includeOutro: boolean;
  outroText: string;
  includeCaptions: boolean;
  includeAudio: boolean;
  captionPosition: 'bottom' | 'center' | 'top';
  defaultTransition: TransitionType;
}

export interface ExportRecord {
  id: string;
  fileName: string;
  format: 'mp4' | 'webm';
  resolution: VideoResolution;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  fileSizeBytes: number;
  url: string;
  renderEngine: 'ffmpeg_server' | 'browser_canvas_webm';
  includeCaptions: boolean;
  includeAudio: boolean;
  createdAt: string;
}

export interface VlogProject {
  id: string;
  ownerId: string;
  title: string;
  topic: string;
  platform: string;
  language: string;
  category: string;
  tone: string;
  duration: string;
  audience: string;
  objective: string;
  scriptStyle: string;
  status: ProjectStatus;
  script: ScriptSections;
  speakingGuide: SpeakingInstruction[];
  scenes: SceneItem[];
  captions: CaptionsPack;
  audio: AudioTrackConfig;
  editorConfig: EditorConfig;
  exports: ExportRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  defaultPlatform: string;
  defaultLanguage: string;
  defaultTone: string;
  defaultAspectRatio: AspectRatio;
  defaultResolution: VideoResolution;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  projectId?: string;
  action: string;
  summary: string;
  createdAt?: string;
}

export interface GeneratorFormInput {
  topic: string;
  platform: string;
  language: string;
  customLanguage?: string;
  category: string;
  tone: string;
  duration: string;
  customDuration?: string;
  audience: string;
  objective: string;
  scriptStyle: string;
}

export interface SystemHealth {
  ok: boolean;
  ffmpegAvailable: boolean;
  geminiConfigured: boolean;
  models: {
    script: string;
    tts: string;
    transcribe: string;
    image: string;
    video: string;
  };
  timestamp: string;
}

export const PLATFORMS = [
  'YouTube',
  'YouTube Shorts',
  'Instagram Reels',
  'Instagram Posts',
  'Facebook',
  'LinkedIn',
  'X',
  'TikTok',
  'Other',
] as const;

export const LANGUAGES = [
  'English',
  'Indian English',
  'Telugu',
  'Tamil',
  'Hindi',
  'Kannada',
  'Malayalam',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Spanish',
  'French',
  'Other',
] as const;

export const CATEGORIES = [
  'Education',
  'Technology',
  'Entertainment',
  'Travel',
  'Lifestyle',
  'Motivation',
  'Gaming',
  'Business',
  'Reviews',
  'Tutorials',
  'Storytelling',
  'News Explainers',
] as const;

export const TONES = [
  'Casual and conversational',
  'Professional',
  'Emotional',
  'Funny',
  'Educational',
  'Storytelling',
  'Motivational',
  'Documentary',
  'Adaptive AI style',
] as const;

export const DURATIONS = [
  '15 seconds',
  '30 seconds',
  '60 seconds',
  '90 seconds',
  '3 minutes',
  '5 minutes',
  'Custom',
] as const;

export const SCRIPT_STYLES = [
  'Direct-to-camera vlog',
  'Fast-paced hook & listicle',
  'Mini documentary narrative',
  'Step-by-step tutorial',
  'Conversational interview feel',
  'Cinematic voiceover essay',
] as const;

export const VISUAL_STYLES: VisualStyle[] = [
  'Realistic',
  'Cinematic',
  'Documentary',
  'Animation',
  'Illustration',
  'Minimalist',
  'Educational',
];
