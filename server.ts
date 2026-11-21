import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Constants & System Instruction (Exact prompt requirement)
// ============================================================================
const VLOGSPARK_SYSTEM_INSTRUCTION = `You are VlogSpark AI, an expert content director and conversational scriptwriter.
Your job is to turn simple ideas into original, engaging and natural human-sounding content.
Understand the audience, platform, language and content objective before writing.
Create scripts that sound like a real person speaking naturally, with meaningful examples, clear explanations and smooth transitions.
Avoid generic AI language, robotic sentences, unnecessary repetition and fabricated personal experiences.
Adapt the writing style to the user's requirements rather than forcing one fixed style.
Always produce useful, structured and editable content.`;

const MODELS = {
  script: 'gemini-4-hydrogen',
  tts: 'gemini-3.8-flash-lite-tts',
  transcribe: 'gemini-3.5-transcribe',
  image: 'gemini-3.1-flash-lite-image',
  video: 'gemini-omni-1.2-flash',
} as const;

// ============================================================================
// Storage Directories (Strictly confined)
// ============================================================================
const MEDIA_ROOT = path.resolve(__dirname, 'media_storage');
const MEDIA_DIRS = {
  images: path.join(MEDIA_ROOT, 'images'),
  audio: path.join(MEDIA_ROOT, 'audio'),
  videos: path.join(MEDIA_ROOT, 'videos'),
  renders: path.join(MEDIA_ROOT, 'renders'),
} as const;

type MediaCategory = keyof typeof MEDIA_DIRS;

for (const dir of Object.values(MEDIA_DIRS)) {
  fs.mkdirSync(dir, { recursive: true });
}

// ============================================================================
// Gemini Client (Server-side only, never exposed to client)
// ============================================================================
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error('Gemini API key is not configured on the server.');
    (err as Error & { code?: string }).code = 'API_KEY_MISSING';
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Retry helper with exponential backoff for transient 5xx/network hiccups
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      const isRetryable =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET');
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastError;
}

function classifyGeminiError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;

  if (code === 'API_KEY_MISSING') {
    return {
      status: 503,
      code: 'API_KEY_MISSING',
      message: 'Gemini API key is not configured. Check Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429') || raw.includes('quota')) {
    return {
      status: 429,
      code: 'BILLING_OR_QUOTA_REQUIRED',
      message:
        'This Gemini capability requires higher quota or a billing-enabled API key in Settings > Secrets.',
    };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      code: 'BILLING_OR_PERMISSION_REQUIRED',
      message:
        'API access denied for this model. Verify your API key or enable billing in Settings > Secrets.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_UNAVAILABLE',
      message: 'The requested AI model is currently unavailable for this account.',
    };
  }
  return {
    status: 500,
    code: 'AI_GENERATION_FAILED',
    message: 'AI generation could not be completed. Please try again in a moment.',
  };
}

// ============================================================================
// FFmpeg Availability Check
// ============================================================================
let ffmpegAvailable = false;
execFileAsync('ffmpeg', ['-version'])
  .then(() => {
    ffmpegAvailable = true;
  })
  .catch(() => {
    ffmpegAvailable = false;
  });

// ============================================================================
// Async Video / Render Job Registry
// ============================================================================
interface VideoJob {
  jobId: string;
  type: 'ffmpeg_render' | 'ai_video_clip';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  outputUrl?: string;
  fileName?: string;
  format?: 'mp4' | 'webm';
  resolution?: '720p' | '1080p';
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number;
  fileSizeBytes?: number;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

const videoJobs = new Map<string, VideoJob>();

// Lightweight per-user project cache for REST API endpoints (/api/projects)
// Primary persistent storage is Cloud Firestore via the authenticated client SDK.
interface StoredProjectRecord {
  id: string;
  ownerId: string;
  data: Record<string, unknown>;
  updatedAt: string;
}
const serverProjectMirror = new Map<string, StoredProjectRecord>();

// ============================================================================
// Express App Setup & Security Middleware
// ============================================================================
const app = express();
app.set('trust proxy', 1);

const allowedOrigins = new Set<string>([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
  allowedOrigins.add(process.env.APP_URL.replace(/\/$/, ''));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.has(origin) ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.googleusercontent.com')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '15mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI generation rate limit reached. Please pause briefly before retrying.' },
});

app.use('/api', apiLimiter);

// Extract verified-shape Firebase Bearer JWT payload for user-scoped REST routes
function extractBearerUid(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const uid = typeof payload.user_id === 'string' ? payload.user_id : payload.sub;
    const exp = typeof payload.exp === 'number' ? payload.exp : 0;
    if (typeof uid === 'string' && /^[a-zA-Z0-9_-]{6,128}$/.test(uid) && exp * 1000 > Date.now()) {
      return uid;
    }
    return null;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const uid = extractBearerUid(req);
  if (!uid) {
    res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
    return;
  }
  (req as Request & { uid?: string }).uid = uid;
  next();
}

// ============================================================================
// Secure Media File Uploads (Multer)
// ============================================================================
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
]);

const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function safeExtForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'audio/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/wav': '.wav',
    'audio/wave': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/mp4': '.m4a',
    'audio/m4a': '.m4a',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
  };
  return map[mime] || '.bin';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
    files: 1,
  },
});

// Safe path resolver preventing traversal
function resolveMediaPath(category: string, filename: string): string | null {
  if (!['images', 'audio', 'videos', 'renders'].includes(category)) return null;
  if (!/^[a-zA-Z0-9._-]{4,120}$/.test(filename) || filename.includes('..')) return null;
  const baseDir = MEDIA_DIRS[category as MediaCategory];
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

// Resolve a local /api/media/:cat/:file URL back to a safe filesystem path
function resolveLocalMediaUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^\/api\/media\/(images|audio|videos|renders)\/([a-zA-Z0-9._-]{4,120})$/);
  if (!match) return null;
  const fullPath = resolveMediaPath(match[1], match[2]);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  return fullPath;
}

