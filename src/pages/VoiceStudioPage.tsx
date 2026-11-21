import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Volume2,
  Music,
  Save,
  Loader2,
  Sparkles,
  FileAudio,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { EmptyProjectNotice } from '../components/EmptyProjectNotice';
import {
  generateSyntheticTtsApi,
  transcribeAudioApi,
  uploadMediaFile,
} from '../services/api';
import type { AudioTrackConfig } from '../types';

const SYNTHETIC_VOICES = [
  { id: 'Kore', desc: 'Warm, articulate creator voice' },
  { id: 'Puck', desc: 'Bright, energetic presenter voice' },
  { id: 'Charon', desc: 'Calm, documentary narrator voice' },
  { id: 'Fenrir', desc: 'Deep, confident storyteller voice' },
  { id: 'Zephyr', desc: 'Friendly, conversational explainer voice' },
] as const;

// Encode raw Float32 mono audio buffer into a clean RIFF WAV Blob (for ambient synth bed)
function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function VoiceStudioPage() {
  const { activeProject, saveProjectUpdates, navigate, notify } = useStudio();
  const [audioCfg, setAudioCfg] = useState<AudioTrackConfig>({
    narrationVolume: 1,
    trimStart: 0,
    trimEnd: 0,
    bgMusicVolume: 0.22,
  });

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const narrationElRef = useRef<HTMLAudioElement | null>(null);
  const musicElRef = useRef<HTMLAudioElement | null>(null);

  // Optional labelled TTS state
  const [ttsConsent, setTtsConsent] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<(typeof SYNTHETIC_VOICES)[number]['id']>('Kore');
  const [ttsBusy, setTtsBusy] = useState(false);
  const [synthBedBusy, setSynthBedBusy] = useState(false);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (activeProject?.audio) {
      setAudioCfg({
        narrationUrl: activeProject.audio.narrationUrl,
        narrationFileName: activeProject.audio.narrationFileName,
        narrationSource: activeProject.audio.narrationSource,
        narrationDuration: activeProject.audio.narrationDuration,
        narrationVolume: activeProject.audio.narrationVolume ?? 1,
        trimStart: activeProject.audio.trimStart ?? 0,
        trimEnd: activeProject.audio.trimEnd ?? 0,
        bgMusicUrl: activeProject.audio.bgMusicUrl,
        bgMusicFileName: activeProject.audio.bgMusicFileName,
        bgMusicVolume: activeProject.audio.bgMusicVolume ?? 0.22,
        transcript: activeProject.audio.transcript,
      });
    }
  }, [activeProject]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (narrationElRef.current) {
      narrationElRef.current.volume = Math.min(1, audioCfg.narrationVolume);
    }
    if (musicElRef.current) {
      musicElRef.current.volume = Math.min(1, audioCfg.bgMusicVolume);
    }
  }, [audioCfg.narrationVolume, audioCfg.bgMusicVolume]);

  if (!activeProject) {
    return <EmptyProjectNotice studioName="Voice Recording Studio" />;
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
        audioCtxRef.current?.close().catch(() => {});
        setMicLevel(0);

        setUploading(true);
        try {
          const uploaded = await uploadMediaFile(blob, `narration_${Date.now()}.webm`);
          const nextAudio: AudioTrackConfig = {
            ...audioCfg,
            narrationUrl: uploaded.url,
            narrationFileName: uploaded.fileName,
            narrationSource: 'mic_recording',
            trimStart: 0,
            trimEnd: 0,
          };
          setAudioCfg(nextAudio);
          await saveProjectUpdates(
            activeProject.id,
            { audio: nextAudio, status: activeProject.status === 'draft' ? 'in_progress' : activeProject.status },
            'Recorded personal narration via microphone',
          );
          notify('Your microphone recording has been saved to this project.', 'success');
        } catch (err) {
          notify(err instanceof Error ? err.message : 'Failed to save recording.', 'error');
        } finally {
          setUploading(false);
        }
      };

      // Live audio level meter
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 140) * 100)));
        meterRafRef.current = requestAnimationFrame(updateMeter);
      };
      meterRafRef.current = requestAnimationFrame(updateMeter);

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      notify(
        'Microphone access was denied or unavailable. You can also upload an audio recording file below.',
        'error',
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUploadAudio = async (
    target: 'narration' | 'music',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMediaFile(file);
      const nextAudio: AudioTrackConfig =
        target === 'narration'
          ? {
              ...audioCfg,
              narrationUrl: uploaded.url,
              narrationFileName: uploaded.originalName || uploaded.fileName,
              narrationSource: 'audio_upload',
              trimStart: 0,
              trimEnd: 0,
            }
          : {
              ...audioCfg,
              bgMusicUrl: uploaded.url,
              bgMusicFileName: uploaded.originalName || uploaded.fileName,
            };
      setAudioCfg(nextAudio);
      await saveProjectUpdates(
        activeProject.id,
        { audio: nextAudio },
        target === 'narration' ? 'Uploaded narration audio file' : 'Added background music track',
      );
      notify(
        target === 'narration' ? 'Narration audio uploaded.' : 'Background music attached.',
        'success',
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Audio upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateAmbientBed = async () => {
    setSynthBedBusy(true);
    try {
      // Synthesize a clean 16-second warm lo-fi ambient chord pad locally
      const sampleRate = 24000;
      const durationSec = 16;
      const samples = new Float32Array(sampleRate * durationSec);
      const chords = [
        [220, 261.63, 329.63, 392.0], // Am7
        [174.61, 220, 261.63, 329.63], // Fmaj7
        [130.81, 196, 246.94, 329.63], // Cmaj7
        [196.0, 246.94, 293.66, 392.0], // G6
      ];
      for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate;
        const chordIdx = Math.floor(t / 4) % chords.length;
        const localT = t % 4;
        const env = Math.min(1, localT / 0.4) * Math.min(1, (4 - localT) / 0.4);
        let val = 0;
        for (const freq of chords[chordIdx]) {
          val += Math.sin(2 * Math.PI * freq * t) * 0.14;
          val += Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.06;
        }
        samples[i] = val * env * 0.65;
      }
      const wavBlob = encodeWavMono(samples, sampleRate);
      const uploaded = await uploadMediaFile(wavBlob, 'ambient_studio_bed.wav');
      const nextAudio: AudioTrackConfig = {
        ...audioCfg,
        bgMusicUrl: uploaded.url,
        bgMusicFileName: 'Ambient Studio Pad (Royalty-Free).wav',
      };
      setAudioCfg(nextAudio);
      await saveProjectUpdates(activeProject.id, { audio: nextAudio }, 'Added studio ambient bed');
      notify('Ambient background music track ready.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create ambient bed.', 'error');
    } finally {
      setSynthBedBusy(false);
    }
  };

  const handleSyntheticTts = async () => {
    if (!ttsConsent) {
      notify('Please confirm the synthetic voice disclosure checkbox first.', 'info');
      return;
    }
    const text = activeProject.script?.detailedScript?.trim();
    if (!text) {
      notify('Add script text in the Script Editor first.', 'info');
      return;
    }
    setTtsBusy(true);
    try {
      const res = await generateSyntheticTtsApi({
        text: text.slice(0, 2800),
        voiceName: ttsVoice,
        style: `${activeProject.tone}, clear creator delivery`,
      });
      const nextAudio: AudioTrackConfig = {
        ...audioCfg,
        narrationUrl: res.url,
        narrationFileName: `Synthetic Voice (${ttsVoice}) — Gemini TTS.wav`,
        narrationSource: 'synthetic_tts',
        trimStart: 0,
        trimEnd: 0,
      };
      setAudioCfg(nextAudio);
      await saveProjectUpdates(
        activeProject.id,
        { audio: nextAudio },
        `Generated clearly-labelled synthetic voiceover (${ttsVoice})`,
      );
      notify(`Synthetic voiceover (${ttsVoice}) generated and attached.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Synthetic TTS failed.', 'error');
    } finally {
      setTtsBusy(false);
    }
  };

  const handleTranscribe = async () => {
    if (!audioCfg.narrationUrl) return;
    setTranscribing(true);
    try {
      const res = await transcribeAudioApi(audioCfg.narrationUrl);
      const nextAudio = { ...audioCfg, transcript: res.transcript };
      setAudioCfg(nextAudio);
      await saveProjectUpdates(activeProject.id, { audio: nextAudio }, 'Transcribed voice recording');
      notify('Narration transcribed.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Transcription failed.', 'error');
    } finally {
      setTranscribing(false);
    }
  };

  const handleTogglePlay = () => {
    const nar = narrationElRef.current;
    const mus = musicElRef.current;
    if (!nar) return;
    if (isPlaying) {
      nar.pause();
      mus?.pause();
      setIsPlaying(false);
    } else {
      if (audioCfg.trimStart > 0 && nar.currentTime < audioCfg.trimStart) {
        nar.currentTime = audioCfg.trimStart;
      }
      nar.play().catch(() => {});
      if (mus && audioCfg.bgMusicUrl) {
        mus.currentTime = 0;
        mus.play().catch(() => {});
      }
      setIsPlaying(true);
    }
  };

  const handleSaveAudioConfig = async () => {
    setSaving(true);
    try {
      await saveProjectUpdates(activeProject.id, { audio: audioCfg }, 'Saved voice & music mix');
      notify('Audio mix & trim settings saved.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save audio settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignSceneAudio = async (sceneId: string, useMainNarration: boolean) => {
    const updated = activeProject.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, audioUrl: useMainNarration ? audioCfg.narrationUrl : undefined }
        : s,
    );
    await saveProjectUpdates(activeProject.id, { scenes: updated });
    notify('Updated scene narration assignment.', 'success');
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">
            Voice &amp; Recording Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Record your authentic narration with your microphone, upload recordings, trim, and mix
            background music.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveAudioConfig}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Mix</span>
          </button>
          <button
            onClick={() => navigate('editor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white text-xs font-semibold"
          >
            <span>Open Video Editor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recorder & Playback */}
        <section className="lg:col-span-7 space-y-6">
          {/* Microphone Capture Booth */}
          <div className="studio-panel rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white">
                1. Record Your Own Narration
              </h2>
              <span className="font-mono tabular-nums text-sm text-blue-300">
                {formatSec(recordSeconds)}
              </span>
            </div>

            {/* Live Meter */}
            <div className="h-12 rounded-xl bg-[#090F24] border border-slate-800 px-4 flex items-center gap-1.5 overflow-hidden">
              {Array.from({ length: 28 }).map((_, i) => {
                const threshold = ((i + 1) / 28) * 100;
                const lit = isRecording && micLevel >= threshold * 0.7;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-75 ${
                      lit ? 'bg-gradient-to-t from-blue-500 to-violet-400 h-7' : 'bg-slate-800 h-2'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Microphone Recording</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-950 hover:bg-slate-200 text-sm font-semibold transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop &amp; Save Recording</span>
                </button>
              )}

              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors">
                <Upload className="w-4 h-4 text-blue-400" />
                <span>{uploading ? 'Uploading...' : 'Upload Audio File'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleUploadAudio('narration', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Narration Preview & Trim Controls */}
          <div className="studio-panel rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-white">
                2. Preview, Trim &amp; Volume Mix
              </h2>
              {audioCfg.narrationSource && (
                <span className="text-xs text-slate-400">
                  Source:{' '}
                  {audioCfg.narrationSource === 'mic_recording'
                    ? 'Your Microphone'
                    : audioCfg.narrationSource === 'audio_upload'
                      ? 'Uploaded Audio'
                      : 'Synthetic AI Voice (Labelled)'}
                </span>
              )}
            </div>

            {audioCfg.narrationUrl ? (
              <>
                <audio
                  ref={narrationElRef}
                  src={audioCfg.narrationUrl}
                  onLoadedMetadata={(e) => {
                    const dur = e.currentTarget.duration;
                    if (Number.isFinite(dur)) {
                      setAudioDuration(dur);
                      if (!audioCfg.trimEnd || audioCfg.trimEnd > dur) {
                        setAudioCfg((prev) => ({
                          ...prev,
                          narrationDuration: Math.round(dur),
                          trimEnd: Number(dur.toFixed(1)),
                        }));
                      }
                    }
                  }}
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setCurrentTime(t);
                    if (audioCfg.trimEnd > audioCfg.trimStart && t >= audioCfg.trimEnd) {
                      e.currentTarget.pause();
                      musicElRef.current?.pause();
                      setIsPlaying(false);
                    }
                  }}
                  onEnded={() => {
                    musicElRef.current?.pause();
                    setIsPlaying(false);
                  }}
                  className="hidden"
                />

                {audioCfg.bgMusicUrl && (
                  <audio ref={musicElRef} src={audioCfg.bgMusicUrl} loop className="hidden" />
                )}

                <div className="p-4 rounded-xl bg-[#090F24] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={handleTogglePlay}
                        aria-label={isPlaying ? 'Pause narration' : 'Play narration'}
                        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {audioCfg.narrationFileName || 'Narration Track'}
                        </p>
                        <p className="font-mono tabular-nums text-xs text-slate-400">
                          {formatSec(currentTime)} / {formatSec(audioDuration)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-xs text-slate-200 disabled:opacity-50 whitespace-nowrap"
                    >
                      {transcribing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileAudio className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>Transcribe</span>
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={audioDuration || 10}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCurrentTime(val);
                      if (narrationElRef.current) narrationElRef.current.currentTime = val;
                    }}
                    className="w-full accent-blue-500"
                  />
                </div>

                {/* Trim & Volume */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Trim Start (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, audioDuration - 0.5)}
                      step={0.5}
                      value={audioCfg.trimStart}
                      onChange={(e) =>
                        setAudioCfg({ ...audioCfg, trimStart: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Trim End (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={audioDuration || 300}
                      step={0.5}
                      value={audioCfg.trimEnd}
                      onChange={(e) =>
                        setAudioCfg({ ...audioCfg, trimEnd: Math.max(0, Number(e.target.value)) })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#090F24] border border-slate-800 text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-slate-400 mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Volume2 className="w-3.5 h-3.5" /> Narration Vol
                      </span>
                      <span className="font-mono tabular-nums">
                        {Math.round(audioCfg.narrationVolume * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={audioCfg.narrationVolume}
                      onChange={(e) =>
                        setAudioCfg({ ...audioCfg, narrationVolume: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500 mt-1.5"
                    />
                  </div>
                </div>

                {audioCfg.transcript && (
                  <div className="p-4 rounded-xl bg-[#090F24] border border-slate-800 text-xs">
                    <p className="text-slate-400 font-medium mb-1">Transcript</p>
                    <p className="text-slate-200 leading-relaxed">{audioCfg.transcript}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">
                No narration audio attached yet. Record your voice above or upload an audio file.
              </p>
            )}
          </div>

          {/* Background Music */}
          <div className="studio-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-violet-400" />
                3. Background Music
              </h2>
              {audioCfg.bgMusicUrl && (
                <button
                  onClick={() =>
                    setAudioCfg({ ...audioCfg, bgMusicUrl: undefined, bgMusicFileName: undefined })
                  }
                  className="text-xs text-slate-400 hover:text-red-400 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200">
                <Upload className="w-3.5 h-3.5 text-violet-400" />
                <span>Upload Music Track</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleUploadAudio('music', e)}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleGenerateAmbientBed}
                disabled={synthBedBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/30 text-xs font-medium text-violet-100 disabled:opacity-50"
              >
                {synthBedBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Music className="w-3.5 h-3.5" />
                )}
                <span>Create Royalty-Free Ambient Bed</span>
              </button>
            </div>

            {audioCfg.bgMusicUrl && (
              <div className="space-y-2 pt-2">
                <p className="text-xs text-slate-300 truncate">{audioCfg.bgMusicFileName}</p>
                <label className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Music Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioCfg.bgMusicVolume}
                    onChange={(e) =>
                      setAudioCfg({ ...audioCfg, bgMusicVolume: Number(e.target.value) })
                    }
                    className="flex-1 accent-violet-500"
                  />
                  <span className="font-mono tabular-nums w-9">
                    {Math.round(audioCfg.bgMusicVolume * 100)}%
                  </span>
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Right: Quick Script Reference + Optional Labelled Synthetic TTS + Scene Audio Mapping */}
        <aside className="lg:col-span-5 space-y-6">
          <div className="studio-panel rounded-2xl p-5">
            <h2 className="font-display text-sm font-semibold text-white mb-2">
              Script Cue Sheet (Read While Recording)
            </h2>
            <div className="max-h-60 overflow-y-auto p-3.5 rounded-xl bg-[#090F24] border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {activeProject.script.detailedScript}
            </div>
          </div>

          {/* Clearly Labelled Optional Synthetic Voiceover */}
          <div className="studio-panel rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                Optional Synthetic AI Voiceover
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your own recorded voice is always recommended. If you need a draft voiceover, you may
                generate a clearly labelled synthetic voice using Gemini 3.8 TTS—never cloning any real
                person.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-300">Select Synthetic Voice</label>
              <select
                value={ttsVoice}
                onChange={(e) =>
                  setTtsVoice(e.target.value as (typeof SYNTHETIC_VOICES)[number]['id'])
                }
                className="w-full px-3 py-2 rounded-xl bg-[#090F24] border border-slate-700 text-xs text-white"
              >
                {SYNTHETIC_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} — {v.desc}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={ttsConsent}
                onChange={(e) => setTtsConsent(e.target.checked)}
                className="mt-0.5 accent-blue-500"
              />
              <span>
                I understand this creates a synthetic AI voice track (not my cloned voice) for draft
                or narrated playback.
              </span>
            </label>

            <button
              onClick={handleSyntheticTts}
              disabled={ttsBusy || !ttsConsent}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/35 text-xs font-semibold text-blue-100 disabled:opacity-45 transition-colors"
            >
              {ttsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{ttsBusy ? 'Synthesizing Voiceover...' : 'Generate Labelled AI Voiceover'}</span>
            </button>
          </div>

          {/* Per-Scene Narration Assignment */}
          <div className="studio-panel rounded-2xl p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-white">Scene Audio Track Map</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {activeProject.scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#090F24] border border-slate-800 text-xs"
                >
                  <span className="text-slate-200 truncate">
                    Scene {scene.sceneNumber} ({scene.startTime}s–{scene.endTime}s)
                  </span>
                  <button
                    disabled={!audioCfg.narrationUrl}
                    onClick={() => handleAssignSceneAudio(scene.id, !scene.audioUrl)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap ${
                      scene.audioUrl
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {scene.audioUrl ? 'Synced' : 'Assign Main'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
