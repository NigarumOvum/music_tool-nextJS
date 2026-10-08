"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Guitar, Mic, MicOff, Music2, Volume2 } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { useI18n } from "@/components/language-provider";
import { SoundIndicator } from "@/components/ui/sound-indicator";
import { useAudio } from "@/components/music/audio-provider";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
import { detectPitchAutocorrelation, type PitchDetection } from "@/lib/music/pitch";
import { playReferencePluck, preloadPluck, type PluckInstrument } from "@/lib/music/instrument-synth";
import {
  guitarTuningsForStringCount,
  bassTuningsForStringCount,
  tuningsForInstrument,
  centsFromTarget,
  findClosestString,
  type GuitarStringCount,
  type BassStringCount,
  type TunerInstrumentId,
  type OtherInstrumentId,
  type TuningPreset,
  type TuningString,
} from "@/lib/music/tunings";

// ── Instrument catalog shown in the selector ─────────────────────────────
const GUITAR_STRING_OPTIONS: GuitarStringCount[] = [6, 7, 8, 12];
const BASS_STRING_OPTIONS: BassStringCount[] = [4, 5, 6, 7];

type InstrumentEntry = {
  id: TunerInstrumentId;
  label: string;
  defaultVoice: PluckInstrument;
};

const INSTRUMENT_LIST: InstrumentEntry[] = [
  { id: "guitar",   label: "Guitar",   defaultVoice: "guitar-steel" },
  { id: "bass",     label: "Bass",     defaultVoice: "bass" },
  { id: "ukulele",  label: "Ukulele",  defaultVoice: "guitar-nylon" },
  { id: "mandolin", label: "Mandolin", defaultVoice: "guitar-steel" },
  { id: "banjo",    label: "Banjo",    defaultVoice: "guitar-steel" },
  { id: "violin",   label: "Violin",   defaultVoice: "guitar-nylon" },
  { id: "viola",    label: "Viola",    defaultVoice: "guitar-nylon" },
  { id: "cello",    label: "Cello",    defaultVoice: "bass" },
];

const OTHER_INSTRUMENTS = new Set<OtherInstrumentId>([
  "ukulele", "mandolin", "banjo", "violin", "viola", "cello",
]);

function isOther(id: TunerInstrumentId): id is OtherInstrumentId {
  return OTHER_INSTRUMENTS.has(id as OtherInstrumentId);
}

// ── Tuning status helper ─────────────────────────────────────────────────
function tuningStatus(
  cents: number,
  t: (key: "tuner.inTune" | "tuner.close" | "tuner.sharp" | "tuner.flat") => string,
) {
  const abs = Math.abs(cents);
  if (abs <= 5)  return { label: t("tuner.inTune"), tone: "text-[var(--color-mint)]" };
  if (abs <= 15) return { label: t("tuner.close"),  tone: "text-yellow-400" };
  return { label: cents > 0 ? t("tuner.sharp") : t("tuner.flat"), tone: "text-red-400" };
}