// Save a base64 data URL (image/png or image/jpeg) safely into MEDIA_DIRS.images
function saveDataUrlImage(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1];
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length === 0 || buf.length > 10 * 1024 * 1024) return null;
  const fileName = `scene_${crypto.randomUUID()}${safeExtForMime(mime)}`;
  const target = path.join(MEDIA_DIRS.images, fileName);
  fs.writeFileSync(target, buf);
  return target;
}

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================
const generateScriptSchema = z.object({
  topic: z.string().trim().min(2, 'Please enter a topic or video idea.').max(600),
  platform: z.string().trim().min(1).max(60).default('YouTube'),
  language: z.string().trim().min(1).max(60).default('English'),
  category: z.string().trim().min(1).max(60).default('Education'),
  tone: z.string().trim().min(1).max(80).default('Casual and conversational'),
  duration: z.string().trim().min(1).max(40).default('60 seconds'),
  audience: z.string().trim().max(200).optional().default('General social media viewers'),
  objective: z.string().trim().max(200).optional().default('Educate and engage viewers'),
  scriptStyle: z.string().trim().max(120).optional().default('Direct-to-camera vlog'),
  action: z
    .enum([
      'initial',
      'regenerate',
      'more_emotional',
      'more_interesting',
      'simplify',
      'more_professional',
      'shorten',
      'expand',
      'translate',
    ])
    .optional()
    .default('initial'),
  existingScript: z.string().max(12000).optional(),
  targetLanguage: z.string().trim().max(60).optional(),
});

const generateScenesSchema = z.object({
  topic: z.string().trim().min(1).max(600),
  scriptText: z.string().trim().min(10).max(12000),
  platform: z.string().trim().min(1).max(60).default('YouTube'),
  duration: z.string().trim().min(1).max(40).default('60 seconds'),
  tone: z.string().trim().max(80).optional().default('Casual and conversational'),
  language: z.string().trim().max(60).optional().default('English'),
});

const generateCaptionsSchema = z.object({
  topic: z.string().trim().min(1).max(600),
  scriptText: z.string().trim().min(10).max(12000),
  platform: z.string().trim().min(1).max(60).default('YouTube'),
  language: z.string().trim().max(60).optional().default('English'),
  tone: z.string().trim().max(80).optional().default('Casual and conversational'),
  category: z.string().trim().max(60).optional().default('Education'),
});

const generateImageSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  style: z.string().trim().max(60).default('Cinematic'),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('16:9'),
});

