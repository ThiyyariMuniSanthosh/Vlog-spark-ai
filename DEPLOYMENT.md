# VlogSpark AI 2.0 — API & Deployment Guide

> "From a simple idea to a complete video. Create, speak and publish with VlogSpark AI."

## Architecture Overview
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide icons
- **Backend**: Node.js + Express (`server.ts`) on port `3000` with Zod validation, CORS allowlisting, and rate limiting
- **AI Engine**: Server-side `@google/genai` SDK
  - Script, Speaking Guide, Scene Planner, Captions & Hashtags: `gemini-4-hydrogen`
  - Optional Synthetic Narration (clearly labelled): `gemini-3.8-flash-lite-tts`
  - Narration Transcription: `gemini-3.5-transcribe`
  - AI Image Generation (when billing-enabled key is attached): `gemini-3.1-flash-lite-image`
  - AI Video Clip Generation (when billing-enabled key is attached): `gemini-omni-1.2-flash`
- **Database & Auth**: Firebase Authentication (Google Sign-In + Email/Password) & Cloud Firestore with Eight-Pillar Security Rules (`firestore.rules`)
- **Video Production Pipeline**: Server-side FFmpeg H.264/AAC MP4 assembler (`POST /api/video/render`) + browser Canvas/MediaRecorder WebM fallback

## Backend REST API Endpoints
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Runtime capability status (FFmpeg, Gemini readiness, models) |
| `POST` | `/api/generate-script` | Generates structured 9-part script + speaking guide, or transforms an existing script |
| `POST` | `/api/generate-scenes` | Breaks a script into timed scene-by-scene production plans |
| `POST` | `/api/generate-captions` | Generates 4 caption variants, hashtags, keywords, post title & description |
| `POST` | `/api/generate-image` | Generates scene visuals via `gemini-3.1-flash-lite-image` |
| `POST` | `/api/tts` | Generates clearly-labelled synthetic voiceover WAV via `gemini-3.8-flash-lite-tts` |
| `POST` | `/api/transcribe` | Transcribes user audio recordings via `gemini-3.5-transcribe` |
| `POST` | `/api/media/upload` | Uploads validated user audio/images (MIME & size guarded) |
| `GET` | `/api/media/:category/:file` | Streams project media with HTTP Range support |
| `POST` | `/api/video/create` | Starts async AI video generation job via `gemini-omni-1.2-flash` |
| `POST` | `/api/video/render` | Starts real FFmpeg MP4 composition job from scenes, narration, music & captions |
| `GET` | `/api/video/status/:jobId` | Polls async AI video or FFmpeg render job progress & output URL |
| `GET/POST/PUT/DELETE` | `/api/projects` | Authenticated REST project sync endpoints |

## Google Cloud Run Deployment
1. Configure `GEMINI_API_KEY` in Cloud Run Secrets or AI Studio **Settings > Secrets**.
2. Deploy via Cloud Run source deployment:
   ```bash
   gcloud run deploy vlogspark-ai-2 \
     --source . \
     --region asia-northeast1 \
     --allow-unauthenticated \
     --port 3000 \
     --memory 2Gi \
     --cpu 2 \
     --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
   ```
3. To enable Email/Password sign-in in addition to Google Sign-In, open the Firebase Console for your project → **Authentication → Sign-in method → Email/Password → Enable**.
4. To enable GitHub synchronization, push this repository to GitHub and connect it via Cloud Run Continuous Deployment or AI Studio GitHub Sync.
