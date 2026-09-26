"use client";

import { Cable, ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/language-provider";
import { KEYBOARD_VOICES, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC, WHITE_KEYS, noteFrequency, noteId } from "@/lib/music/notes";

// Computer-keyboard rows: key -> semitone offset from C.
const LOWER_ROW: Record<string, number> = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
};
const UPPER_ROW: Record<string, number> = {
  q: 0, "2": 1, w: 2, "3": 3, e: 4, r: 5, "5": 6, t: 7, "6": 8, y: 9, "7": 10, u: 11,
};

function keyForOffset(row: Record<string, number>, offset: number): string | undefined {
  for (const [key, value] of Object.entries(row)) {
    if (value === offset) return key.toUpperCase();
  }
  return undefined;
}

interface PianoKeyboardProps {
  onNotePlay?: (note: string, frequency: number) => void;
  activeNotes?: string[];
  startOctave?: number;
  octaves?: number;
  showControls?: boolean;
  voice?: KeyboardVoice;
  onVoiceChange?: (voice: KeyboardVoice) => void;
  showInstrumentSelector?: boolean;
  /** Let the computer keyboard play notes (default true). */
  computerKeys?: boolean;
  /** Show the USB MIDI toggle (default true). */
  midiInput?: boolean;
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
  pressedKeys,
  keyHints,
  onPress,
}: {
  octave: number;
  activeNotes: string[];
  pressedKeys: Set<string>;
  keyHints: Record<string, string>;
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
            const hint = keyHints[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPress(note, octave)}
                className={`relative flex-1 rounded-sm transition-all duration-75 ${
                  active
                    ? "bg-[var(--color-copper)]"
                    : pressedKeys.has(id)
                      ? "bg-zinc-200"
                      : "bg-white hover:bg-zinc-100"
                } shadow-[inset_0_-4px_0_rgba(0,0,0,0.08)] active:translate-y-[2px]`}
              >
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-zinc-400">
                  {hint ? `${note} · ${hint}` : note}
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
                      : pressedKeys.has(id)
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
  computerKeys = true,
  midiInput = true,
}: PianoKeyboardProps) {
  const { t } = useI18n();
  const [baseOctave, setBaseOctave] = useState(startOctave);
  const [visibleOctaves, setVisibleOctaves] = useState(octaves);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [midiSupported] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function",
  );
  const [midiOn, setMidiOn] = useState(false);
  const [midiInputs, setMidiInputs] = useState<Array<{ id: string; name: string }>>([]);
  const [midiInputId, setMidiInputId] = useState<string | null>(null);
  const [midiError, setMidiError] = useState<string | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const baseOctaveRef = useRef(baseOctave);

  useEffect(() => {
    baseOctaveRef.current = baseOctave;
  }, [baseOctave]);

  const octaveRange = useMemo(
    () => Array.from({ length: visibleOctaves }, (_, index) => baseOctave + index),
    [baseOctave, visibleOctaves],
  );

  const pressId = useCallback((id: string) => {
    setPressedKeys((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const releaseId = useCallback((id: string) => {
    setPressedKeys((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const playId = useCallback((note: string, octave: number) => {
    onNotePlay?.(note, noteFrequency(note, octave));
  }, [onNotePlay]);

  const handlePress = useCallback((note: string, octave: number) => {
    const id = noteId(note, octave);
    pressId(id);
    playId(note, octave);
    window.setTimeout(() => releaseId(id), 220);
  }, [pressId, playId, releaseId]);

  const pressMidiNote = useCallback((midi: number) => {
    const note = CHROMATIC[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    pressId(noteId(note, octave));
    playId(note, octave);
  }, [pressId, playId]);

  const releaseMidiNote = useCallback((midi: number) => {
    const note = CHROMATIC[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    releaseId(noteId(note, octave));
  }, [releaseId]);

  // Key hints per white key for the two mapped computer rows.
  const keyHints = useMemo(() => {
    const hints: Record<string, string> = {};
    const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
    const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
    whiteOffsets.forEach((offset, i) => {
      const lower = keyForOffset(LOWER_ROW, offset);
      if (lower) hints[noteId(whiteNotes[i], baseOctave)] = lower;
      const upper = keyForOffset(UPPER_ROW, offset);
      if (upper) hints[noteId(whiteNotes[i], baseOctave + 1)] = upper;
    });
    return hints;
  }, [baseOctave]);

  // Computer keyboard playing: Z–M bottom octave, Q–U next octave, arrows shift octave.
  useEffect(() => {
    if (!computerKeys) return;
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(
        el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable),
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setBaseOctave((current) => Math.max(1, current - 1));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setBaseOctave((current) => Math.min(6, current + 1));
        return;
      }
      const key = event.key.toLowerCase();
      const lower = LOWER_ROW[key];
      const upper = UPPER_ROW[key];
      if (lower === undefined && upper === undefined) return;
      event.preventDefault();
      const octave = upper !== undefined ? baseOctaveRef.current + 1 : baseOctaveRef.current;
      const offset = (upper ?? lower) as number;
      const note = CHROMATIC[offset % 12];
      const id = noteId(note, octave);
      pressId(id);
      playId(note, octave);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const lower = LOWER_ROW[key];
      const upper = UPPER_ROW[key];
      if (lower === undefined && upper === undefined) return;
      const octave = upper !== undefined ? baseOctaveRef.current + 1 : baseOctaveRef.current;
      const offset = (upper ?? lower) as number;
      releaseId(noteId(CHROMATIC[offset % 12], octave));
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [computerKeys, pressId, releaseId, playId]);

  const enableMidi = useCallback(async () => {
    if (!midiSupported) {
      setMidiError(t("piano.midiUnsupported"));
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess!();
      midiAccessRef.current = access;
      const found: Array<{ id: string; name: string }> = [];
      access.inputs.forEach((port) => {
        found.push({ id: port.id, name: port.name || t("piano.midiDevice") });
      });
      setMidiInputs(found);
      setMidiInputId((current) => current ?? found[0]?.id ?? null);
      setMidiOn(true);
      setMidiError(found.length === 0 ? t("piano.noMidi") : null);
      access.onstatechange = () => {
        const next: Array<{ id: string; name: string }> = [];
        midiAccessRef.current?.inputs.forEach((port) => {
          next.push({ id: port.id, name: port.name || t("piano.midiDevice") });
        });
        setMidiInputs(next);
      };
    } catch {
      setMidiError(t("piano.midiBlocked"));
    }
  }, [midiSupported, t]);

  // Route MIDI messages of the selected input to the keyboard.
  useEffect(() => {
    if (!midiOn || !midiInputId || !midiAccessRef.current) return;
    let port: MIDIInput | null = null;
    midiAccessRef.current.inputs.forEach((candidate) => {
      if (candidate.id === midiInputId) port = candidate;
    });
    if (!port) return;
    const activePort: MIDIInput = port;
    activePort.onmidimessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;
      const command = data[0] & 0xf0;
      const note = data[1];
      const velocity = data[2];
      if (command === 0x90 && velocity > 0) pressMidiNote(note);
      else if (command === 0x80 || (command === 0x90 && velocity === 0)) releaseMidiNote(note);
    };
    return () => {
      activePort.onmidimessage = null;
    };
  }, [midiOn, midiInputId, pressMidiNote, releaseMidiNote]);

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

          {midiInput ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (midiOn) {
                    setMidiOn(false);
                    setMidiInputId(null);
                  } else {
                    void enableMidi();
                  }
                }}
                title={t("piano.midiTitle")}
                className={`glass-pill inline-flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
                  midiOn
                    ? "border-[var(--color-mint)] bg-[var(--color-mint)]/15 text-[var(--color-mint)]"
                    : "text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
                }`}
              >
                <Cable className="h-3.5 w-3.5" />
                MIDI
              </button>
              {midiOn && midiInputs.length > 1 ? (
                <select
                  value={midiInputId ?? ""}
                  onChange={(event) => setMidiInputId(event.target.value || null)}
                  className="field w-auto py-1.5 text-xs font-bold"
                  aria-label={t("piano.midiDevice")}
                >
                  {midiInputs.map((input) => (
                    <option key={input.id} value={input.id}>{input.name}</option>
                  ))}
                </select>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {midiError ? (
        <p className="text-[11px] font-bold text-[var(--color-sand-2)]">{midiError}</p>
      ) : null}
      {midiOn && midiInputs.length > 0 && midiInputId ? (
        <p className="text-[11px] font-bold text-[var(--color-mint)]">
          {t("piano.midiActive").replace("{name}", midiInputs.find((input) => input.id === midiInputId)?.name ?? t("piano.midiDevice"))}
        </p>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {octaveRange.map((octave) => (
            <OctaveKeyboard
              key={octave}
              octave={octave}
              activeNotes={activeNotes}
              pressedKeys={pressedKeys}
              keyHints={computerKeys ? keyHints : {}}
              onPress={handlePress}
            />
          ))}
        </div>
      </div>

      {computerKeys ? (
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {t("piano.computerKeys")}
        </p>
      ) : null}
    </div>
  );
}
