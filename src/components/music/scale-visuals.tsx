"use client";

import { useState } from "react";
import { Drum, Guitar, Music2, Piano } from "lucide-react";

import { InfoTooltip } from "@/components/info-tooltip";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { AVAILABLE_INSTRUMENTS } from "@/lib/music/instruments";
import type { KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC } from "@/lib/music/notes";

export type ScaleInstrumentId = "piano" | "guitar" | "bass" | "drums";

const SCALE_INSTRUMENT_IDS: ScaleInstrumentId[] = ["piano", "guitar", "bass", "drums"];

const SCALE_INSTRUMENT_ICONS: Record<ScaleInstrumentId, typeof Guitar> = {
  piano: Piano,
  guitar: Guitar,
  bass: Music2,
  drums: Drum,
};

export function scaleInstrumentLabel(id: ScaleInstrumentId): string {
  return AVAILABLE_INSTRUMENTS.find((item) => item.id === id)?.label ?? id;
}

function activeButtonTone(accent: "brass" | "berry") {
  return accent === "berry"
    ? "border-[var(--color-berry)] bg-[var(--color-berry)] text-white shadow-md"
    : "border-[var(--color-brass)] bg-[var(--color-brass)] text-black shadow-md";
}

/** All 12 chromatic notes as tap-friendly buttons (replaces root-note dropdowns). */
export function NoteButtons({
  value,
  onChange,
  accent = "brass",
  ariaLabel = "Select root note",
}: {
  value: string;
  onChange: (note: string) => void;
  accent?: "brass" | "berry";
  ariaLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {CHROMATIC.map((note) => {
        const active = value === note;
        const isSharp = note.includes("#");
        return (
          <button
            key={note}
            type="button"
            onClick={() => onChange(note)}
            aria-pressed={active}
            title={note}
            className={`min-w-10 rounded-xl border px-2.5 py-1.5 text-xs font-black transition active:scale-95 ${
              active
                ? activeButtonTone(accent)
                : isSharp
                  ? "border-white/10 bg-zinc-900/70 text-[var(--color-sand-1)] hover:border-white/30 hover:text-white"
                  : "border-white/10 bg-white/5 text-[var(--color-foreground)] hover:border-white/30"
            }`}
          >
            {note}
          </button>
        );
      })}
    </div>
  );
}

/** All scale types as buttons (replaces the scale-type dropdown). */
export function ScaleTypeButtons({
  types,
  value,
  onChange,
}: {
  types: string[];
  value: string;
  onChange: (scaleType: string) => void;
}) {
  if (types.length === 0) {
    return <p className="text-xs text-[var(--color-sand-2)]">No scale types match your search.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select scale type">
      {types.map((scaleType) => {
        const active = value === scaleType;
        return (
          <button
            key={scaleType}
            type="button"
            onClick={() => onChange(scaleType)}
            aria-pressed={active}
            className={`rounded-xl border px-3 py-1.5 text-[11px] font-black transition active:scale-95 ${
              active
                ? "border-[var(--color-brass)] bg-[var(--color-brass)] text-black shadow-md"
                : "border-white/10 bg-white/5 text-[var(--color-sand-1)] hover:border-[var(--color-brass)]/50 hover:text-[var(--color-foreground)]"
            }`}
          >
            {scaleType}
          </button>
        );
      })}
    </div>
  );
}

