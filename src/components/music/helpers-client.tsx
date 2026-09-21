"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, FastForward, Flame, Guitar, Hand, Mic, MicOff, Play, Sliders, Sparkles, Square, Volume2, VolumeX } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { useAudio } from "@/components/music/audio-provider";
import { detectPitchAutocorrelation, type PitchDetection } from "@/lib/music/pitch";
import { playReferencePluck, type PluckInstrument } from "@/lib/music/instrument-synth";
import {
  BASS_TUNINGS,
  GUITAR_TUNINGS,
  bassTuningsForStringCount,
  centsFromTarget,
  findClosestString,
  type TuningPreset,
  type TuningString,
} from "@/lib/music/tunings";
import { playMetronomeSound, type MetronomeSoundType } from "@/lib/music/metronome-sound";

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"] as const;

type InstrumentMode = "guitar" | "bass";
type BassStringCount = 4 | 5 | 6;

function tuningStatus(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return { label: "In tune", tone: "text-[var(--color-mint)]", bg: "bg-[var(--color-success-surface)]" };
  if (abs <= 15) return { label: "Close", tone: "text-yellow-400", bg: "bg-yellow-500/10" };
  return { label: cents > 0 ? "Sharp" : "Flat", tone: "text-red-400", bg: "bg-red-500/10" };
}

function getBeatsPerBar(sig: (typeof TIME_SIGNATURES)[number]) {
  switch (sig) {
    case "2/4": return 2;
    case "3/4": return 3;
    case "4/4": return 4;
    case "5/4": return 5;
    case "6/8": return 6;
    case "7/8": return 7;
    case "9/8": return 9;
    case "12/8": return 12;
    default: return 4;
  }
}

function isAccentBeat(beat: number, sig: (typeof TIME_SIGNATURES)[number]): boolean {
  if (beat === 0) return true;
  if (sig === "5/4") return beat === 3;
  if (sig === "6/8") return beat === 3;
  if (sig === "7/8") return beat === 2 || beat === 4;
  if (sig === "9/8") return beat === 3 || beat === 6;
  if (sig === "12/8") return beat === 3 || beat === 6 || beat === 9;
  return false;
}