// ── Component ────────────────────────────────────────────────────────────
export function TunerCard() {
  const { getAudioContext } = useAudio();
  const { t } = useI18n();
  const userId = useCurrentUserId();

  // Persistent
  const [instrument, setInstrument] = usePersistentState<TunerInstrumentId>(
    "helpers_instrument2", "guitar", { userId },
  );
  const [guitarStringCount, setGuitarStringCount] = usePersistentState<GuitarStringCount>(
    "helpers_guitar_strings", 6, { userId },
  );
  const [bassStringCount, setBassStringCount] = usePersistentState<BassStringCount>(
    "helpers_bass_strings", 4, { userId },
  );
  const [tuningId, setTuningId] = usePersistentState(
    "helpers_tuning2", "guitar-standard", { userId },
  );
  const [pluckVoice, setPluckVoice] = usePersistentState<PluckInstrument>(
    "helpers_pluck", "guitar-steel", { userId },
  );

  // Ephemeral
  const [activeStringLabel, setActiveStringLabel] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [detectedPitch, setDetectedPitch] = useState<PitchDetection | null>(null);

  // Refs
  const analyzerRef    = useRef<AnalyserNode | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const requestRef     = useRef<number | null>(null);
  const listeningRef   = useRef(false);
  const streamRef      = useRef<MediaStream | null>(null);
  const timeDomainRef  = useRef(new Float32Array(2048));

  // ── Tuning options filtered by instrument + string count ─────────────
  const tuningOptions = useMemo<TuningPreset[]>(() => {
    if (instrument === "guitar") return guitarTuningsForStringCount(guitarStringCount);
    if (instrument === "bass")   return bassTuningsForStringCount(bassStringCount);
    return tuningsForInstrument(instrument);
  }, [instrument, guitarStringCount, bassStringCount]);

  const activeTuning = useMemo(
    () => tuningOptions.find((p) => p.id === tuningId) ?? tuningOptions[0],
    [tuningId, tuningOptions],
  );

  // Snap tuning when options change
  useEffect(() => {
    if (!tuningOptions.some((p) => p.id === tuningId)) {
      setTuningId(tuningOptions[0]?.id ?? "guitar-standard");
    }
  }, [tuningOptions, tuningId, setTuningId]);

  // Reset voice + string counts on instrument change
  useEffect(() => {
    const entry = INSTRUMENT_LIST.find((e) => e.id === instrument);
    if (entry) setPluckVoice(entry.defaultVoice);
    if (instrument === "guitar") setGuitarStringCount(6);
    if (instrument === "bass")   setBassStringCount(4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  const closestMatch = useMemo(() => {
    if (!detectedPitch) return null;
    return findClosestString(detectedPitch.frequency, activeTuning.strings);
  }, [activeTuning.strings, detectedPitch]);

  const gaugePosition = useMemo(() => {
    if (!closestMatch) return 50;
    return 50 + Math.max(-50, Math.min(50, closestMatch.cents));
  }, [closestMatch]);

  // ── Mic / pitch detection ────────────────────────────────────────────
  const toggleListening = async () => {
    if (isListening) {
      listeningRef.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
    } catch { /* mic denied */ }
  };

  const draw = () => {
    if (!analyzerRef.current || !canvasRef.current) return;
    const canvas  = canvasRef.current;
    const ctx2d   = canvas.getContext("2d");
    if (!ctx2d) return;
    const analyzer   = analyzerRef.current;
    const bufferLen  = analyzer.frequencyBinCount;
    const dataArr    = new Uint8Array(bufferLen);
    const audioCtx   = getAudioContext();

    const renderFrame = () => {
      if (!listeningRef.current || !analyzerRef.current) return;
      requestRef.current = requestAnimationFrame(renderFrame);
      analyzer.getByteFrequencyData(dataArr);
      analyzer.getFloatTimeDomainData(timeDomainRef.current);
      setDetectedPitch(detectPitchAutocorrelation(timeDomainRef.current, audioCtx.sampleRate));
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      const bw = (canvas.width / bufferLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLen; i += 1) {
        const bh = (dataArr[i] / 255) * canvas.height;
        ctx2d.fillStyle = `rgba(59,130,246,${dataArr[i] / 255})`;
        ctx2d.fillRect(x, canvas.height - bh, bw, bh);
        x += bw + 1;
      }
    };
    renderFrame();
  };

  useEffect(() => () => {
    listeningRef.current = false;
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    void preloadPluck(getAudioContext(), pluckVoice).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluckVoice]);

  // ── String row ───────────────────────────────────────────────────────
  function playStringReference(s: TuningString) {
    playReferencePluck(getAudioContext(), s.frequency, pluckVoice);
    setActiveStringLabel(s.label);
    window.setTimeout(() => setActiveStringLabel(null), 900);
  }

  function renderStringRow(s: TuningString) {
    const isActiveRef = activeStringLabel === s.label;
    const isDetected  = closestMatch?.string.label === s.label;
    const cents = isDetected && detectedPitch
      ? centsFromTarget(detectedPitch.frequency, s.frequency * 2 ** (closestMatch.octaveShift || 0))
      : null;
    const status = cents !== null ? tuningStatus(cents, t) : null;

    return (
      <button
        key={s.label}
        type="button"
        onClick={() => playStringReference(s)}
        title={`Play ${s.note} reference`}
        className={`btn-sound rounded-[1rem] border px-3 py-2.5 text-left transition ${
          isDetected   ? "border-[var(--color-copper)] bg-[var(--color-info-surface)]" :
          isActiveRef  ? "border-[var(--color-mint)] bg-[var(--color-success-surface)]" :
                        "song-list-item border-[var(--color-stroke)]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Volume2 className={`h-3.5 w-3.5 ${isActiveRef ? "animate-pulse text-[var(--color-mint)]" : "text-[var(--color-sand-2)]"}`} />
            <span className="text-sm font-black">{s.label}</span>
            <SoundIndicator className="h-3 w-3" />
          </div>
          <span className="font-mono text-xs text-[var(--color-brass)]">{s.note}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
          <span>{s.frequency.toFixed(1)} Hz</span>
          {status && cents !== null ? (
            <span className={status.tone}>{status.label} {cents > 0 ? "+" : ""}{cents}¢</span>
          ) : (
            <span>{t("tuner.tapToHear")}</span>
          )}
        </div>
      </button>
    );
  }

  // ── String count selector (guitar / bass only) ───────────────────────
  function renderStringCountSelector() {
    if (instrument === "guitar") {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">{t("tuner.strings")}</span>
          {GUITAR_STRING_OPTIONS.map((n) => (
            <button key={n} type="button"
              onClick={() => setGuitarStringCount(n)}
              className={`tab-editor-pill py-1 text-[10px] ${guitarStringCount === n ? "tab-editor-pill-active" : ""}`}
            >{n}-str</button>
          ))}
        </div>
      );
    }
    if (instrument === "bass") {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">{t("tuner.strings")}</span>
          {BASS_STRING_OPTIONS.map((n) => (
            <button key={n} type="button"
              onClick={() => setBassStringCount(n)}
              className={`tab-editor-pill py-1 text-[10px] ${bassStringCount === n ? "tab-editor-pill-active" : ""}`}
            >{n}-str</button>
          ))}
        </div>
      );
    }
    return null;
  }

  const stringGridCols =
    activeTuning.strings.length <= 4  ? "sm:grid-cols-2" :
    activeTuning.strings.length <= 8  ? "sm:grid-cols-2 lg:grid-cols-3" :
                                         "sm:grid-cols-3 lg:grid-cols-4";

  return (
    <CollapsibleCard
      defaultOpen={true}
      title={t("tuner.title")}
      subtitle={`${INSTRUMENT_LIST.find((e) => e.id === instrument)?.label ?? instrument} · ${activeTuning.strings.length}-str · ${activeTuning.name}`}
      eyebrow="Pitch Precision"
      icon={<Gauge className="h-5 w-5 text-[var(--color-copper)]" />}
      headerActions={
        <button
          type="button"
          onClick={() => void toggleListening()}
          className={`glass-pill flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isListening ? "bg-red-500 text-white" : ""}`}
        >
          {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {isListening ? t("tuner.stopMic") : t("tuner.startMic")}
        </button>
      }
    >
      <div className="space-y-4">

        {/* ── Instrument selector (scrollable pill row) ── */}
        <div className="flex flex-wrap items-center gap-2">
          {INSTRUMENT_LIST.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setInstrument(entry.id)}
              className={`tab-editor-pill inline-flex items-center gap-1.5 ${instrument === entry.id ? "tab-editor-pill-active" : ""}`}
            >
              {entry.id === "guitar" || entry.id === "ukulele" || entry.id === "mandolin" || entry.id === "banjo"
                ? <Guitar className="h-3.5 w-3.5" />
                : entry.id === "bass"
                  ? <Music2 className="h-3.5 w-3.5" />
                  : <Music2 className="h-3.5 w-3.5" />}
              {entry.label}
            </button>
          ))}
        </div>

        {/* String count (guitar/bass only) */}
        {renderStringCountSelector() && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-px bg-[var(--color-border)]" />
            {renderStringCountSelector()}
          </div>
        )}

        {/* ── Tuning preset + reference sound ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-group">
            <span className="field-label">{t("tuner.tuningPreset")}</span>
            <select
              value={activeTuning.id}
              onChange={(e) => setTuningId(e.target.value)}
              className="field py-1.5 text-xs font-bold"
            >
              {tuningOptions.map((p: TuningPreset) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">{t("tuner.refSound")}</span>
            <select
              value={pluckVoice}
              onChange={(e) => setPluckVoice(e.target.value as PluckInstrument)}
              className="field py-1.5 text-xs font-bold"
            >
              <option value="guitar-steel">{t("tuner.steel")}</option>
              <option value="guitar-nylon">{t("tuner.nylon")}</option>
              <option value="bass">{t("tuner.fingered")}</option>
              <option value="bass-pick">{t("tuner.pick")}</option>
            </select>
          </label>
        </div>

        {/* ── Waveform canvas (always rendered — prevents layout shift) ── */}
        <div className="relative h-16 w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-black/35">
          <canvas ref={canvasRef} className="h-full w-full" width={400} height={64} />
          {!isListening && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {t("tuner.micInactive")}
              </span>
            </div>
          )}
        </div>

        {/* ── Live pitch readout — fixed height to prevent layout shifts ── */}
        <div className="min-h-[108px]">
          {detectedPitch ? (
            <div className="modal-inset-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-4xl font-black tracking-tight text-[var(--color-copper)]">
                    {detectedPitch.note}
                  </div>
                  <div className="mt-0.5 text-xs font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
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
              <div className="tuner-gauge-track mt-3">
                <div className="tuner-gauge-needle" style={{ left: `${gaugePosition}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                <span>{t("tuner.flat")}</span>
                <span>{t("tuner.gaugeMid")}</span>
                <span>{t("tuner.sharp")}</span>
              </div>
            </div>
          ) : isListening ? (
            <div className="flex h-full min-h-[108px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {t("tuner.listening")}
              </span>
            </div>
          ) : (
            /* Placeholder keeps height stable when mic is off */
            <div className="flex min-h-[108px] items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)]/40">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                {t("tuner.startMic")} to detect pitch
              </span>
            </div>
          )}
        </div>

        {/* ── String reference grid ── */}
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
            {t("tuner.tapToHearTitle")
              .replace("{name}", activeTuning.name)
              .replace("{strings}", String(activeTuning.strings.length))}
          </div>
          <div className={`grid gap-2 ${stringGridCols}`}>
            {activeTuning.strings.map((s) => renderStringRow(s))}
          </div>
        </div>

      </div>
    </CollapsibleCard>
  );
}

export function TunerClient() {
  return (
    <SplitViewFullScreen className="animate-fade-up gap-6" showControls={false} allowSplitView={true}>
      <TunerCard />
    </SplitViewFullScreen>
  );
}
