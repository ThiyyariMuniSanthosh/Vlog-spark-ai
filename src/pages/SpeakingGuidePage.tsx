import { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  FlipHorizontal2,
  ArrowRight,
  Mic,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';

function highlightWords(sentence: string, emphasize: string[]) {
  if (!emphasize.length) return sentence;
  const escaped = emphasize
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!escaped.length) return sentence;
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = sentence.split(regex);
  return parts.map((part, idx) =>
    escaped.some((e) => new RegExp(`^${e}$`, 'i').test(part)) ? (
      <strong key={idx} className="text-blue-300 font-semibold underline decoration-blue-400/60 underline-offset-4">
        {part}
      </strong>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}

export function SpeakingGuidePage() {
  const { activeProject, navigate } = useStudio();
  const [tab, setTab] = useState<'guide' | 'teleprompter'>('guide');
  const [fontSize, setFontSize] = useState(34);
  const [scrollSpeed, setScrollSpeed] = useState(35); // px per second
  const [scrolling, setScrolling] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const prompterBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrolling) return;
    let rafId = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const el = scrollAreaRef.current;
      if (el) {
        el.scrollTop += scrollSpeed * dt;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
          setScrolling(false);
          return;
        }
      }
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [scrolling, scrollSpeed]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  if (!activeProject) {
    return <EmptyProjectNotice studioName="Speaking Guide" />;
  }

  const guide = activeProject.speakingGuide || [];
  const fullScriptText =
    activeProject.script?.detailedScript || guide.map((g) => g.sentence).join('\n\n');

  const toggleFullscreen = async () => {
    const box = prompterBoxRef.current;
    if (!box) return;
    try {
      if (!document.fullscreenElement) {
        await box.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in certain nested iframes; stay gracefully inline
    }
  };

  const resetScroll = () => {
    setScrolling(false);
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Speaking Guide &amp; Teleprompter
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Line-by-line delivery coaching and an eye-level teleprompter for natural on-camera confidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 rounded-xl bg-[#0B122A] border border-slate-800">
            <button
              onClick={() => setTab('guide')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'guide' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Delivery Coach
            </button>
            <button
              onClick={() => setTab('teleprompter')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === 'teleprompter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Teleprompter
            </button>
          </div>
          <button
            onClick={() => navigate('voice')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold whitespace-nowrap"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Record Voice</span>
          </button>
        </div>
      </div>

      {tab === 'guide' ? (
        <div className="space-y-4">
          {guide.length === 0 ? (
            <div className="studio-panel rounded-2xl p-8 text-center">
              <p className="text-sm text-slate-400">
                No line-by-line speaking guide found yet. Regenerate your script in the Script Editor to build coaching cues.
              </p>
            </div>
          ) : (
            guide.map((item, idx) => (
              <article key={item.id || idx} className="studio-panel rounded-2xl p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-3">
                  <span className="font-mono text-blue-400 font-medium">
                    Line {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Speed: {item.speakingSpeed}</span>
                    <span aria-hidden="true">·</span>
                    <span>Emotion: {item.emotion}</span>
                  </div>
                </div>

                <p className="text-base sm:text-lg text-white leading-relaxed mb-5">
                  &ldquo;{highlightWords(item.sentence, item.emphasizeWords)}&rdquo;
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1">How to say it</p>
                    <p className="text-slate-200 leading-relaxed">{item.howToSay}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Where to pause</p>
                    <p className="text-slate-200 leading-relaxed">{item.pauseAt}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Words to emphasize</p>
                    <p className="text-blue-300 font-medium">
                      {item.emphasizeWords.length > 0 ? item.emphasizeWords.join(', ') : 'Natural even stress'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Facial expression</p>
                    <p className="text-slate-200 leading-relaxed">{item.facialExpression}</p>
                  </div>
                </div>
              </article>
            ))
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => navigate('scenes')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
            >
              <span>Next: Scene Planner</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Interactive Teleprompter */
        <div
          ref={prompterBoxRef}
          className="studio-panel rounded-2xl overflow-hidden flex flex-col bg-[#050814]"
        >
          {/* Controls Bar */}
          <div className="p-4 border-b border-slate-800 bg-[#0A1026] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScrolling((s) => !s)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                {scrolling ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{scrolling ? 'Pause' : 'Start Scroll'}</span>
              </button>
              <button
                onClick={resetScroll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs text-slate-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                onClick={() => setMirrored((m) => !m)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${
                  mirrored
                    ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                    : 'border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                Mirror
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300">
              <label className="flex items-center gap-2">
                <span>Text Size</span>
                <input
                  type="range"
                  min={22}
                  max={64}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-24 accent-blue-500"
                />
                <span className="font-mono tabular-nums w-9">{fontSize}px</span>
              </label>

              <label className="flex items-center gap-2">
                <span>Speed</span>
                <input
                  type="range"
                  min={10}
                  max={120}
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(Number(e.target.value))}
                  className="w-24 accent-violet-500"
                />
                <span className="font-mono tabular-nums w-10">{scrollSpeed}px/s</span>
              </label>

              <button
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-500 text-xs text-slate-200"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    Exit Full Screen
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    Full Screen
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Reading Guide Window */}
          <div className="relative flex-1">
            {/* Eye-line horizontal guide */}
            <div className="pointer-events-none absolute top-[28%] left-0 right-0 h-px bg-blue-500/40 z-10" />
            <div
              ref={scrollAreaRef}
              className="h-[520px] overflow-y-auto px-8 sm:px-16 py-28"
            >
              <div
                style={{
                  fontSize: `${fontSize}px`,
                  transform: mirrored ? 'scaleX(-1)' : undefined,
                }}
                className="max-w-4xl mx-auto text-white font-medium leading-[1.55] whitespace-pre-line tracking-wide pb-72"
              >
                {fullScriptText}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