export function HelpersClient() {
  const { getAudioContext } = useAudio();
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<(typeof TIME_SIGNATURES)[number]>("4/4");
  const [subdivision, setSubdivision] = useState<1 | 2 | 3 | 4 | 6>(1);
  const [soundType, setSoundType] = useState<MetronomeSoundType>("digital");
  const [beatCount, setBeatCount] = useState(0);
  const [clickVolume, setClickVolume] = useState(0.75);
  const [countInBars, setCountInBars] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [accentFlash, setAccentFlash] = useState(false);

  // Speed Trainer Mode
  const [speedTrainer, setSpeedTrainer] = useState(false);
  const [trainerInc, setTrainerInc] = useState(2);
  const [trainerEveryBars, setTrainerEveryBars] = useState(4);
  const [trainerTargetBpm, setTrainerTargetBpm] = useState(160);

  // Gap / Mute Training Mode
  const [gapTraining, setGapTraining] = useState(false);
  const [gapPlayBars, setGapPlayBars] = useState(3);
  const [gapMuteBars, setGapMuteBars] = useState(1);

  const [instrumentMode, setInstrumentMode] = useState<InstrumentMode>("guitar");
  const [bassStringCount, setBassStringCount] = useState<BassStringCount>(4);
  const [showExtendedBass, setShowExtendedBass] = useState(false);
  const [tuningId, setTuningId] = useState(GUITAR_TUNINGS[0].id);
  const [pluckVoice, setPluckVoice] = useState<PluckInstrument>("guitar-steel");
  const [activeStringLabel, setActiveStringLabel] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<PitchDetection | null>(null);

  const nextStepTimeRef = useRef(0);
  const schedulerTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const lastRampedBarRef = useRef(-1);

  const analyzerRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timeDomainRef = useRef(new Float32Array(2048));

  const tuningOptions = useMemo(() => {
    if (instrumentMode === "guitar") return GUITAR_TUNINGS;
    if (!showExtendedBass) return bassTuningsForStringCount(4);
    return BASS_TUNINGS.filter((preset) => preset.strings.length === bassStringCount);
  }, [instrumentMode, bassStringCount, showExtendedBass]);

  const activeTuning = useMemo(
    () => tuningOptions.find((preset) => preset.id === tuningId) || tuningOptions[0],
    [tuningId, tuningOptions],
  );

  const closestMatch = useMemo(() => {
    if (!detectedPitch) return null;
    return findClosestString(detectedPitch.frequency, activeTuning.strings);
  }, [activeTuning.strings, detectedPitch]);

  const gaugePosition = useMemo(() => {
    if (!closestMatch) return 50;
    const clamped = Math.max(-50, Math.min(50, closestMatch.cents));
    return 50 + clamped;
  }, [closestMatch]);

  useEffect(() => {
    if (instrumentMode === "guitar") {
      setTuningId(GUITAR_TUNINGS[0].id);
      setPluckVoice("guitar-steel");
      return;
    }
    setBassStringCount(4);
    setShowExtendedBass(false);
    setTuningId(bassTuningsForStringCount(4)[0].id);
    setPluckVoice("bass");
  }, [instrumentMode]);

  useEffect(() => {
    if (instrumentMode !== "bass") return;
    if (!tuningOptions.some((preset) => preset.id === tuningId)) {
      setTuningId(tuningOptions[0]?.id ?? bassTuningsForStringCount(4)[0].id);
    }
  }, [instrumentMode, tuningId, tuningOptions]);

  const playClick = useCallback((isAccent: boolean, volume = 1, time?: number, isSub = false) => {
    const ctx = getAudioContext();
    playMetronomeSound(ctx, soundType, isAccent, clickVolume * volume, time, isSub);
    if (isAccent) {
      setAccentFlash(true);
      window.setTimeout(() => setAccentFlash(false), 80);
    }
  }, [clickVolume, getAudioContext, soundType]);

  const scheduleMetronome = useCallback(() => {
    const ctx = getAudioContext();
    const beatsPerBar = getBeatsPerBar(timeSignature);
    const baseInterval = 60 / bpm;
    const stepInterval = baseInterval / subdivision;
    const scheduleAhead = 0.12;

    while (nextStepTimeRef.current < ctx.currentTime + scheduleAhead) {
      const countInSteps = countInBars * beatsPerBar * subdivision;
      const step = stepRef.current;
      const inCountIn = step < countInSteps;

      if (inCountIn) {
        const countBeat = Math.floor(step / subdivision) % beatsPerBar;
        if (step % subdivision === 0) {
          playClick(countBeat === 0, 0.6, nextStepTimeRef.current, false);
        }
      } else {
        const activeStep = step - countInSteps;
        const totalStepsInBar = beatsPerBar * subdivision;
        const currentBar = Math.floor(activeStep / totalStepsInBar);
        const beatInBar = Math.floor((activeStep % totalStepsInBar) / subdivision);
        const isSubdivisionStep = activeStep % subdivision !== 0;

        // Gap / Mute practice logic
        let shouldSound = true;
        if (gapTraining) {
          const cycle = currentBar % (gapPlayBars + gapMuteBars);
          if (cycle >= gapPlayBars) shouldSound = false;
        }

        // Speed Trainer logic (auto-ramp BPM)
        if (speedTrainer && currentBar > lastRampedBarRef.current && currentBar > 0 && currentBar % trainerEveryBars === 0) {
          lastRampedBarRef.current = currentBar;
          setBpm((prev) => Math.min(trainerTargetBpm, prev + trainerInc));
        }

        const isAccent = isAccentBeat(beatInBar, timeSignature);

        if (subdivision === 1) {
          if (shouldSound) playClick(isAccent, 1, nextStepTimeRef.current, false);
          setBeatCount(beatInBar);
        } else if (isSubdivisionStep) {
          if (shouldSound) playClick(false, 0.35, nextStepTimeRef.current, true);
        } else {
          if (shouldSound) playClick(isAccent, 1, nextStepTimeRef.current, false);
          setBeatCount(beatInBar);
        }
      }

      stepRef.current += 1;
      nextStepTimeRef.current += stepInterval;
    }
  }, [
    bpm,
    countInBars,
    gapMuteBars,
    gapPlayBars,
    gapTraining,
    playClick,
    speedTrainer,
    subdivision,
    timeSignature,
    trainerEveryBars,
    trainerInc,
    trainerTargetBpm,
    getAudioContext,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      if (schedulerTimerRef.current) {
        window.clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      stepRef.current = 0;
      lastRampedBarRef.current = -1;
      setBeatCount(0);
      return;
    }

    const ctx = getAudioContext();
    stepRef.current = 0;
    lastRampedBarRef.current = -1;
    nextStepTimeRef.current = ctx.currentTime + 0.05;
    schedulerTimerRef.current = window.setInterval(scheduleMetronome, 25);

    return () => {
      if (schedulerTimerRef.current) {
        window.clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
    };
  }, [isPlaying, scheduleMetronome, getAudioContext]);

  function handleTapTempo() {
    const now = performance.now();
    setTapTimes((current) => {
      const recent = [...current, now].filter((time) => now - time < 2500);
      if (recent.length >= 2) {
        const intervals = recent.slice(1).map((time, index) => time - recent[index]);
        const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        const nextBpm = Math.round(60000 / average);
        setBpm(Math.max(40, Math.min(240, nextBpm)));
      }
      return recent;
    });
  }

  const tappedBpm = useMemo(() => {
    if (tapTimes.length < 2) return null;
    const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    return Math.round(60000 / average);
  }, [tapTimes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      setIsPlaying((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      listeningRef.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      analyzerRef.current = null;
      setDetectedPitch(null);
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 2048;
      source.connect(analyzer);
      analyzerRef.current = analyzer;
      streamRef.current = stream;
      listeningRef.current = true;
      setIsListening(true);
      draw();
    } catch {
      // Mic denied
    }
  };

  const draw = () => {
    if (!analyzerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyzer = analyzerRef.current;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const audioContext = getAudioContext();

    const renderFrame = () => {
      if (!listeningRef.current || !analyzerRef.current) return;
      requestRef.current = requestAnimationFrame(renderFrame);
      analyzer.getByteFrequencyData(dataArray);
      analyzer.getFloatTimeDomainData(timeDomainRef.current);
      setDetectedPitch(detectPitchAutocorrelation(timeDomainRef.current, audioContext.sampleRate));

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i += 1) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(59, 130, 246, ${dataArray[i] / 255})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    renderFrame();
  };

  useEffect(() => () => {
    listeningRef.current = false;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function playStringReference(tuningString: TuningString) {
    const ctx = getAudioContext();
    playReferencePluck(ctx, tuningString.frequency, pluckVoice);
    setActiveStringLabel(tuningString.label);
    window.setTimeout(() => setActiveStringLabel(null), 900);
  }

  function renderStringRow(tuningString: TuningString) {
    const isActiveRef = activeStringLabel === tuningString.label;
    const isDetected = closestMatch?.string.label === tuningString.label;
    const cents = isDetected && detectedPitch
      ? centsFromTarget(detectedPitch.frequency, tuningString.frequency * 2 ** (closestMatch.octaveShift || 0))
      : null;
    const status = cents !== null ? tuningStatus(cents) : null;

    return (
      <button
        key={tuningString.label}
        type="button"
        onClick={() => playStringReference(tuningString)}
        className={`rounded-[1rem] border px-3 py-3 text-left transition ${
          isDetected
            ? "border-[var(--color-copper)] bg-[var(--color-info-surface)]"
            : isActiveRef
              ? "border-[var(--color-mint)] bg-[var(--color-success-surface)]"
              : "song-list-item border-[var(--color-stroke)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Volume2 className={`h-3.5 w-3.5 ${isActiveRef ? "animate-pulse text-[var(--color-mint)]" : "text-[var(--color-sand-2)]"}`} />
            <span className="text-sm font-black">{tuningString.label}</span>
          </div>
          <span className="font-mono text-xs text-[var(--color-brass)]">{tuningString.note}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
          <span>{tuningString.frequency.toFixed(1)} Hz</span>
          {status && cents !== null ? (
            <span className={status.tone}>{status.label} {cents > 0 ? "+" : ""}{cents}¢</span>
          ) : (
            <span>Tap to hear</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="grid animate-fade-up gap-6 xl:grid-cols-2">
      {/* 1. Pro Metronome (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title="Pro Metronome & Tap Tempo"
        subtitle={`${bpm} BPM · ${timeSignature} · ${
          subdivision === 1
            ? "Quarter"
            : subdivision === 2
            ? "Eighths"
            : subdivision === 3
            ? "Triplets"
            : subdivision === 4
            ? "Sixteenths"
            : "Sextuplets"
        } · ${soundType.toUpperCase()}`}
        eyebrow="Timing Precision"
        icon={<Activity className="h-5 w-5 text-[var(--color-mint)]" />}
        badge={
          <div
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              isPlaying
                ? accentFlash
                  ? "scale-150 bg-white shadow-[0_0_15px_white]"
                  : "bg-[var(--color-mint)] shadow-[0_0_10px_var(--color-mint)]"
                : "bg-zinc-700"
            }`}
          />
        }
        headerActions={
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`glass-pill px-3.5 py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
              isPlaying ? "bg-red-500 text-white shadow-lg shadow-red-500/30" : "bg-[var(--color-mint)] text-black shadow-lg shadow-emerald-500/20"
            }`}
          >
            {isPlaying ? "Stop" : "Start"}
          </button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Big BPM Display & Controls */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setBpm((b) => Math.max(40, b - 5))}
                className="glass-pill flex h-9 w-9 items-center justify-center text-sm font-black text-[var(--color-sand-2)] hover:text-white"
                title="-5 BPM"
              >
                -5
              </button>
              <button
                type="button"
                onClick={() => setBpm((b) => Math.max(40, b - 1))}
                className="glass-pill flex h-9 w-9 items-center justify-center text-base font-black text-[var(--color-sand-2)] hover:text-white"
                title="-1 BPM"
              >
                -1
              </button>
              <div className="flex items-baseline gap-2 text-6xl font-black tabular-nums tracking-tighter text-[var(--color-foreground)]">
                {bpm}
                <span className="text-sm font-bold text-[var(--color-sand-2)]">BPM</span>
              </div>
              <button
                type="button"
                onClick={() => setBpm((b) => Math.min(260, b + 1))}
                className="glass-pill flex h-9 w-9 items-center justify-center text-base font-black text-[var(--color-sand-2)] hover:text-white"
                title="+1 BPM"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => setBpm((b) => Math.min(260, b + 5))}
                className="glass-pill flex h-9 w-9 items-center justify-center text-sm font-black text-[var(--color-sand-2)] hover:text-white"
                title="+5 BPM"
              >
                +5
              </button>
            </div>

            {/* Sound Timbre Selector */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/8 bg-black/30 p-1">
              {(["digital", "woodblock", "cowbell", "mechanical", "rimshot"] as const).map((sound) => (
                <button
                  key={sound}
                  type="button"
                  onClick={() => setSoundType(sound)}
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                    soundType === sound
                      ? "bg-[var(--color-mint)] text-black shadow-sm"
                      : "text-[var(--color-sand-2)] hover:text-white"
                  }`}
                >
                  {sound}
                </button>
              ))}
            </div>

            {/* Meter, Subdivision & Count-in */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <label className="field-group">
                <span className="field-label">Signature</span>
                <select
                  value={timeSignature}
                  onChange={(event) => setTimeSignature(event.target.value as (typeof TIME_SIGNATURES)[number])}
                  className="field py-1.5 text-xs font-bold"
                >
                  {TIME_SIGNATURES.map((sig) => (
                    <option key={sig} value={sig}>
                      {sig}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="field-label">Subdivision</span>
                <select
                  value={subdivision}
                  onChange={(event) => setSubdivision(Number(event.target.value) as 1 | 2 | 3 | 4 | 6)}
                  className="field py-1.5 text-xs font-bold"
                >
                  <option value={1}>Quarter (1x)</option>
                  <option value={2}>Eighths (2x)</option>
                  <option value={3}>Triplets (3x)</option>
                  <option value={4}>Sixteenths (4x)</option>
                  <option value={6}>Sextuplets (6x)</option>
                </select>
              </label>
              <label className="field-group">
                <span className="field-label">Count-in</span>
                <select
                  value={countInBars}
                  onChange={(event) => setCountInBars(Number(event.target.value))}
                  className="field py-1.5 text-xs font-bold"
                >
                  <option value={0}>Off</option>
                  <option value={1}>1 bar</option>
                  <option value={2}>2 bars</option>
                </select>
              </label>
            </div>

            {/* Beat Indicator Matrix */}
            <div className="flex flex-wrap items-center justify-center gap-2 py-1">
              {Array.from({ length: getBeatsPerBar(timeSignature) }, (_, i) => {
                const isCurrent = isPlaying && beatCount === i;
                const isAccent = isAccentBeat(i, timeSignature);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      isCurrent
                        ? isAccent
                          ? "scale-125"
                          : "scale-110"
                        : "opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Beat ${i + 1}`}
                  >
                    <div
                      className={`h-3 rounded-full transition-all ${
                        isCurrent
                          ? isAccent
                            ? "w-8 bg-white shadow-[0_0_14px_white]"
                            : "w-6 bg-[var(--color-mint)] shadow-[0_0_10px_var(--color-mint)]"
                          : isAccent
                          ? "w-3 bg-[var(--color-brass)]/60"
                          : "w-2.5 bg-zinc-700"
                      }`}
                    />
                    <span className="text-[9px] font-mono font-black text-[var(--color-sand-2)]">
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tempo Slider & Volume */}
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <label className="field-group">
                <span className="field-label">Tempo Slider ({bpm} BPM)</span>
                <input
                  type="range"
                  min="40"
                  max="240"
                  value={bpm}
                  onChange={(event) => setBpm(parseInt(event.target.value, 10))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[var(--color-mint)]"
                />
              </label>
              <label className="field-group">
                <span className="field-label">Click volume ({Math.round(clickVolume * 100)}%)</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={clickVolume}
                  onChange={(event) => setClickVolume(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[var(--color-mint)]"
                />
              </label>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {[40, 60, 80, 100, 120, 140, 160, 180, 200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBpm(preset)}
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${
                    bpm === preset
                      ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-black"
                      : "border-white/10 opacity-50 hover:opacity-100"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Speed Trainer & Gap Practice Expandable Tools */}
            <div className="grid w-full gap-3 rounded-[1.25rem] border border-white/8 bg-black/20 p-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <FastForward className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                    <span>Speed Trainer (Auto-Ramp)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={speedTrainer}
                    onChange={(e) => setSpeedTrainer(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--color-mint)]"
                  />
                </div>
                {speedTrainer ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                    <span className="text-[var(--color-sand-2)]">+</span>
                    <select
                      value={trainerInc}
                      onChange={(e) => setTrainerInc(Number(e.target.value))}
                      className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                    >
                      <option value={1}>1 BPM</option>
                      <option value={2}>2 BPM</option>
                      <option value={5}>5 BPM</option>
                    </select>
                    <span className="text-[var(--color-sand-2)]">every</span>
                    <select
                      value={trainerEveryBars}
                      onChange={(e) => setTrainerEveryBars(Number(e.target.value))}
                      className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                    >
                      <option value={1}>1 bar</option>
                      <option value={2}>2 bars</option>
                      <option value={4}>4 bars</option>
                      <option value={8}>8 bars</option>
                    </select>
                    <span className="text-[var(--color-sand-2)]">up to</span>
                    <input
                      type="number"
                      value={trainerTargetBpm}
                      onChange={(e) => setTrainerTargetBpm(Number(e.target.value) || 200)}
                      className="w-12 rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 text-center font-bold"
                      min={bpm}
                      max={260}
                    />
                    <span className="text-[var(--color-sand-2)]">BPM</span>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--color-sand-2)]">
                    Gradually accelerates tempo automatically across bars.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black">
                    <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                    <span>Gap / Mute Training</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={gapTraining}
                    onChange={(e) => setGapTraining(e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--color-mint)]"
                  />
                </div>
                {gapTraining ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px]">
                    <span className="text-[var(--color-sand-2)]">Play</span>
                    <select
                      value={gapPlayBars}
                      onChange={(e) => setGapPlayBars(Number(e.target.value))}
                      className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                    >
                      <option value={1}>1 bar</option>
                      <option value={2}>2 bars</option>
                      <option value={3}>3 bars</option>
                      <option value={4}>4 bars</option>
                    </select>
                    <span className="text-[var(--color-sand-2)]">Mute</span>
                    <select
                      value={gapMuteBars}
                      onChange={(e) => setGapMuteBars(Number(e.target.value))}
                      className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                    >
                      <option value={1}>1 bar</option>
                      <option value={2}>2 bars</option>
                    </select>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--color-sand-2)]">
                    Mutes click for practice bars to test your internal tempo.
                  </p>
                )}
              </div>
            </div>

            {/* Tap Tempo & Big Play Button */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTapTempo}
                className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-mint)]"
              >
                Tap tempo {tappedBpm ? `· ${tappedBpm} BPM` : ""}
              </button>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                  isPlaying
                    ? "border border-red-500/30 bg-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.25)]"
                    : "bg-[var(--color-mint)] text-black shadow-lg shadow-emerald-500/20 hover:scale-105"
                }`}
              >
                {isPlaying ? <Square className="h-6 w-6 fill-current" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
              </button>
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* 2. Intelligent Tuner (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title="Intelligent Tuner & Pluck Reference"
        subtitle={`${instrumentMode.toUpperCase()} · ${activeTuning.name} (${activeTuning.strings.length} strings)`}
        eyebrow="Pitch Precision"
        icon={<Hand className="h-5 w-5 text-[var(--color-copper)]" />}
        headerActions={
          <button
            type="button"
            onClick={() => void toggleListening()}
            className={`glass-pill flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
              isListening ? "bg-red-500 text-white" : ""
            }`}
          >
            {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {isListening ? "Stop Mic" : "Start Mic"}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(["guitar", "bass"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setInstrumentMode(mode)}
                  className={`tab-editor-pill inline-flex items-center gap-2 capitalize ${instrumentMode === mode ? "tab-editor-pill-active" : ""}`}
                >
                  <Guitar className="h-3.5 w-3.5" />
                  {mode}
                </button>
              ))}
            </div>

            {instrumentMode === "bass" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">Strings:</span>
                <button
                  type="button"
                  onClick={() => { setShowExtendedBass(false); setBassStringCount(4); }}
                  className={`tab-editor-pill py-1 text-[10px] ${!showExtendedBass ? "tab-editor-pill-active" : ""}`}
                >
                  4-str
                </button>
                <button
                  type="button"
                  onClick={() => { setShowExtendedBass(true); setBassStringCount(5); }}
                  className={`tab-editor-pill py-1 text-[10px] ${showExtendedBass && bassStringCount === 5 ? "tab-editor-pill-active" : ""}`}
                >
                  5-str
                </button>
                <button
                  type="button"
                  onClick={() => { setShowExtendedBass(true); setBassStringCount(6); }}
                  className={`tab-editor-pill py-1 text-[10px] ${showExtendedBass && bassStringCount === 6 ? "tab-editor-pill-active" : ""}`}
                >
                  6-str
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field-group">
              <span className="field-label">Tuning preset</span>
              <select value={tuningId} onChange={(event) => setTuningId(event.target.value)} className="field py-1.5 text-xs font-bold">
                {tuningOptions.map((preset: TuningPreset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </label>
            <label className="field-group">
              <span className="field-label">Reference sound</span>
              <select
                value={pluckVoice}
                onChange={(event) => setPluckVoice(event.target.value as PluckInstrument)}
                className="field py-1.5 text-xs font-bold"
              >
                {instrumentMode === "guitar" ? (
                  <>
                    <option value="guitar-steel">Steel string pluck</option>
                    <option value="guitar-nylon">Nylon string pluck</option>
                  </>
                ) : (
                  <>
                    <option value="bass">Fingered bass</option>
                    <option value="bass-pick">Pick bass</option>
                  </>
                )}
              </select>
            </label>
          </div>

          <div className="relative h-20 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black/35">
            <canvas ref={canvasRef} className="h-full w-full" width={400} height={80} />
            {!isListening ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Microphone Inactive</span>
              </div>
            ) : null}
          </div>

          {detectedPitch ? (
            <div className="modal-inset-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-4xl font-black tracking-tight text-[var(--color-copper)]">{detectedPitch.note}</div>
                  <div className="mt-1 text-xs font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                    {detectedPitch.frequency.toFixed(1)} Hz
                  </div>
                </div>
                {closestMatch ? (
                  <div className="text-right">
                    <div className="text-sm font-black">String {closestMatch.string.label}</div>
                    <div className={`text-xs font-bold uppercase ${tuningStatus(closestMatch.cents).tone}`}>
                      {tuningStatus(closestMatch.cents).label} · {closestMatch.cents > 0 ? "+" : ""}{closestMatch.cents} cents
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="tuner-gauge-track mt-4">
                <div className="tuner-gauge-needle" style={{ left: `${gaugePosition}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                <span>Flat</span>
                <span>In tune</span>
                <span>Sharp</span>
              </div>
            </div>
          ) : isListening ? (
            <div className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Listening for string pitch...
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
              {activeTuning.name} · {activeTuning.strings.length} strings (tap to hear reference)
            </div>
            <div className={`grid gap-2 ${instrumentMode === "bass" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
              {activeTuning.strings.map((tuningString) => renderStringRow(tuningString))}
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}
