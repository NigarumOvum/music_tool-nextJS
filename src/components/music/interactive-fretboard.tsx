"use client";

import { useMemo, useState, useCallback } from "react";
import { Volume2, Zap, Layers } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";
import {
  GUITAR_TUNINGS,
  BASS_TUNINGS,
  type TuningPreset,
  type TuningString,
} from "@/lib/music/tunings";
import { playReferencePluck, type PluckInstrument } from "@/lib/music/instrument-synth";
import { CHROMATIC } from "@/lib/music/notes";

type FretboardMode = "guitar" | "bass";
type ScaleOverlay = "none" | "major" | "minor" | "pentatonic" | "blues";

const SCALE_PATTERNS: Record<ScaleOverlay, number[]> = {
  none: [],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
};

const SCALE_NAMES: Record<ScaleOverlay, string> = {
  none: "No Scale",
  major: "Major Scale",
  minor: "Natural Minor",
  pentatonic: "Pentatonic",
  blues: "Blues",
};

type InteractiveFretboardProps = {
  mode?: FretboardMode;
  tuning?: TuningPreset;
  onTuningChange?: (tuning: TuningPreset) => void;
  scaleOverlay?: ScaleOverlay;
  onScaleChange?: (scale: ScaleOverlay) => void;
  showControls?: boolean;
  className?: string;
  onNoteClick?: (string: number, fret: number, note: string) => void;
  playOnHover?: boolean;
  rootNote?: string;
};