function GuitarFretboard({ notes, root }: { notes: string[]; root: string }) {
  const strings = ["E", "A", "D", "G", "B", "E"];
  const frets = 12;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Guitar className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Guitar Fretboard</h3>
        <InfoTooltip
          content="Shows scale positions across all 6 strings and 12 frets. Copper cells show root notes, mint cells show other scale notes. Use this to find scale patterns on guitar."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2 overflow-x-auto pb-2">
        {strings.map((string) => (
          <div key={string} className="flex items-center gap-1">
            <span className="w-8 text-right text-xs font-bold text-[var(--color-sand-2)]">{string}</span>
            <div className="flex gap-1">
              {Array.from({ length: frets }).map((_, fret) => {
                const note = CHROMATIC[(CHROMATIC.indexOf(string as (typeof CHROMATIC)[number]) + fret) % 12];
                const isInScale = notes.includes(note);
                const isRoot = note === root;
                return (
                  <div
                    key={fret}
                    className={`h-8 w-8 flex items-center justify-center rounded text-[10px] font-bold transition ${
                      isInScale
                        ? isRoot
                          ? "bg-[var(--color-copper)] text-white"
                          : "bg-[var(--color-mint)]/80 text-black"
                        : "bg-white/5 text-[var(--color-sand-2)]"
                    }`}
                  >
                    {isInScale ? note : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BassFretboard({ notes, root }: { notes: string[]; root: string }) {
  const strings = ["E", "A", "D", "G"];
  const frets = 12;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Bass Fretboard</h3>
        <InfoTooltip
          content="Shows scale positions across 4 bass strings and 12 frets. Similar to guitar but optimized for bass guitar patterns."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2 overflow-x-auto pb-2">
        {strings.map((string) => (
          <div key={string} className="flex items-center gap-1">
            <span className="w-8 text-right text-xs font-bold text-[var(--color-sand-2)]">{string}</span>
            <div className="flex gap-1">
              {Array.from({ length: frets }).map((_, fret) => {
                const note = CHROMATIC[(CHROMATIC.indexOf(string as (typeof CHROMATIC)[number]) + fret) % 12];
                const isInScale = notes.includes(note);
                const isRoot = note === root;
                return (
                  <div
                    key={fret}
                    className={`h-10 w-10 flex items-center justify-center rounded text-xs font-bold transition ${
                      isInScale
                        ? isRoot
                          ? "bg-[var(--color-copper)] text-white"
                          : "bg-[var(--color-mint)]/80 text-black"
                        : "bg-white/5 text-[var(--color-sand-2)]"
                    }`}
                  >
                    {isInScale ? note : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrumPattern({ notes }: { notes: string[] }) {
  const drumKit = ["Kick", "Snare", "Hi-hat", "Open HH", "Crash", "Ride", "Tom L", "Tom M", "Tom H"];
  const [pattern, setPattern] = useState(drumKit.map(() => Array.from({ length: 16 }, () => false)));

  void notes;

  const toggleCell = (drumIdx: number, step: number) => {
    setPattern((current) =>
      current.map((row, idx) =>
        idx === drumIdx ? row.map((cell, s) => (s === step ? !cell : cell)) : row,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Drum className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Drum Pattern</h3>
        <InfoTooltip
          content="16-step drum pattern editor. Click cells to add/remove hits. Use this to create rhythmic patterns that complement your chosen scale."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2">
        {drumKit.map((drum, drumIdx) => (
          <div key={drum} className="flex items-center gap-1">
            <span className="w-20 text-xs font-bold uppercase text-[var(--color-sand-2)]">{drum}</span>
            <div className="flex gap-1">
              {Array.from({ length: 16 }).map((_, step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => toggleCell(drumIdx, step)}
                  className={`h-6 w-6 rounded border text-[8px] font-bold transition ${
                    pattern[drumIdx][step]
                      ? step % 4 === 0
                        ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white"
                        : "border-[var(--color-mint)] bg-[var(--color-mint)]/80 text-black"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {pattern[drumIdx][step] ? "x" : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScaleInstrumentVisuals({
  notes,
  root,
  onPlayNote,
  voice,
}: {
  notes: string[];
  root: string;
  onPlayNote: (note: string) => void;
  voice: KeyboardVoice;
}) {
  const [instrument, setInstrument] = useState<ScaleInstrumentId>("piano");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SCALE_INSTRUMENT_IDS.map((id) => {
          const Icon = SCALE_INSTRUMENT_ICONS[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setInstrument(id)}
              className={`glass-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                instrument === id
                  ? "glass-pill-active text-[var(--color-foreground)]"
                  : "text-[var(--color-sand-2)] hover:-translate-y-0.5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {scaleInstrumentLabel(id)}
            </button>
          );
        })}
        <InfoTooltip
          content="Switch between different instrument visualizations to see how the scale appears on piano, guitar fretboard, bass, or drum patterns."
          position="bottom"
          size="sm"
        />
      </div>

      {instrument === "piano" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Piano className="h-4 w-4 text-[var(--color-brass)]" />
            <h3 className="text-lg font-black">Piano Keyboard</h3>
            <InfoTooltip
              content="Visual representation of the scale on a piano keyboard. Copper notes are the root, mint notes are other scale degrees. Click keys to hear individual notes."
              position="right"
              size="md"
            />
          </div>
          <PianoKeyboard activeNotes={notes} onNotePlay={(note) => onPlayNote(note)} voice={voice} />
        </div>
      )}

      {instrument === "guitar" && <GuitarFretboard notes={notes} root={root} />}

      {instrument === "bass" && <BassFretboard notes={notes} root={root} />}

      {instrument === "drums" && <DrumPattern notes={notes} />}
    </div>
  );
}

export function ScaleTheory({
  intervals,
  intervalNames,
  notes,
  root,
}: {
  intervals: number[];
  intervalNames: Record<number, string>;
  notes: string[];
  root: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Intervals</h4>
        <div className="grid gap-2 md:grid-cols-2">
          {intervals.map((interval) => (
            <div key={interval} className="flex items-center gap-2 text-sm">
              <span className="w-6 font-bold text-[var(--color-copper)]">{interval}</span>
              <span className="text-[var(--color-sand-2)]">{intervalNames[interval] || ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Notes</h4>
        <div className="flex flex-wrap gap-2">
          {notes.map((note) => (
            <span key={note} className={`glass-pill px-2 py-1 text-sm font-bold ${note === root ? "text-[var(--color-copper)]" : ""}`}>
              {note}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