const ttsSchema = z.object({
  text: z.string().trim().min(2).max(3000),
  voiceName: z.enum(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']).default('Kore'),
  style: z.string().trim().max(120).optional().default('Natural, warm conversational creator'),
});

const aiVideoCreateSchema = z.object({
  prompt: z.string().trim().min(5).max(1000),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
  durationSeconds: z.number().int().min(3).max(10).default(5),
});

const renderSceneInputSchema = z.object({
  id: z.string().max(80),
  sceneNumber: z.number().int().min(1).max(50),
  startTime: z.number().min(0).max(3600),
  endTime: z.number().min(0.5).max(3600),
  voiceover: z.string().max(1000).default(''),
  textOverlay: z.string().max(240).default(''),
  visualDescription: z.string().max(500).default(''),
  transition: z.enum(['cut', 'fade', 'slide', 'zoom']).default('fade'),
  imageUrl: z.string().max(4_000_000).optional(),
});

const renderVideoSchema = z.object({
  projectTitle: z.string().trim().min(1).max(160).default('VlogSpark Video'),
  scenes: z.array(renderSceneInputSchema).min(1).max(30),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('16:9'),
  resolution: z.enum(['720p', '1080p']).default('720p'),
  includeIntro: z.boolean().default(true),
  introTitle: z.string().max(120).default(''),
  introSubtitle: z.string().max(160).default(''),
  includeOutro: z.boolean().default(true),
  outroText: z.string().max(160).default('Created with VlogSpark AI'),
  includeCaptions: z.boolean().default(true),
  includeAudio: z.boolean().default(true),
  captionPosition: z.enum(['bottom', 'center', 'top']).default('bottom'),
  narrationUrl: z.string().max(500).optional(),
  narrationVolume: z.number().min(0).max(2).default(1),
  trimStart: z.number().min(0).max(3600).default(0),
  trimEnd: z.number().min(0).max(3600).default(0),
  bgMusicUrl: z.string().max(500).optional(),
  bgMusicVolume: z.number().min(0).max(1).default(0.25),
});

// ============================================================================
// Routes: Health
// ============================================================================
app.get('/api/health', (_req: Request, res: Response) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  res.json({
    ok: true,
    ffmpegAvailable,
    geminiConfigured: hasKey,
    models: MODELS,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Routes: Media Upload & Confined Range-Enabled Serving
// ============================================================================
app.post('/api/media/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided.' });
      return;
    }

    const mime = req.file.mimetype.toLowerCase();
    const isImage = ALLOWED_IMAGE_MIMES.has(mime);
    const isAudio = ALLOWED_AUDIO_MIMES.has(mime) || mime.startsWith('audio/');

    if (!isImage && !isAudio) {
      res.status(400).json({
        error: 'Unsupported file type. Upload PNG/JPG/WebP images or MP3/WAV/WebM/M4A audio.',
      });
      return;
    }

    if (isImage && req.file.size > 10 * 1024 * 1024) {
      res.status(413).json({ error: 'Image file exceeds the 10 MB limit.' });
      return;
    }

    const category: MediaCategory = isImage ? 'images' : 'audio';
    const ext = safeExtForMime(mime);
    const fileName = `${category}_${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(MEDIA_DIRS[category], fileName);

    fs.writeFileSync(targetPath, req.file.buffer);

    res.json({
      url: `/api/media/${category}/${fileName}`,
      fileName,
      originalName: req.file.originalname.slice(0, 120),
      mimeType: mime,
      sizeBytes: req.file.size,
      category,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to store uploaded file.' });
  }
});

app.get('/api/media/:category/:filename', (req: Request, res: Response) => {
  const category = String(req.params.category || '');
  const filename = String(req.params.filename || '');
  const resolved = resolveMediaPath(category, filename);

  if (!resolved || !fs.existsSync(resolved)) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }

  const stat = fs.statSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': category === 'audio' ? 'audio/webm' : 'video/webm',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (isNaN(start) || isNaN(end) || start >= stat.size || end >= stat.size) {
      res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
      return;
    }
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    });
    fs.createReadStream(resolved, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
    });
    fs.createReadStream(resolved).pipe(res);
  }
});

// ============================================================================
// Routes: AI Script & Speaking Guide Generation
// ============================================================================
app.post('/api/generate-script', aiLimiter, async (req: Request, res: Response) => {
  const parsed = generateScriptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid script request.' });
    return;
  }

  const input = parsed.data;
  const effectiveLang =
    input.action === 'translate' && input.targetLanguage ? input.targetLanguage : input.language;

  const actionDirections: Record<string, string> = {
    initial: 'Create an original, fresh creator script from scratch.',
    regenerate: 'Write a completely fresh alternative angle and hook for the same topic.',
    more_emotional:
      'Rewrite the script to deepen human warmth, empathy, and emotional resonance while staying authentic.',
    more_interesting:
      'Rewrite with sharper curiosity loops, vivid concrete comparisons, and tighter pacing.',
    simplify:
      'Rewrite using clear, everyday spoken words so beginners can follow effortlessly.',
    more_professional:
      'Elevate clarity, credibility, and executive polish without sounding stiff or robotic.',
    shorten:
      'Tighten the script by ~35%—keep the punchiest hook, sharpest points, and cleanest CTA.',
    expand:
      'Expand the script by ~40% with deeper practical insights and a stronger concrete example.',
    translate: `Naturally adapt and rewrite the script in ${effectiveLang} so it sounds like a native creator speaking directly to camera—not a literal word-for-word translation.`,
  };

  const prompt = `Create a complete creator script and sentence-by-sentence speaking guide.

CREATOR BRIEF:
- Topic: ${input.topic}
- Platform: ${input.platform}
- Language: ${effectiveLang}
- Content Category: ${input.category}
- Tone: ${input.tone}
- Target Duration: ${input.duration}
- Target Audience: ${input.audience}
- Content Objective: ${input.objective}
- Script Style: ${input.scriptStyle}
- Direction: ${actionDirections[input.action]}
${input.existingScript ? `\nEXISTING SCRIPT TO TRANSFORM:\n${input.existingScript}\n` : ''}

CRITICAL QUALITY RULES:
1. Write like a real creator speaking naturally to a camera.
2. Never use robotic clichés ("In today's fast-paced digital world", "Let's dive in", "Without further ado", "Unlock the power of").
3. Match natural spoken cadence in ${effectiveLang} (including authentic conversational phrasing if Indian English, Telugu, Tamil, Hindi, etc.).
4. Do NOT fabricate personal anecdotes or unverified statistics. Use relatable scenarios framed honestly ("Imagine...", "Think about the last time...").
5. Keep total spoken word count accurately matched to ${input.duration} (~130-150 words per minute).
6. For speakingGuide, break the detailedScript into 6 to 14 consecutive natural spoken sentences/beats with concrete, human director coaching for each line.`;

  try {
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.script,
        contents: prompt,
        config: {
          systemInstruction: VLOGSPARK_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedTitle: { type: Type.STRING },
              script: {
                type: Type.OBJECT,
                properties: {
                  hook: { type: Type.STRING },
                  introduction: { type: Type.STRING },
                  mainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  relatableStory: { type: Type.STRING },
                  detailedScript: { type: Type.STRING },
                  emotionalConnection: { type: Type.STRING },
                  takeaway: { type: Type.STRING },
                  closing: { type: Type.STRING },
                  callToAction: { type: Type.STRING },
                },
                required: [
                  'hook',
                  'introduction',
                  'mainPoints',
                  'relatableStory',
                  'detailedScript',
                  'emotionalConnection',
                  'takeaway',
                  'closing',
                  'callToAction',
                ],
              },
              speakingGuide: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sentence: { type: Type.STRING },
                    howToSay: { type: Type.STRING },
                    pauseAt: { type: Type.STRING },
                    emphasizeWords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    facialExpression: { type: Type.STRING },
                    speakingSpeed: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                  },
                  required: [
                    'sentence',
                    'howToSay',
                    'pauseAt',
                    'emphasizeWords',
                    'facialExpression',
                    'speakingSpeed',
                    'emotion',
                  ],
                },
              },
            },
            required: ['suggestedTitle', 'script', 'speakingGuide'],
          },
        },
      }),
    );

    const rawText = (response.text ?? '').trim();
    const data = JSON.parse(rawText);
    const validSpeeds = new Set(['Slow', 'Measured', 'Natural', 'Upbeat', 'Energetic']);

    const speakingGuide = Array.isArray(data.speakingGuide)
      ? data.speakingGuide.slice(0, 80).map((item: Record<string, unknown>, idx: number) => ({
          id: `sg_${idx + 1}_${crypto.randomBytes(3).toString('hex')}`,
          sentence: String(item.sentence || ''),
          howToSay: String(item.howToSay || 'Speak conversationally to camera'),
          pauseAt: String(item.pauseAt || 'Brief breath at end'),
          emphasizeWords: Array.isArray(item.emphasizeWords)
            ? item.emphasizeWords.map(String).slice(0, 6)
            : [],
          facialExpression: String(item.facialExpression || 'Warm, attentive eye contact'),
          speakingSpeed: validSpeeds.has(String(item.speakingSpeed))
            ? String(item.speakingSpeed)
            : 'Natural',
          emotion: String(item.emotion || 'Curious and engaging'),
        }))
      : [];

    res.json({
      suggestedTitle: String(data.suggestedTitle || input.topic).slice(0, 150),
      language: effectiveLang,
      script: data.script,
      speakingGuide,
    });
  } catch (error) {
    console.error('Script generation error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// ============================================================================
// Routes: Scene-by-Scene Planner
// ============================================================================
app.post('/api/generate-scenes', aiLimiter, async (req: Request, res: Response) => {
  const parsed = generateScenesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid scene request.' });
    return;
  }

  const input = parsed.data;
  const prompt = `Break the following creator script into a practical, shot-by-shot scene production plan.

Topic: ${input.topic}
Platform: ${input.platform}
Target Duration: ${input.duration}
Tone: ${input.tone}
Language: ${input.language}

SCRIPT:
${input.scriptText}

REQUIREMENTS:
- Divide the script into 4 to 8 cohesive scenes with continuous non-overlapping startTime and endTime in seconds (starting at 0).
- Every scene must include actionable camera angle, camera movement, visual description, background suggestion, B-roll suggestion, crisp short text overlay (<= 8 words), transition (one of: cut, fade, slide, zoom), and a rich visualPrompt ready for studio imagery.`;

  try {
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.script,
        contents: prompt,
        config: {
          systemInstruction: VLOGSPARK_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    startTime: { type: Type.NUMBER },
                    endTime: { type: Type.NUMBER },
                    voiceover: { type: Type.STRING },
                    cameraAngle: { type: Type.STRING },
                    cameraMovement: { type: Type.STRING },
                    visualDescription: { type: Type.STRING },
                    backgroundSuggestion: { type: Type.STRING },
                    bRollSuggestion: { type: Type.STRING },
                    textOverlay: { type: Type.STRING },
                    transition: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                  },
                  required: [
                    'sceneNumber',
                    'startTime',
                    'endTime',
                    'voiceover',
                    'cameraAngle',
                    'cameraMovement',
                    'visualDescription',
                    'backgroundSuggestion',
                    'bRollSuggestion',
                    'textOverlay',
                    'transition',
                    'visualPrompt',
                  ],
                },
              },
            },
            required: ['scenes'],
          },
        },
      }),
    );

    const parsedJson = JSON.parse((response.text ?? '{}').trim());
    const validTransitions = new Set(['cut', 'fade', 'slide', 'zoom']);

    let cursor = 0;
    const scenes = (Array.isArray(parsedJson.scenes) ? parsedJson.scenes : [])
      .slice(0, 20)
      .map((s: Record<string, unknown>, idx: number) => {
        const rawStart = Number(s.startTime);
        const rawEnd = Number(s.endTime);
        const startTime = Number.isFinite(rawStart) && rawStart >= cursor ? Math.round(rawStart) : cursor;
        const duration =
          Number.isFinite(rawEnd) && rawEnd > startTime ? Math.max(3, Math.round(rawEnd - startTime)) : 6;
        const endTime = startTime + duration;
        cursor = endTime;

        return {
          id: `scene_${idx + 1}_${crypto.randomBytes(3).toString('hex')}`,
          sceneNumber: idx + 1,
          startTime,
          endTime,
          voiceover: String(s.voiceover || ''),
          cameraAngle: String(s.cameraAngle || 'Medium close-up'),
          cameraMovement: String(s.cameraMovement || 'Subtle handheld push-in'),
          visualDescription: String(s.visualDescription || ''),
          backgroundSuggestion: String(s.backgroundSuggestion || 'Clean studio desk'),
          bRollSuggestion: String(s.bRollSuggestion || 'Cutaway detail shot'),
          textOverlay: String(s.textOverlay || '').slice(0, 120),
          transition: validTransitions.has(String(s.transition).toLowerCase())
            ? String(s.transition).toLowerCase()
            : 'fade',
          visualPrompt: String(s.visualPrompt || s.visualDescription || ''),
        };
      });

    res.json({ scenes });
  } catch (error) {
    console.error('Scene generation error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// ============================================================================
// Routes: Captions & Hashtags Studio
// ============================================================================
app.post('/api/generate-captions', aiLimiter, async (req: Request, res: Response) => {
  const parsed = generateCaptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid captions request.' });
    return;
  }

  const input = parsed.data;
  const prompt = `Generate publish-ready social media captions, hashtags, SEO keywords, title, and description for this video.

Topic: ${input.topic}
Platform: ${input.platform}
Language: ${input.language}
Tone: ${input.tone}
Category: ${input.category}

SCRIPT:
${input.scriptText}

Make every caption sound human, authentic, and native to ${input.platform} in ${input.language}. Return 8-15 relevant platform hashtags (each starting with #) and 8-12 search keywords.`;

  try {
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.script,
        contents: prompt,
        config: {
          systemInstruction: VLOGSPARK_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shortCaption: { type: Type.STRING },
              storytellingCaption: { type: Type.STRING },
              professionalCaption: { type: Type.STRING },
              engagingCaption: { type: Type.STRING },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              postTitle: { type: Type.STRING },
              postDescription: { type: Type.STRING },
            },
            required: [
              'shortCaption',
              'storytellingCaption',
              'professionalCaption',
              'engagingCaption',
              'hashtags',
              'keywords',
              'postTitle',
              'postDescription',
            ],
          },
        },
      }),
    );

    const data = JSON.parse((response.text ?? '{}').trim());
    res.json({
      captions: {
        shortCaption: String(data.shortCaption || ''),
        storytellingCaption: String(data.storytellingCaption || ''),
        professionalCaption: String(data.professionalCaption || ''),
        engagingCaption: String(data.engagingCaption || ''),
        hashtags: Array.isArray(data.hashtags)
          ? data.hashtags.map((h: unknown) => {
              const clean = String(h).trim();
              return clean.startsWith('#') ? clean : `#${clean.replace(/\s+/g, '')}`;
            })
          : [],
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
        postTitle: String(data.postTitle || input.topic),
        postDescription: String(data.postDescription || ''),
      },
    });
  } catch (error) {
    console.error('Captions generation error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// ============================================================================
// Routes: AI Image Generation (Honest Gemini Image API — never fakes AI output)
// ============================================================================
app.post('/api/generate-image', aiLimiter, async (req: Request, res: Response) => {
  const parsed = generateImageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid image request.' });
    return;
  }

  const { prompt, style, aspectRatio } = parsed.data;
  try {
    const ai = getGeminiClient();
    const styledPrompt = `${style} visual style, high production value, clean composition, no text overlay or watermarks: ${prompt}`;

    const response = await ai.models.generateContent({
      model: MODELS.image,
      contents: {
        parts: [{ text: styledPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        const ext = safeExtForMime(mime);
        const fileName = `ai_img_${crypto.randomUUID()}${ext}`;
        const targetPath = path.join(MEDIA_DIRS.images, fileName);
        fs.writeFileSync(targetPath, Buffer.from(part.inlineData.data, 'base64'));

        res.json({
          url: `/api/media/images/${fileName}`,
          source: 'gemini_ai',
          model: MODELS.image,
          aspectRatio,
          style,
        });
        return;
      }
    }

    res.status(502).json({
      error: 'The image model returned no image data for this prompt. Try adjusting the scene description.',
      code: 'NO_IMAGE_RETURNED',
    });
  } catch (error) {
    console.error('Image generation error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({
      error:
        info.code === 'BILLING_OR_QUOTA_REQUIRED' || info.code === 'BILLING_OR_PERMISSION_REQUIRED'
          ? 'Gemini AI Image Generation requires a billing-enabled API key in Settings > Secrets. Meanwhile, you can upload your own scene photo or create a Studio Graphic Card below.'
          : info.message,
      code: info.code,
    });
  }
});

// ============================================================================
// Routes: Optional Clearly-Labelled Synthetic Narration (Gemini 3.8 TTS)
// ============================================================================
app.post('/api/tts', aiLimiter, async (req: Request, res: Response) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid speech request.' });
    return;
  }

  const { text, voiceName, style } = parsed.data;
  try {
    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.tts,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style,
                },
              } as { text: string; speechMetadata?: { style: string } },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.status(502).json({ error: 'Synthetic voice service returned no audio data.' });
      return;
    }

    // Gemini 3.8 unary TTS returns a complete RIFF WAV file (24kHz mono 16-bit)
    const wavBuffer = Buffer.from(base64Audio, 'base64');
    const fileName = `tts_${crypto.randomUUID()}.wav`;
    const targetPath = path.join(MEDIA_DIRS.audio, fileName);
    fs.writeFileSync(targetPath, wavBuffer);

    res.json({
      url: `/api/media/audio/${fileName}`,
      fileName,
      voiceName,
      source: 'synthetic_tts',
      model: MODELS.tts,
      sizeBytes: wavBuffer.length,
    });
  } catch (error) {
    console.error('TTS error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// ============================================================================
// Routes: Audio Transcription (Gemini 3.5 Transcribe)
// ============================================================================
app.post('/api/transcribe', aiLimiter, async (req: Request, res: Response) => {
  const audioUrl = typeof req.body?.audioUrl === 'string' ? req.body.audioUrl : '';
  const localPath = resolveLocalMediaUrl(audioUrl);
  if (!localPath) {
    res.status(400).json({ error: 'Valid uploaded or recorded audio URL is required.' });
    return;
  }

  try {
    const buf = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mime =
      ext === '.wav'
        ? 'audio/wav'
        : ext === '.mp3'
          ? 'audio/mp3'
          : ext === '.m4a'
            ? 'audio/mp4'
            : 'audio/webm';

    const ai = getGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: MODELS.transcribe,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mime,
                data: buf.toString('base64'),
              },
            },
            { text: 'Transcribe this narration cleanly with natural punctuation.' },
          ],
        },
      }),
    );

    res.json({ transcript: (response.text ?? '').trim() });
  } catch (error) {
    console.error('Transcription error:', error);
    const info = classifyGeminiError(error);
    res.status(info.status).json({ error: info.message, code: info.code });
  }
});

