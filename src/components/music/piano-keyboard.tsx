"use client";

import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { KEYBOARD_VOICES, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { WHITE_KEYS, noteFrequency, noteId } from "@/lib/music/notes";

interface PianoKeyboardProps {
  onNotePlay?: (note: string, frequency: number) => void;
  activeNotes?: string[];
  startOctave?: number;
  octaves?: number;
  showControls?: boolean;
  voice?: KeyboardVoice;
  onVoiceChange?: (voice: KeyboardVoice) => void;
  showInstrumentSelector?: boolean;
}

const BLACK_OFFSETS = [
  { note: "C#", left: "9%" },
  { note: "D#", left: "23%" },
  { note: "F#", left: "52%" },
  { note: "G#", left: "66%" },
  { note: "A#", left: "80%" },
] as const;

function OctaveKeyboard({
  octave,
  activeNotes,
  pressedKey,
  onPress,
}: {
  octave: number;
  activeNotes: string[];
  pressedKey: string | null;
  onPress: (note: string, octave: number) => void;
}) {
  const isActive = (note: string) => activeNotes.includes(note) || activeNotes.includes(noteId(note, octave));

  return (
    <div className="relative min-w-[280px] flex-1">
      <div className="mb-1 text-center text-[9px] font-black uppercase tracking-widest text-zinc-500">
        Oct {octave}
      </div>
      <div className="relative flex h-40 rounded-xl border border-white/5 bg-zinc-950 p-1.5 shadow-inner">
        <div className="flex w-full gap-[2px]">
          {WHITE_KEYS.map((note) => {
            const id = noteId(note, octave);
            const active = isActive(note);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPress(note, octave)}
                className={`relative flex-1 rounded-sm transition-all duration-75 ${
                  active
                    ? "bg-[var(--color-copper)]"
                    : pressedKey === id
                      ? "bg-zinc-200"
                      : "bg-white hover:bg-zinc-100"
                } shadow-[inset_0_-4px_0_rgba(0,0,0,0.08)] active:translate-y-[2px]`}
              >
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-zinc-400">
                  {note}
                </span>
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 h-24">
          <div className="relative h-full w-full">
            {BLACK_OFFSETS.map((key) => {
              const id = noteId(key.note, octave);
              const active = isActive(key.note);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPress(key.note, octave)}
                  className={`pointer-events-auto absolute h-full w-[10%] rounded-sm transition-all duration-75 ${
                    active
                      ? "bg-[var(--color-copper)] ring-1 ring-white/20"
                      : pressedKey === id
                        ? "bg-zinc-700"
                        : "bg-zinc-900 hover:bg-zinc-800"
                  } border border-white/5 shadow-[0_4px_8px_rgba(0,0,0,0.45)] active:translate-y-[2px]`}
                  style={{ left: key.left }}
                >
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[7px] font-bold text-zinc-500">
                    {key.note}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PianoKeyboard({
  onNotePlay,
  activeNotes = [],
  startOctave = 3,
  octaves = 2,
  showControls = true,
  voice = "piano",
  onVoiceChange,
  showInstrumentSelector = true,
}: PianoKeyboardProps) {
  const [baseOctave, setBaseOctave] = useState(startOctave);
  const [visibleOctaves, setVisibleOctaves] = useState(octaves);
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const octaveRange = useMemo(
    () => Array.from({ length: visibleOctaves }, (_, index) => baseOctave + index),
    [baseOctave, visibleOctaves],
  );

  const handlePress = (note: string, octave: number) => {
    const id = noteId(note, octave);
    setPressedKey(id);
    onNotePlay?.(note, noteFrequency(note, octave));
    window.setTimeout(() => setPressedKey(null), 140);
  };

  return (
    <div className="space-y-4">
      {showControls ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Octave</span>
            <button
              type="button"
              onClick={() => setBaseOctave((current) => Math.max(1, current - 1))}
              className="glass-pill flex h-8 w-8 items-center justify-center"
              aria-label="Lower octave"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-sm font-black tabular-nums">{baseOctave}</span>
            <button
              type="button"
              onClick={() => setBaseOctave((current) => Math.min(6, current + 1))}
              className="glass-pill flex h-8 w-8 items-center justify-center"
              aria-label="Raise octave"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <div className="ml-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setVisibleOctaves((current) => Math.max(1, current - 1))}
                className="glass-pill flex h-8 w-8 items-center justify-center"
                aria-label="Fewer octaves"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {visibleOctaves} oct
              </span>
              <button
                type="button"
                onClick={() => setVisibleOctaves((current) => Math.min(3, current + 1))}
                className="glass-pill flex h-8 w-8 items-center justify-center"
                aria-label="More octaves"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {showInstrumentSelector && onVoiceChange ? (
            <label className="field-group min-w-[180px]">
              <span className="field-label">Instrument</span>
              <select
                value={voice}
                onChange={(event) => onVoiceChange(event.target.value as KeyboardVoice)}
                className="field py-2 text-xs font-bold"
              >
                {KEYBOARD_VOICES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {octaveRange.map((octave) => (
            <OctaveKeyboard
              key={octave}
              octave={octave}
              activeNotes={activeNotes}
              pressedKey={pressedKey}
              onPress={handlePress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
