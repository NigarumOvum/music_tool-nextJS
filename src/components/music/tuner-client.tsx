"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Guitar, Mic, MicOff, Volume2 } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { useI18n } from "@/components/language-provider";
import { SoundIndicator } from "@/components/ui/sound-indicator";
import { useAudio } from "@/components/music/audio-provider";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
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

type InstrumentMode = "guitar" | "bass";
type BassStringCount = 4 | 5 | 6;

function tuningStatus(cents: number, t: (key: "tuner.inTune" | "tuner.close" | "tuner.sharp" | "tuner.flat") => string) {
  const abs = Math.abs(cents);
  if (abs <= 5) return { label: t("tuner.inTune"), tone: "text-[var(--color-mint)]" };
  if (abs <= 15) return { label: t("tuner.close"), tone: "text-yellow-400" };
  return { label: cents > 0 ? t("tuner.sharp") : t("tuner.flat"), tone: "text-red-400" };
}

export function TunerCard() {
  const { getAudioContext } = useAudio();
  const { t } = useI18n();
  const userId = useCurrentUserId();

  const [instrumentMode, setInstrumentMode] = usePersistentState<InstrumentMode>("helpers_instrument", "guitar", { userId });
  const [bassStringCount, setBassStringCount] = usePersistentState<BassStringCount>("helpers_bass_strings", 4, { userId });
  const [showExtendedBass, setShowExtendedBass] = usePersistentState("helpers_extended_bass", false, { userId });
  const [tuningId, setTuningId] = usePersistentState("helpers_tuning", GUITAR_TUNINGS[0].id, { userId });
  const [pluckVoice, setPluckVoice] = usePersistentState<PluckInstrument>("helpers_pluck", "guitar-steel", { userId });
  const [activeStringLabel, setActiveStringLabel] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<PitchDetection | null>(null);

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
  }, [instrumentMode, setBassStringCount, setPluckVoice, setShowExtendedBass, setTuningId]);

  useEffect(() => {
    if (instrumentMode !== "bass") return;
    if (!tuningOptions.some((preset) => preset.id === tuningId)) {
      setTuningId(tuningOptions[0]?.id ?? bassTuningsForStringCount(4)[0].id);
    }
  }, [instrumentMode, tuningId, tuningOptions, setTuningId]);

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
    const status = cents !== null ? tuningStatus(cents, t) : null;

    return (
      <button
        key={tuningString.label}
        type="button"
        onClick={() => playStringReference(tuningString)}
        title={`Play ${tuningString.note} reference`}
        className={`btn-sound rounded-[1rem] border px-3 py-3 text-left transition ${
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
            <SoundIndicator className="h-3 w-3" />
          </div>
          <span className="font-mono text-xs text-[var(--color-brass)]">{tuningString.note}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
          <span>{tuningString.frequency.toFixed(1)} Hz</span>
          {status && cents !== null ? (
            <span className={status.tone}>{status.label} {cents > 0 ? "+" : ""}{cents}¢</span>
          ) : (
            <span>{t("tuner.tapToHear")}</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <CollapsibleCard
      defaultOpen={true}
      title={t("tuner.title")}
      subtitle={`${instrumentMode.toUpperCase()} · ${activeTuning.name} (${activeTuning.strings.length} strings)`}
      eyebrow="Pitch Precision"
      icon={<Gauge className="h-5 w-5 text-[var(--color-copper)]" />}
      headerActions={
        <button
          type="button"
          onClick={() => void toggleListening()}
          className={`glass-pill flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
            isListening ? "bg-red-500 text-white" : ""
          }`}
        >
          {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {isListening ? t("tuner.stopMic") : t("tuner.startMic")}
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
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">{t("tuner.strings")}</span>
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
            <span className="field-label">{t("tuner.tuningPreset")}</span>
            <select value={tuningId} onChange={(event) => setTuningId(event.target.value)} className="field py-1.5 text-xs font-bold">
              {tuningOptions.map((preset: TuningPreset) => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">{t("tuner.refSound")}</span>
            <select
              value={pluckVoice}
              onChange={(event) => setPluckVoice(event.target.value as PluckInstrument)}
              className="field py-1.5 text-xs font-bold"
            >
              {instrumentMode === "guitar" ? (
                <>
                  <option value="guitar-steel">{t("tuner.steel")}</option>
                  <option value="guitar-nylon">{t("tuner.nylon")}</option>
                </>
              ) : (
                <>
                  <option value="bass">{t("tuner.fingered")}</option>
                  <option value="bass-pick">{t("tuner.pick")}</option>
                </>
              )}
            </select>
          </label>
        </div>

        <div className="relative h-20 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black/35">
          <canvas ref={canvasRef} className="h-full w-full" width={400} height={80} />
          {!isListening ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t("tuner.micInactive")}</span>
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
                  <div className="text-sm font-black">{t("tuner.string")} {closestMatch.string.label}</div>
                  <div className={`text-xs font-bold uppercase ${tuningStatus(closestMatch.cents, t).tone}`}>
                    {tuningStatus(closestMatch.cents, t).label} · {closestMatch.cents > 0 ? "+" : ""}{closestMatch.cents} cents
                  </div>
                </div>
              ) : null}
            </div>
            <div className="tuner-gauge-track mt-4">
              <div className="tuner-gauge-needle" style={{ left: `${gaugePosition}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
              <span>{t("tuner.flat")}</span>
              <span>{t("tuner.gaugeMid")}</span>
              <span>{t("tuner.sharp")}</span>
            </div>
          </div>
        ) : isListening ? (
          <div className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {t("tuner.listening")}
          </div>
        ) : null}

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
            {t("tuner.tapToHearTitle").replace("{name}", activeTuning.name).replace("{strings}", String(activeTuning.strings.length))}
          </div>
          <div className={`grid gap-2 ${instrumentMode === "bass" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {activeTuning.strings.map((tuningString) => renderStringRow(tuningString))}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  );
}

export function TunerClient() {
  return (
    <SplitViewFullScreen className="animate-fade-up gap-6" showControls={false}>
      <TunerCard />
    </SplitViewFullScreen>
  );
}
