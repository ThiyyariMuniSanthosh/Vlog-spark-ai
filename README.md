# VlogSpark AI 2.0

**Your Ideas. Your Voice. Your Next Viral Story.**

From a simple idea to a complete video. Create, speak and publish with VlogSpark AI.

## Features
- **AI Content Generator**: Turns a single topic into a 9-part conversational script, sentence-by-sentence speaking guide, timed scene plan, and platform captions/hashtags (`gemini-4-hydrogen`).
- **Script Editor & Speaking Guide**: Inline editing, 8 one-click AI script rewrites (emotional, simpler, shorter, professional, multi-language), and a full-screen mirrorable Teleprompter.
- **Scene Planner & Visual Studio**: Editable scene timeline with Gemini Image API support, custom photo upload, and Studio Graphic Card rendering.
- **Voice Recording Studio**: Microphone capture with live meter, audio upload, trim controls, background music mixing, royalty-free ambient bed generator, transcription (`gemini-3.5-transcribe`), and optional clearly-labelled synthetic TTS (`gemini-3.8-flash-lite-tts`).
- **Video Editor & Export Center**: Live Canvas preview, server-side FFmpeg H.264/AAC MP4 rendering (`9:16`, `16:9`, `1:1` in `720p`/`1080p`), browser WebM fallback, and built-in HTML5 playback validation.
- **Firebase Auth & Cloud Firestore**: Owner-isolated project persistence protected by deployed `firestore.rules`.

## Local Development
```bash
npm install
cp .env.example .env
# Set GEMINI_API_KEY in .env
npm run dev
```
Open `http://localhost:3000`.

## Production Build & Cloud Run Deployment
```bash
npm run build
npm run start
```
Or deploy directly to Google Cloud Run (see `DEPLOYMENT.md` and `Dockerfile`):
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
