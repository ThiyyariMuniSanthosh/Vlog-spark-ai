import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { VlogSparkLogo } from '../components/Logo';

const TUTORIAL_STEPS = [
  {
    num: '01.',
    title: 'Generate a Complete Production Blueprint',
    body: 'Open AI Content Generator, enter your raw topic, choose your platform, language (English, Telugu, Tamil, Hindi, and more), tone, and target duration, then click GENERATE MY CONTENT. VlogSpark AI writes a natural 9-part script, sentence-by-sentence speaking guide, timed scene plan, and platform captions in one pass.',
  },
  {
    num: '02.',
    title: 'Refine Your Script & Practice on the Teleprompter',
    body: 'In the Script Editor, refine any line manually or trigger one-click rewrites (more emotional, simpler, shorter, professional, or another language). Switch to Speaking Guide for pause and emphasis cues, then launch Full-Screen Teleprompter with adjustable text size and scroll speed.',
  },
  {
    num: '03.',
    title: 'Attach Visuals to Every Scene',
    body: 'Adjust scene durations and camera notes in Scene Planner, then visit AI Visual Studio. Generate scene imagery via Gemini Image API (when a billing-enabled key is attached in Settings > Secrets), upload your own photos, or render crisp Studio Graphic Cards in one click.',
  },
  {
    num: '04.',
    title: 'Record Your Voice & Mix Music',
    body: 'Open Voice Recording Studio to capture narration directly from your microphone or upload an existing voice file. Trim start/end points, adjust narration volume, add background music or a royalty-free ambient bed, and optionally preview a clearly labelled synthetic voice.',
  },
  {
    num: '05.',
    title: 'Assemble, Verify Playback & Export MP4',
    body: 'Preview your scenes, captions, intro/outro cards, and audio together in the Video Editor. Render a real playable H.264 MP4 via the FFmpeg server pipeline (or WebM in your browser), verify playback right inside the Export Center, and copy your ready-to-publish captions and hashtags.',
  },
];

const FAQS = [
  {
    q: 'Why does AI Image or AI Video Clip generation mention a billing-enabled API key?',
    a: 'Script generation, speaking guides, scene planning, captions, transcription, and standard TTS work out of the box. Paid media models (Gemini Image and Gemini Omni Video) require a billing-enabled API key configured in AI Studio Settings > Secrets. When unavailable, VlogSpark AI transparently lets you upload your own visuals, render Studio Graphic Cards, and export real playable MP4 videos using FFmpeg—never faking AI imagery.',
  },
  {
    q: 'Can I sign in with Email and Password as well as Google?',
    a: 'Google Sign-In works immediately with verified email status. To also allow Email/Password accounts, enable Email/Password under Authentication → Sign-in method in the Firebase Console for your project.',
  },
  {
    q: 'Are my projects private?',
    a: 'Yes. Every project document in Cloud Firestore is strictly scoped to your authenticated user ID (`ownerId == request.auth.uid`) via deployed Firestore Security Rules.',
  },
];

export function HelpTutorialsPage() {
  const { user, navigate } = useStudio();

  const content = (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Help &amp; Creator Tutorials
        </h1>
        <p className="text-sm text-slate-400 mt-1.5">
          Everything you need to go from a rough idea to a published social media video with
          VlogSpark AI 2.0.
        </p>
      </div>

      {/* Step-by-Step Guide */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          5-Step Creator Workflow
        </h2>
        <div className="space-y-3">
          {TUTORIAL_STEPS.map((step) => (
            <article key={step.num} className="studio-panel rounded-2xl p-5 sm:p-6">
              <h3 className="font-display text-base font-semibold text-white mb-2">
                <span className="font-mono text-blue-400 mr-2">{step.num}</span>
                {step.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Platform Format Reference */}
      <section className="studio-panel rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-white">
          Recommended Export Settings by Platform
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 pr-4 font-medium">Platform</th>
                <th className="py-2.5 px-4 font-medium">Aspect Ratio</th>
                <th className="py-2.5 px-4 font-medium">Resolution</th>
                <th className="py-2.5 pl-4 font-medium">Ideal Pacing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-300">
              <tr>
                <td className="py-3 pr-4 font-medium text-white">YouTube Shorts / Reels / TikTok</td>
                <td className="py-3 px-4 font-mono">9:16 Vertical</td>
                <td className="py-3 px-4 font-mono">1080p or 720p</td>
                <td className="py-3 pl-4">15s – 60s · Fast hook in first 2s</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-white">YouTube Standard / LinkedIn</td>
                <td className="py-3 px-4 font-mono">16:9 Landscape</td>
                <td className="py-3 px-4 font-mono">1080p HD</td>
                <td className="py-3 pl-4">90s – 5 min · Conversational depth</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium text-white">Instagram Feed / X / Facebook</td>
                <td className="py-3 px-4 font-mono">1:1 Square</td>
                <td className="py-3 px-4 font-mono">720p or 1080p</td>
                <td className="py-3 pl-4">30s – 90s · Burn-in captions on</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((item) => (
            <div key={item.q} className="studio-panel rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1.5">{item.q}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => navigate(user ? 'generator' : 'auth')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-semibold"
        >
          <span>{user ? 'Open AI Content Generator' : 'Sign In & Start Creating'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // If signed out, render with standalone clean top bar
  if (!user) {
    return (
      <div className="min-h-screen studio-canvas-bg text-slate-100">
        <header className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between border-b border-slate-800/70">
          <button onClick={() => navigate('landing')}>
            <VlogSparkLogo />
          </button>
          <button
            onClick={() => navigate('landing')}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </header>
        <main className="px-6 py-12">{content}</main>
      </div>
    );
  }

  return content;
}
