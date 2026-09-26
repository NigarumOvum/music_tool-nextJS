"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, FastForward, Play, Square, VolumeX } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { useAudio } from "@/components/music/audio-provider";
import { useI18n } from "@/components/language-provider";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
import { playMetronomeSound, type MetronomeSoundType } from "@/lib/music/metronome-sound";

const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"] as const;

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

export function MetronomeCard() {
  const { getAudioContext } = useAudio();
  const { t } = useI18n();
  const userId = useCurrentUserId();
  const [bpm, setBpm] = usePersistentState("helpers_bpm", 120, { userId });
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSignature, setTimeSignature] = usePersistentState<(typeof TIME_SIGNATURES)[number]>("helpers_signature", "4/4", { userId });
  const [subdivision, setSubdivision] = usePersistentState<1 | 2 | 3 | 4 | 6>("helpers_subdivision", 1, { userId });
  const [soundType, setSoundType] = usePersistentState<MetronomeSoundType>("helpers_sound", "digital", { userId });
  const [beatCount, setBeatCount] = useState(0);
  const [clickVolume, setClickVolume] = usePersistentState("helpers_click_volume", 0.75, { userId });
  const [countInBars, setCountInBars] = usePersistentState("helpers_count_in", 0, { userId });
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [accentFlash, setAccentFlash] = useState(false);
  const subdivisionName =
    subdivision === 1
      ? t("metro.quarter")
      : subdivision === 2
      ? t("metro.eighths")
      : subdivision === 3
      ? t("metro.triplets")
      : subdivision === 4
      ? t("metro.sixteenths")
      : t("metro.sextuplets");

  // Speed Trainer Mode
  const [speedTrainer, setSpeedTrainer] = useState(false);
  const [trainerInc, setTrainerInc] = useState(2);
  const [trainerEveryBars, setTrainerEveryBars] = useState(4);
  const [trainerTargetBpm, setTrainerTargetBpm] = useState(160);

  // Gap / Mute Training Mode
  const [gapTraining, setGapTraining] = useState(false);
  const [gapPlayBars, setGapPlayBars] = useState(3);
  const [gapMuteBars, setGapMuteBars] = useState(1);

  const nextStepTimeRef = useRef(0);
  const schedulerTimerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const lastRampedBarRef = useRef(-1);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return (
    <CollapsibleCard
      defaultOpen={true}
      title={t("metro.title")}
      subtitle={`${bpm} BPM · ${timeSignature} · ${subdivisionName} · ${soundType.toUpperCase()}`}
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
          {isPlaying ? t("metro.stop") : t("metro.start")}
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
              <span className="field-label">{t("metro.signature")}</span>
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
              <span className="field-label">{t("metro.subdivision")}</span>
              <select
                value={subdivision}
                onChange={(event) => setSubdivision(Number(event.target.value) as 1 | 2 | 3 | 4 | 6)}
                className="field py-1.5 text-xs font-bold"
              >
                <option value={1}>{t("metro.quarter")} (1x)</option>
                <option value={2}>{t("metro.eighths")} (2x)</option>
                <option value={3}>{t("metro.triplets")} (3x)</option>
                <option value={4}>{t("metro.sixteenths")} (4x)</option>
                <option value={6}>{t("metro.sextuplets")} (6x)</option>
              </select>
            </label>
            <label className="field-group">
              <span className="field-label">{t("metro.countIn")}</span>
              <select
                value={countInBars}
                onChange={(event) => setCountInBars(Number(event.target.value))}
                className="field py-1.5 text-xs font-bold"
              >
                <option value={0}>{t("metro.countOff")}</option>
                <option value={1}>{t("metro.countBars").replace("{n}", "1")}</option>
                <option value={2}>{t("metro.countBarsPlural").replace("{n}", "2")}</option>
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
                <span className="field-label">{t("metro.tempoSlider").replace("{bpm}", String(bpm))}</span>
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
                <span className="field-label">{t("metro.clickVolume").replace("{pct}", String(Math.round(clickVolume * 100)))}</span>
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
                  <span>{t("metro.speedTrainer")}</span>
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
                  <span className="text-[var(--color-sand-2)]">{t("metro.every")}</span>
                  <select
                    value={trainerEveryBars}
                    onChange={(e) => setTrainerEveryBars(Number(e.target.value))}
                    className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={4}>4</option>
                    <option value={8}>8</option>
                  </select>
                  <span className="text-[var(--color-sand-2)]">{t("metro.upTo")}</span>
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
                  {t("metro.speedDesc")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <VolumeX className="h-3.5 w-3.5 text-amber-400" />
                  <span>{t("metro.gapTraining")}</span>
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
                  <span className="text-[var(--color-sand-2)]">{t("metro.playBars")}</span>
                  <select
                    value={gapPlayBars}
                    onChange={(e) => setGapPlayBars(Number(e.target.value))}
                    className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                  </select>
                  <span className="text-[var(--color-sand-2)]">{t("metro.muteBars")}</span>
                  <select
                    value={gapMuteBars}
                    onChange={(e) => setGapMuteBars(Number(e.target.value))}
                    className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-bold"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </div>
              ) : (
                <p className="text-[10px] text-[var(--color-sand-2)]">
                  {t("metro.gapDesc")}
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
              {t("metro.tapTempo")} {tappedBpm ? `· ${tappedBpm} BPM` : ""}
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
  );
}