// ============================================================================
// Routes: Async AI Video Clip Generation (Gemini Omni Flash via Interactions API)
// ============================================================================
app.post('/api/video/create', aiLimiter, async (req: Request, res: Response) => {
  const parsed = aiVideoCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid AI video request.' });
    return;
  }

  const { prompt, aspectRatio, durationSeconds } = parsed.data;
  const jobId = `aivid_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const job: VideoJob = {
    jobId,
    type: 'ai_video_clip',
    status: 'pending',
    progress: 10,
    stage: 'Submitting AI video clip request to Gemini Omni Flash...',
    aspectRatio,
    resolution: '720p',
    durationSeconds,
    createdAt: now,
    updatedAt: now,
  };
  videoJobs.set(jobId, job);

  // Kick off async background generation
  void (async () => {
    try {
      const ai = getGeminiClient();
      job.status = 'processing';
      job.progress = 35;
      job.stage = 'Generating AI video clip...';
      job.updatedAt = new Date().toISOString();

      const interaction = await ai.interactions.create(
        {
          model: MODELS.video,
          input: prompt,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio,
            duration: `${durationSeconds}s`,
            resolution: '720p',
          },
        } as Parameters<typeof ai.interactions.create>[0],
        { timeout: 300000 },
      );

      const videoPart = (interaction as unknown as { output_video?: { data?: string } }).output_video;
      if (videoPart?.data) {
        const videoBuf = Buffer.from(videoPart.data, 'base64');
        const fileName = `omni_${crypto.randomUUID()}.mp4`;
        const target = path.join(MEDIA_DIRS.videos, fileName);
        fs.writeFileSync(target, videoBuf);

        job.status = 'completed';
        job.progress = 100;
        job.stage = 'AI video clip ready';
        job.outputUrl = `/api/media/videos/${fileName}`;
        job.fileName = fileName;
        job.format = 'mp4';
        job.fileSizeBytes = videoBuf.length;
        job.updatedAt = new Date().toISOString();
      } else {
        job.status = 'failed';
        job.errorCode = 'NO_VIDEO_RETURNED';
        job.error = 'The AI video model did not return a video clip.';
        job.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      const info = classifyGeminiError(error);
      job.status = 'failed';
      job.errorCode = info.code;
      job.error =
        info.code === 'BILLING_OR_QUOTA_REQUIRED' || info.code === 'BILLING_OR_PERMISSION_REQUIRED'
          ? 'AI Video Clip Generation (Gemini Omni / Veo) requires a billing-enabled API key in Settings > Secrets. Use the FFmpeg Studio Renderer to produce a real playable MP4 from your scene visuals, narration, and captions.'
          : info.message;
      job.updatedAt = new Date().toISOString();
    }
  })();

  res.status(202).json(job);
});

// ============================================================================
// Routes: REAL Server-Side FFmpeg Video Composition Pipeline
// ============================================================================
function getDimensions(
  aspectRatio: '9:16' | '16:9' | '1:1',
  resolution: '720p' | '1080p',
): { width: number; height: number } {
  const shortSide = resolution === '1080p' ? 1080 : 720;
  if (aspectRatio === '9:16') {
    return { width: shortSide, height: resolution === '1080p' ? 1920 : 1280 };
  }
  if (aspectRatio === '1:1') {
    return { width: shortSide, height: shortSide };
  }
  return { width: resolution === '1080p' ? 1920 : 1280, height: shortSide };
}

function findDrawtextFont(): string | null {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  ];
  for (const fontPath of candidates) {
    if (fs.existsSync(fontPath)) return fontPath;
  }
  return null;
}

function wrapTextForVideo(text: string, maxCharsPerLine: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxCharsPerLine && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
    if (lines.length >= 3) break;
  }
  if (current && lines.length < 3) lines.push(current.trim());
  return lines.join('\n');
}

app.post('/api/video/render', async (req: Request, res: Response) => {
  const parsed = renderVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid render configuration.' });
    return;
  }

  if (!ffmpegAvailable) {
    res.status(503).json({
      error: 'FFmpeg is unavailable on this server. Use Browser WebM Rendering instead.',
      code: 'FFMPEG_UNAVAILABLE',
    });
    return;
  }

  const cfg = parsed.data;
  const jobId = `render_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const job: VideoJob = {
    jobId,
    type: 'ffmpeg_render',
    status: 'pending',
    progress: 5,
    stage: 'Preparing scenes and assets...',
    aspectRatio: cfg.aspectRatio,
    resolution: cfg.resolution,
    format: 'mp4',
    createdAt: now,
    updatedAt: now,
  };
  videoJobs.set(jobId, job);

  // Run real FFmpeg rendering asynchronously
  void (async () => {
    const workDir = path.join(MEDIA_DIRS.renders, `work_${jobId}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      job.status = 'processing';
      job.progress = 15;
      job.stage = 'Rendering scene segments with FFmpeg...';
      job.updatedAt = new Date().toISOString();

      const { width, height } = getDimensions(cfg.aspectRatio, cfg.resolution);
      const fontPath = findDrawtextFont();
      const maxChars = cfg.aspectRatio === '9:16' ? 26 : cfg.aspectRatio === '1:1' ? 32 : 44;
      const captionFontSize = Math.round(Math.min(width, height) * 0.044);
      const titleFontSize = Math.round(Math.min(width, height) * 0.062);

      const segmentPaths: string[] = [];
      let totalDuration = 0;

      // Helper to write safe text file for FFmpeg drawtext (avoids shell/filter escaping issues!)
      const writeTextFile = (name: string, content: string): string => {
        const p = path.join(workDir, `${name}.txt`);
        fs.writeFileSync(p, content, 'utf8');
        return p;
      };

      const paletteColors = ['#0F172A', '#1E1B4B', '#172554', '#1E293B', '#131C38'];

      // 1. Optional Intro Card (2.5s)
      if (cfg.includeIntro) {
        const introSeg = path.join(workDir, 'seg_000_intro.mp4');
        const introTitleFile = writeTextFile(
          'intro_title',
          wrapTextForVideo(cfg.introTitle || cfg.projectTitle, maxChars - 6),
        );
        const introSubFile = writeTextFile(
          'intro_sub',
          wrapTextForVideo(cfg.introSubtitle || 'VlogSpark AI Studio', maxChars),
        );

        const filters: string[] = [];
        if (fontPath) {
          filters.push(
            `drawtext=fontfile=${fontPath}:textfile=${introTitleFile}:fontcolor=white:fontsize=${titleFontSize}:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(titleFontSize * 0.6)}:line_spacing=12`,
          );
          filters.push(
            `drawtext=fontfile=${fontPath}:textfile=${introSubFile}:fontcolor=#93C5FD:fontsize=${Math.round(captionFontSize * 0.85)}:x=(w-text_w)/2:y=(h/2)+${Math.round(titleFontSize * 0.8)}`,
          );
        }
        filters.push('fade=t=in:st=0:d=0.45,fade=t=out:st=2.05:d=0.45');

        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=#0B112B:s=${width}x${height}:d=2.5:r=24`,
          '-vf',
          filters.join(','),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-an',
          introSeg,
        ]);
        segmentPaths.push(introSeg);
        totalDuration += 2.5;
      }

      // 2. Render each scene segment
      for (let i = 0; i < cfg.scenes.length; i++) {
        const scene = cfg.scenes[i];
        const segDur = Math.max(2, Math.min(30, Number((scene.endTime - scene.startTime).toFixed(2)) || 5));
        totalDuration += segDur;

        const segFile = path.join(workDir, `seg_${String(i + 1).padStart(3, '0')}.mp4`);
        let imageFilePath: string | null = null;

        if (scene.imageUrl) {
          if (scene.imageUrl.startsWith('data:image/')) {
            imageFilePath = saveDataUrlImage(scene.imageUrl);
          } else {
            imageFilePath = resolveLocalMediaUrl(scene.imageUrl);
          }
        }

        const filters: string[] = [];
        if (imageFilePath) {
          filters.push(
            `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
          );
        }

        // Subtle dark lower gradient band for caption contrast
        if (cfg.includeCaptions && (scene.textOverlay || scene.voiceover)) {
          const boxY =
            cfg.captionPosition === 'top'
              ? Math.round(height * 0.08)
              : cfg.captionPosition === 'center'
                ? Math.round(height * 0.42)
                : Math.round(height * 0.78);

          const overlayText = scene.textOverlay?.trim()
            ? scene.textOverlay.trim()
            : scene.voiceover.slice(0, 120);
          const wrapped = wrapTextForVideo(overlayText, maxChars);

          if (fontPath && wrapped) {
            const txtFile = writeTextFile(`scene_txt_${i}`, wrapped);
            filters.push(
              `drawtext=fontfile=${fontPath}:textfile=${txtFile}:fontcolor=white:fontsize=${captionFontSize}:box=1:boxcolor=0x070B19@0.72:boxborderw=18:x=(w-text_w)/2:y=${boxY}:line_spacing=10`,
            );
          }
        } else if (!imageFilePath && fontPath) {
          // If no image was supplied for this scene, show a clean scene title card
          const fallbackLabel = wrapTextForVideo(
            scene.textOverlay || scene.visualDescription || `Scene ${scene.sceneNumber}`,
            maxChars,
          );
          const txtFile = writeTextFile(`scene_card_${i}`, fallbackLabel);
          filters.push(
            `drawtext=fontfile=${fontPath}:textfile=${txtFile}:fontcolor=white:fontsize=${Math.round(captionFontSize * 1.1)}:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=12`,
          );
        }

        if (scene.transition === 'fade' || scene.transition === 'zoom' || scene.transition === 'slide') {
          const fadeOutStart = Math.max(0.3, segDur - 0.35);
          filters.push(`fade=t=in:st=0:d=0.3,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.35`);
        }

        const ffArgs: string[] = ['-y'];
        if (imageFilePath) {
          ffArgs.push('-loop', '1', '-t', String(segDur), '-i', imageFilePath);
        } else {
          const color = paletteColors[i % paletteColors.length];
          ffArgs.push(
            '-f',
            'lavfi',
            '-i',
            `color=c=${color}:s=${width}x${height}:d=${segDur}:r=24`,
          );
        }

        if (filters.length > 0) {
          ffArgs.push('-vf', filters.join(','));
        }
        ffArgs.push(
          '-r',
          '24',
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-t',
          String(segDur),
          '-an',
          segFile,
        );

        await execFileAsync('ffmpeg', ffArgs);
        segmentPaths.push(segFile);

        job.progress = Math.min(72, 15 + Math.round(((i + 1) / cfg.scenes.length) * 55));
        job.stage = `Rendered scene ${i + 1} of ${cfg.scenes.length}`;
        job.updatedAt = new Date().toISOString();
      }

      // 3. Optional Outro Card (2.5s)
      if (cfg.includeOutro) {
        const outroSeg = path.join(workDir, 'seg_999_outro.mp4');
        const outroFile = writeTextFile(
          'outro_txt',
          wrapTextForVideo(cfg.outroText || 'Thanks for watching!', maxChars - 4),
        );
        const filters: string[] = [];
        if (fontPath) {
          filters.push(
            `drawtext=fontfile=${fontPath}:textfile=${outroFile}:fontcolor=white:fontsize=${titleFontSize}:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=12`,
          );
        }
        filters.push('fade=t=in:st=0:d=0.4,fade=t=out:st=2.05:d=0.45');

        await execFileAsync('ffmpeg', [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `color=c=#0B112B:s=${width}x${height}:d=2.5:r=24`,
          '-vf',
          filters.join(','),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
          '-an',
          outroSeg,
        ]);
        segmentPaths.push(outroSeg);
        totalDuration += 2.5;
      }

      // 4. Concatenate video segments
      job.progress = 78;
      job.stage = 'Assembling video timeline...';
      job.updatedAt = new Date().toISOString();

      const concatListPath = path.join(workDir, 'concat.txt');
      const concatBody = segmentPaths
        .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
        .join('\n');
      fs.writeFileSync(concatListPath, concatBody, 'utf8');

      const silentVideoPath = path.join(workDir, 'video_silent.mp4');
      await execFileAsync('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-c',
        'copy',
        silentVideoPath,
      ]);

      // 5. Mix Audio (User narration + optional background music) or attach silent AAC track for compatibility
      job.progress = 88;
      job.stage = 'Mixing audio tracks & encoding final MP4...';
      job.updatedAt = new Date().toISOString();

      const safeTitleSlug = cfg.projectTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'vlogspark-video';

      const finalFileName = `${safeTitleSlug}_${cfg.resolution}_${crypto.randomBytes(4).toString('hex')}.mp4`;
      const finalOutputPath = path.join(MEDIA_DIRS.renders, finalFileName);

      const narrationPath = cfg.includeAudio ? resolveLocalMediaUrl(cfg.narrationUrl) : null;
      const musicPath = cfg.includeAudio ? resolveLocalMediaUrl(cfg.bgMusicUrl) : null;

      if (narrationPath && musicPath) {
        const trimFilter =
          cfg.trimEnd > cfg.trimStart
            ? `atrim=start=${cfg.trimStart}:end=${cfg.trimEnd},asetpts=PTS-STARTPTS,`
            : cfg.trimStart > 0
              ? `atrim=start=${cfg.trimStart},asetpts=PTS-STARTPTS,`
              : '';
        const filterComplex = `[1:a]${trimFilter}volume=${cfg.narrationVolume.toFixed(2)}[a1];[2:a]aloop=loop=-1:size=2e+09,volume=${cfg.bgMusicVolume.toFixed(2)}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]`;

        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          silentVideoPath,
          '-i',
          narrationPath,
          '-i',
          musicPath,
          '-filter_complex',
          filterComplex,
          '-map',
          '0:v:0',
          '-map',
          '[aout]',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          '-movflags',
          '+faststart',
          finalOutputPath,
        ]);
      } else if (narrationPath) {
        const trimFilter =
          cfg.trimEnd > cfg.trimStart
            ? `atrim=start=${cfg.trimStart}:end=${cfg.trimEnd},asetpts=PTS-STARTPTS,`
            : cfg.trimStart > 0
              ? `atrim=start=${cfg.trimStart},asetpts=PTS-STARTPTS,`
              : '';
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          silentVideoPath,
          '-i',
          narrationPath,
          '-af',
          `${trimFilter}volume=${cfg.narrationVolume.toFixed(2)}`,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          '-movflags',
          '+faststart',
          finalOutputPath,
        ]);
      } else if (musicPath) {
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          silentVideoPath,
          '-stream_loop',
          '-1',
          '-i',
          musicPath,
          '-af',
          `volume=${cfg.bgMusicVolume.toFixed(2)}`,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '160k',
          '-shortest',
          '-movflags',
          '+faststart',
          finalOutputPath,
        ]);
      } else {
        // Attach clean silent stereo AAC audio track so every social platform accepts the MP4
        await execFileAsync('ffmpeg', [
          '-y',
          '-i',
          silentVideoPath,
          '-f',
          'lavfi',
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-shortest',
          '-movflags',
          '+faststart',
          finalOutputPath,
        ]);
      }

      // 6. Validate output MP4 exists and is non-empty
      const finalStat = fs.statSync(finalOutputPath);
      if (finalStat.size < 1024) {
        throw new Error('Rendered MP4 output was empty.');
      }

      job.status = 'completed';
      job.progress = 100;
      job.stage = 'MP4 video verified and ready for download';
      job.outputUrl = `/api/media/renders/${finalFileName}`;
      job.fileName = finalFileName;
      job.format = 'mp4';
      job.durationSeconds = Math.round(totalDuration);
      job.fileSizeBytes = finalStat.size;
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      console.error('FFmpeg render failed:', error);
      job.status = 'failed';
      job.errorCode = 'RENDER_FAILED';
      job.error = 'Video rendering failed. Try Browser WebM export or check your media assets.';
      job.updatedAt = new Date().toISOString();
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  })();

  res.status(202).json(job);
});