export function InteractiveFretboard({
  mode = "guitar",
  tuning: externalTuning,
  onTuningChange,
  scaleOverlay = "none",
  onScaleChange,
  showControls = true,
  className = "",
  onNoteClick,
  playOnHover = false,
  rootNote = "C",
}: InteractiveFretboardProps) {
  const { getAudioContext } = useAudio();
  const [activeString, setActiveString] = useState<number | null>(null);
  const [activeFret, setActiveFret] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const tunings = mode === "guitar" ? GUITAR_TUNINGS : BASS_TUNINGS;
  const currentTuning = externalTuning || tunings[0];

  const strings = useMemo(() => {
    return [...currentTuning.strings].reverse();
  }, [currentTuning]);

  const fretCount = 12;

  const getNoteAtPosition = useCallback((stringIdx: number, fret: number): string => {
    const stringData = strings[stringIdx];
    if (!stringData) return "";
    const openPitch = Math.round(69 + 12 * Math.log2(stringData.frequency / 440));
    const notePitch = openPitch + fret;
    const noteIndex = notePitch % 12;
    return CHROMATIC[noteIndex];
  }, [strings]);

  const isNoteInScale = useCallback((note: string): boolean => {
    if (scaleOverlay === "none") return false;
    const rootIndex = CHROMATIC.indexOf(rootNote as (typeof CHROMATIC)[number]);
    if (rootIndex === -1) return false;
    const noteIndex = CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]);
    if (noteIndex === -1) return false;
    const interval = (noteIndex - rootIndex + 12) % 12;
    return SCALE_PATTERNS[scaleOverlay].includes(interval);
  }, [scaleOverlay, rootNote]);

  const handleNoteClick = useCallback((stringIdx: number, fret: number) => {
    const note = getNoteAtPosition(stringIdx, fret);
    const stringData = strings[stringIdx];
    if (!stringData) return;

    const frequency = stringData.frequency * 2 ** (fret / 12);
    const voice: PluckInstrument = mode === "bass" ? "bass" : "guitar-steel";
    playReferencePluck(getAudioContext(), frequency, voice);

    setActiveString(stringIdx);
    setActiveFret(fret);
    onNoteClick?.(stringIdx, fret, note);

    setTimeout(() => {
      setActiveString(null);
      setActiveFret(null);
    }, 300);
  }, [getAudioContext, strings, mode, getNoteAtPosition, onNoteClick]);

  const handleNoteHover = useCallback((stringIdx: number, fret: number, isEntering: boolean) => {
    if (!playOnHover) return;
    if (isEntering) {
      const note = getNoteAtPosition(stringIdx, fret);
      const stringData = strings[stringIdx];
      if (!stringData) return;

      const frequency = stringData.frequency * 2 ** (fret / 12);
      const voice: PluckInstrument = mode === "bass" ? "bass" : "guitar-steel";
      playReferencePluck(getAudioContext(), frequency, voice);
    }
  }, [playOnHover, getAudioContext, strings, mode, getNoteAtPosition]);

  return (
    <div className={`space-y-4 ${className}`}>
      {showControls && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
              Tuning
            </label>
            <select
              value={currentTuning.id}
              onChange={(e) => {
                const selected = tunings.find((t) => t.id === e.target.value);
                if (selected) onTuningChange?.(selected);
              }}
              className="glass-pill border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-[var(--color-mint)] outline-none"
            >
              {tunings.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
              Scale
            </label>
            <select
              value={scaleOverlay}
              onChange={(e) => onScaleChange?.(e.target.value as ScaleOverlay)}
              className="glass-pill border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-[var(--color-mint)] outline-none"
            >
              {Object.entries(SCALE_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
              Root
            </label>
            <select
              value={rootNote}
              onChange={(e) => onScaleChange?.(scaleOverlay)}
              className="glass-pill border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-[var(--color-mint)] outline-none"
            >
              {CHROMATIC.map((note) => (
                <option key={note} value={note}>
                  {note}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsHovering(!isHovering)}
            className={`glass-pill flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
              isHovering ? "bg-[var(--color-mint)] text-black" : "text-[var(--color-sand-2)]"
            }`}
          >
            <Volume2 className="h-3 w-3" />
            {isHovering ? "Hover Play ON" : "Hover Play"}
          </button>
        </div>
      )}

      <div className="panel glass-shine overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="eyebrow">Interactive Fretboard</div>
            <h3 className="text-lg font-black">
              {mode === "guitar" ? "Guitar" : "Bass"} · {currentTuning.name}
            </h3>
          </div>
          {scaleOverlay !== "none" && (
            <div className="flex items-center gap-1.5 text-xs font-black text-[var(--color-mint)]">
              <Layers className="h-4 w-4" />
              <span>{SCALE_NAMES[scaleOverlay]} ({rootNote})</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {/* Fret numbers */}
          <div className="flex pl-12">
            {Array.from({ length: fretCount }, (_, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[9px] font-bold text-[var(--color-sand-2)]"
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Strings */}
          {strings.map((stringData, stringIdx) => (
            <div key={stringData.label} className="flex items-center gap-1">
              {/* String label */}
              <div className="w-12 text-right text-xs font-black text-[var(--color-sand-2)]">
                {stringData.label}
              </div>

              {/* Frets */}
              {Array.from({ length: fretCount }, (_, fret) => {
                const note = getNoteAtPosition(stringIdx, fret);
                const isInScale = isNoteInScale(note);
                const isActive = activeString === stringIdx && activeFret === fret;

                return (
                  <button
                    key={fret}
                    type="button"
                    onClick={() => handleNoteClick(stringIdx, fret)}
                    onMouseEnter={() => handleNoteHover(stringIdx, fret, true)}
                    onMouseLeave={() => handleNoteHover(stringIdx, fret, false)}
                    className={`relative flex-1 h-10 rounded-sm transition-all border ${
                      isActive
                        ? "bg-[var(--color-mint)] border-[var(--color-mint)] text-black shadow-lg shadow-emerald-500/30"
                        : isInScale
                          ? "bg-[var(--color-brass)]/20 border-[var(--color-brass)]/40 text-[var(--color-brass)] hover:bg-[var(--color-brass)]/30"
                          : "bg-white/5 border-white/10 text-[var(--color-sand-2)] hover:bg-white/10"
                    }`}
                    title={`${note} (${stringData.label} + ${fret})`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black">
                      {note}
                    </span>
                    {/* Fret marker dots */}
                    {(fret === 2 || fret === 4 || fret === 6 || fret === 8 || fret === 10) && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                    {fret === 11 && (
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Open strings */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
            Open strings:
          </span>
          {strings.map((stringData, idx) => (
            <button
              key={stringData.label}
              type="button"
              onClick={() => handleNoteClick(idx, 0)}
              className="glass-pill px-2 py-1 text-[10px] font-black text-[var(--color-mint)] hover:bg-[var(--color-mint)] hover:text-black transition"
            >
              {stringData.note}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
