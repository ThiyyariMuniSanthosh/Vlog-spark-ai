import { ArrowRight, Play, Check } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { VlogSparkLogo } from '../components/Logo';

const WORKFLOW_STEPS = [
  {
    num: '01.',
    title: 'Idea to Natural Human Script',
    description:
      'Enter one topic, platform, language, and duration. VlogSpark AI writes an original 9-part script—hook, story, talking points, takeaway, and call to action—without robotic phrasing.',
    image: '/src/assets/images/showcase_teleprompter_1795254988723.jpg',
    alt: 'Cinema camera mounted behind a glass studio teleprompter',
    caption: 'Speaking Guide · Teleprompter Mode · 12+ Languages',
  },
  {
    num: '02.',
    title: 'Your Real Voice, Broadcast Ready',
    description:
      'Read directly off the adjustable full-screen teleprompter, record narration through your microphone or upload audio files, trim cleanly, and blend optional background music.',
    image: '/src/assets/images/showcase_audio_booth_1795254978880.jpg',
    alt: 'Studio condenser microphone on boom arm in dark acoustic booth',
    caption: 'Live Mic Capture · Waveform Trim · Optional AI Voice',
  },
  {
    num: '03.',
    title: 'Scene Plan to Playable MP4 Video',
    description:
      'Combine scene visuals, text overlays, transitions, captions, and your narration track in the timeline editor, then render a verified 720p or 1080p MP4 ready for social publishing.',
    image: '/src/assets/images/showcase_video_timeline_1795255222572.jpg',
    alt: 'Post-production editing suite monitor with color-graded timeline',
    caption: '9:16 Vertical · 16:9 Landscape · 1:1 Square',
  },
];

const SUPPORTED_LANGUAGES = [
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
  'Spanish & More',
];

const SUPPORTED_PLATFORMS = [
  'YouTube',
  'YouTube Shorts',
  'Instagram Reels',
  'Instagram Posts',
  'TikTok',
  'LinkedIn',
  'Facebook',
  'X',
];