app.get('/api/video/status/:jobId', (req: Request, res: Response) => {
  const jobId = String(req.params.jobId || '');
  const job = videoJobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: 'Render job not found.' });
    return;
  }
  res.json(job);
});

// ============================================================================
// Routes: Authenticated Project REST API (/api/projects)
// ============================================================================
app.get('/api/projects', requireAuth, (req: Request, res: Response) => {
  const uid = (req as Request & { uid: string }).uid;
  const items = Array.from(serverProjectMirror.values())
    .filter((p) => p.ownerId === uid)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => ({ id: p.id, ...p.data }));
  res.json({ projects: items });
});

app.post('/api/projects', requireAuth, (req: Request, res: Response) => {
  const uid = (req as Request & { uid: string }).uid;
  const body = req.body as Record<string, unknown>;
  const id =
    typeof body?.id === 'string' && /^[a-zA-Z0-9_-]{3,128}$/.test(body.id)
      ? body.id
      : `proj_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const record: StoredProjectRecord = {
    id,
    ownerId: uid,
    data: { ...body, ownerId: uid, updatedAt: now },
    updatedAt: now,
  };
  serverProjectMirror.set(id, record);
  res.status(201).json({ id, ...record.data });
});

app.put('/api/projects/:id', requireAuth, (req: Request, res: Response) => {
  const uid = (req as Request & { uid: string }).uid;
  const id = String(req.params.id || '');
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(id)) {
    res.status(400).json({ error: 'Invalid project ID.' });
    return;
  }
  const existing = serverProjectMirror.get(id);
  if (existing && existing.ownerId !== uid) {
    res.status(403).json({ error: 'You do not have permission to update this project.' });
    return;
  }
  const now = new Date().toISOString();
  const record: StoredProjectRecord = {
    id,
    ownerId: uid,
    data: { ...(existing?.data || {}), ...(req.body as Record<string, unknown>), ownerId: uid, updatedAt: now },
    updatedAt: now,
  };
  serverProjectMirror.set(id, record);
  res.json({ id, ...record.data });
});

app.delete('/api/projects/:id', requireAuth, (req: Request, res: Response) => {
  const uid = (req as Request & { uid: string }).uid;
  const id = String(req.params.id || '');
  const existing = serverProjectMirror.get(id);
  if (existing && existing.ownerId !== uid) {
    res.status(403).json({ error: 'You do not have permission to delete this project.' });
    return;
  }
  serverProjectMirror.delete(id);
  res.json({ deleted: true, id });
});

// ============================================================================
// Multer & Unhandled API Error Middleware (No stack leaks)
// ============================================================================
app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'File is too large. Maximum allowed size is 25 MB.' });
      return;
    }
    res.status(400).json({ error: 'File upload failed validation.' });
    return;
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

// ============================================================================
// Start Server with Vite Dev Middleware or Static Production Build
// ============================================================================
async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VlogSpark AI 2.0 server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VlogSpark AI server:', err);
  process.exit(1);
});
