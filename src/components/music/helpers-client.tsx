"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Guitar, Hand, Mic, MicOff, Play, Square, Volume2 } from "lucide-react";

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

const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "6/8"] as const;

type InstrumentMode = "guitar" | "bass";
type BassStringCount = 4 | 5 | 6;

function tuningStatus(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return { label: "In tune", tone: "text-[var(--color-mint)]", bg: "bg-[var(--color-success-surface)]" };
  if (abs <= 15) return { label: "Close", tone: "text-yellow-400", bg: "bg-yellow-500/10" };
  return { label: cents > 0 ? "Sharp" : "Flat", tone: "text-red-400", bg: "bg-red-500/10" };
}

function getBeatsPerBar(sig: (typeof TIME_SIGNATURES)[number]) {
  if (sig === "6/8") return 6;
  return Number(sig.split("/")[0]);
}

export function HelpersClient() {
  const { getAudioContext } = useAudio();
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = useState<(typeof TIME_SIGNATURES)[number]>("4/4");
  const [subdivision, setSubdivision] = useState<1 | 2 | 4>(1);
  const [beatCount, setBeatCount] = useState(0);
  const [clickVolume, setClickVolume] = useState(0.7);
  const [countInBars, setCountInBars] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [accentFlash, setAccentFlash] = useState(false);

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

  const playClick = useCallback((isAccent: boolean, volume = 1) => {
    const ctx = getAudioContext();
    const when = ctx.currentTime;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isAccent ? 1800 : 1300, when);
    envelope.gain.setValueAtTime(0.55 * clickVolume * volume, when);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    osc.connect(envelope);
    envelope.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + 0.07);
    if (isAccent) {
      setAccentFlash(true);
      window.setTimeout(() => setAccentFlash(false), 80);
    }
  }, [clickVolume, getAudioContext]);

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
        playClick(countBeat === 0, 0.55);
      } else {
        const activeStep = step - countInSteps;
        const beatInBar = Math.floor(activeStep / subdivision) % beatsPerBar;
        const isSubdivisionStep = activeStep % subdivision !== 0;
        if (subdivision === 1) {
          playClick(beatInBar === 0, 1);
          setBeatCount(beatInBar);
        } else if (isSubdivisionStep) {
          playClick(false, 0.35);
        } else {
          playClick(beatInBar === 0, 1);
          setBeatCount(beatInBar);
        }
      }

      stepRef.current += 1;
      nextStepTimeRef.current += stepInterval;
    }
  }, [bpm, countInBars, playClick, subdivision, timeSignature, getAudioContext]);

  useEffect(() => {
    if (!isPlaying) {
      if (schedulerTimerRef.current) {
        window.clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
    stepRef.current = 0;
    setBeatCount(0);
      return;
    }

    const ctx = getAudioContext();
    stepRef.current = 0;
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
    <div className="grid animate-fade-up gap-4 xl:grid-cols-2">
      <div className={`panel glass-shine space-y-6 rounded-[1.75rem] p-5 transition ${accentFlash ? "ring-2 ring-[var(--color-mint)]/40" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-mint)]">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div className="eyebrow">Timing</div>
              <h3 className="text-lg font-black uppercase tracking-tight">Pro Metronome</h3>
            </div>
          </div>
          <div className={`h-2.5 w-2.5 rounded-full ${isPlaying ? "bg-[var(--color-mint)] shadow-[0_0_10px_var(--color-mint)]" : "bg-zinc-700"}`} />
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-baseline gap-2 text-6xl font-black tabular-nums tracking-tighter">
            {bpm}
            <span className="text-sm font-bold text-[var(--color-sand-2)]">BPM</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <label className="field-group">
              <span className="field-label">Signature</span>
              <select value={timeSignature} onChange={(event) => setTimeSignature(event.target.value as (typeof TIME_SIGNATURES)[number])} className="field py-2">
                {TIME_SIGNATURES.map((sig) => <option key={sig} value={sig}>{sig}</option>)}
              </select>
            </label>
            <label className="field-group">
              <span className="field-label">Subdivision</span>
              <select value={subdivision} onChange={(event) => setSubdivision(Number(event.target.value) as 1 | 2 | 4)} className="field py-2">
                <option value={1}>Quarter</option>
                <option value={2}>Eighths</option>
                <option value={4}>Sixteenths</option>
              </select>
            </label>
            <label className="field-group">
              <span className="field-label">Count-in</span>
              <select value={countInBars} onChange={(event) => setCountInBars(Number(event.target.value))} className="field py-2">
                <option value={0}>Off</option>
                <option value={1}>1 bar</option>
                <option value={2}>2 bars</option>
              </select>
            </label>
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: getBeatsPerBar(timeSignature) }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`h-2.5 rounded-full transition-all ${isPlaying && beatCount === i ? "w-6 bg-[var(--color-mint)]" : "w-2.5 bg-zinc-700"}`}
                aria-label={`Beat ${i + 1}`}
              />
            ))}
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2">
            <label className="field-group">
              <span className="field-label">Tempo</span>
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
              <span className="field-label">Click volume</span>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={clickVolume}
                onChange={(event) => setClickVolume(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-[var(--color-mint)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleTapTempo}
              className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest"
            >
              Tap tempo {tapTimes.length >= 2 ? "✓" : ""}
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                isPlaying
                  ? "border border-red-500/30 bg-red-500/10 text-red-500"
                  : "bg-[var(--color-mint)] text-black shadow-lg hover:scale-105"
              }`}
            >
              {isPlaying ? <Square className="h-8 w-8 fill-current" /> : <Play className="ml-1 h-8 w-8 fill-current" />}
            </button>
          </div>
        </div>
      </div>

      <div className="panel glass-shine space-y-4 rounded-[1.75rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-copper)]">
              <Hand className="h-4 w-4" />
            </div>
            <div>
              <div className="eyebrow">Pitch lab</div>
              <h3 className="text-lg font-black uppercase tracking-tight">Intelligent Tuner</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void toggleListening()}
            className={`glass-pill flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
              isListening ? "bg-red-500 text-white" : ""
            }`}
          >
            {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {isListening ? "Stop mic" : "Start mic"}
          </button>
        </div>

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">Strings</span>
            <button
              type="button"
              onClick={() => { setShowExtendedBass(false); setBassStringCount(4); }}
              className={`tab-editor-pill ${!showExtendedBass ? "tab-editor-pill-active" : ""}`}
            >
              4-string
            </button>
            <button
              type="button"
              onClick={() => { setShowExtendedBass(true); setBassStringCount(5); }}
              className={`tab-editor-pill ${showExtendedBass && bassStringCount === 5 ? "tab-editor-pill-active" : ""}`}
            >
              5-string
            </button>
            <button
              type="button"
              onClick={() => { setShowExtendedBass(true); setBassStringCount(6); }}
              className={`tab-editor-pill ${showExtendedBass && bassStringCount === 6 ? "tab-editor-pill-active" : ""}`}
            >
              6-string
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-group">
            <span className="field-label">Tuning preset</span>
            <select value={tuningId} onChange={(event) => setTuningId(event.target.value)} className="field py-2 text-sm">
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
              className="field py-2 text-sm"
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

        <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black/35">
          <canvas ref={canvasRef} className="h-full w-full" width={400} height={100} />
          {!isListening ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Visualizer inactive</span>
            </div>
          ) : null}
        </div>

        {detectedPitch ? (
          <div className="modal-inset-panel rounded-2xl px-4 py-4">
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
            Listening for pitch...
          </div>
        ) : null}

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
            {activeTuning.name} · {activeTuning.strings.length} strings · tap for reference tone
          </div>
          <div className={`grid gap-2 ${instrumentMode === "bass" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {activeTuning.strings.map((tuningString) => renderStringRow(tuningString))}
          </div>
        </div>
      </div>
    </div>
  );
}