export function LandingPage() {
  const { user, navigate } = useStudio();

  const handleStart = () => {
    navigate(user ? 'dashboard' : 'auth');
  };

  return (
    <div className="min-h-screen studio-canvas-bg text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-[#070B19]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="whitespace-nowrap shrink-0"
          >
            <VlogSparkLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#workflow" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Workflow
            </a>
            <a href="#studios" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Studios
            </a>
            <a href="#languages" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Languages
            </a>
            <button
              onClick={() => navigate('help')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Tutorials
            </button>
          </nav>

          <div className="shrink-0">
            <button
              onClick={handleStart}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all whitespace-nowrap shrink-0"
            >
              {user ? 'Open Studio' : 'Start Creating'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-sm font-medium text-blue-400 mb-4">
              VlogSpark AI 2.0 · Your Personal AI Content Director
            </p>
            <h1 className="font-display text-[clamp(2.35rem,4.3vw,3.75rem)] font-bold tracking-tight text-white leading-[1.08] mb-6">
              Your Ideas. Your Voice. Your Next Viral Story.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mb-8">
              Enter a single topic and move seamlessly from conversational script and teleprompter
              coaching to scene storyboards, your own recorded narration, and a social-ready MP4 video.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all whitespace-nowrap"
              >
                <span>{user ? 'Go to Creator Dashboard' : 'Start Your First Video'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#workflow"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-slate-700/90 hover:border-slate-500 text-slate-200 hover:text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Play className="w-4 h-4 text-blue-400" />
                <span>Explore Pipeline</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[300px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-slate-800/90 bg-[#0D132B]">
              <img
                src="/src/assets/images/hero_creator_studio_1795254972303.jpg"
                alt="VlogSpark AI dark creator video production studio with cinema camera and condenser microphone"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070B19]/90 via-[#070B19]/25 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <p className="text-xs text-blue-300 font-medium mb-1">
                  End-to-End Creator Workspace
                </p>
                <p className="text-sm sm:text-base font-medium text-white">
                  Script · Speaking Guide · Scene Planner · Voice Booth · FFmpeg MP4 Export
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Quantitative Capability Strip */}
        <div className="mt-14 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-white">9-Part</p>
            <p className="text-xs text-slate-400 mt-1">Structured human script blueprint</p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-white">12+</p>
            <p className="text-xs text-slate-400 mt-1">Indian &amp; global spoken languages</p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-white">1080p MP4</p>
            <p className="text-xs text-slate-400 mt-1">Real FFmpeg &amp; WebM video export</p>
          </div>
          <div>
            <p className="font-mono tabular-nums text-2xl font-semibold text-white">9:16 · 16:9 · 1:1</p>
            <p className="text-xs text-slate-400 mt-1">Ready for Reels, Shorts &amp; YouTube</p>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-800/70">
        <div className="max-w-2xl mb-14">
          <p className="text-sm font-medium text-blue-400 mb-3">Production Pipeline</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            Built for how real creators plan, speak, and publish
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Every step connects to the next inside one workspace—no jumping between scattered note apps, teleprompters, and timeline editors.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {WORKFLOW_STEPS.map((step) => (
            <article
              key={step.num}
              className="studio-panel rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#0B1229] relative overflow-hidden">
                <img
                  src={step.image}
                  alt={step.alt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D132B] via-transparent to-transparent" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <p className="text-xs text-slate-400 mb-2">{step.caption}</p>
                <h3 className="font-display text-xl font-semibold text-white mb-3">
                  <span className="text-blue-400 mr-2 font-mono">{step.num}</span>
                  {step.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Studios Matrix */}
      <section id="studios" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-800/70">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <p className="text-sm font-medium text-violet-400 mb-3">Integrated Studios</p>
            <h2 className="font-display text-3xl font-bold text-white tracking-tight mb-4">
              Every tool you need from first hook to final export
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Save unlimited projects securely to your private Firebase workspace and reopen any script, scene plan, or export at any time.
            </p>
            <button
              onClick={handleStart}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-sm font-semibold transition-colors"
            >
              <span>Launch Creator Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {[
              ['Conversational Script Editor', '8 one-click rewrites: shorten, expand, emotional, professional, simplify, or translate.'],
              ['Teleprompter & Delivery Guide', 'Sentence-by-sentence pacing, pause cues, word emphasis, and full-screen scrolling teleprompter.'],
              ['Scene-by-Scene Director Plan', 'Camera angles, movement, B-roll notes, text overlays, and editable timing per scene.'],
              ['Visual Studio & Card Builder', 'Connect Gemini Image API, upload custom photos, or render crisp Studio Graphic Cards.'],
              ['Voice Recording & Music Mixing', 'Record your real voice via mic, trim clips, blend background music, or preview labelled TTS.'],
              ['Captions, Hashtags & MP4 Export', 'Platform captions, SEO keywords, FFmpeg MP4 rendering, and playback verification.'],
            ].map(([title, desc]) => (
              <div key={title} className="pb-5 border-b border-slate-800/80">
                <h3 className="text-base font-semibold text-white mb-1.5 flex items-center gap-2">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>{title}</span>
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Languages & Platforms */}
      <section id="languages" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-800/70">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">
              Natural Scripting Across Languages
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Scripts adapt to conversational spoken cadence rather than literal textbook translations.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-sm text-slate-300">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <div key={lang} className="py-1.5 border-b border-slate-800/70">
                  {lang}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-3">
              Tailored for Every Platform Format
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Hooks, pacing, captions, hashtags, and aspect ratios adjust cleanly to your target channel.
            </p>
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm text-slate-300">
              {SUPPORTED_PLATFORMS.map((plat) => (
                <div key={plat} className="py-1.5 border-b border-slate-800/70">
                  {plat}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060915]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <VlogSparkLogo />
            <p className="text-sm text-slate-400 mt-3 max-w-md">
              From a simple idea to a complete video. Create, speak and publish with VlogSpark AI.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
            <button onClick={handleStart} className="hover:text-white transition-colors">
              Creator Studio
            </button>
            <button onClick={() => navigate('help')} className="hover:text-white transition-colors">
              Help &amp; Tutorials
            </button>
            <span className="text-slate-600">© {new Date().getFullYear()} VlogSpark AI 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
