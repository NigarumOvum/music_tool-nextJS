"use client";

import { useMemo, useState } from "react";
import { Book, Layers, Music, Play, RotateCcw, Search, Sparkles } from "lucide-react";

import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useAudio } from "@/components/music/audio-provider";
import { KEYBOARD_VOICES, playKeyboardNote, playKeyboardNotes, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC, noteFrequency } from "@/lib/music/notes";

const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
};

const CHORDS: Record<string, number[]> = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Diminished: [0, 3, 6],
  Augmented: [0, 4, 8],
  "Major 7": [0, 4, 7, 11],
  "Minor 7": [0, 3, 7, 10],
  "Dominant 7": [0, 4, 7, 10],
  "Minor 7 b5": [0, 3, 6, 10],
  "Diminished 7": [0, 3, 6, 9],
  "Major 9": [0, 4, 7, 11, 14],
  "Dominant 9": [0, 4, 7, 10, 14],
  "Minor 9": [0, 3, 7, 10, 14],
  "6": [0, 4, 7, 9],
  "Minor 6": [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

type ChordNotePitch = { label: string; pitch: number };

function invertNotes(notes: string[], inversion: number): ChordNotePitch[] {
  const base: ChordNotePitch[] = notes.map((note) => ({
    label: note,
    pitch: CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]),
  }));

  if (inversion === 0) return base;

  const offset = inversion % notes.length;
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];
  const result: ChordNotePitch[] = [];

  for (const entry of rotated) {
    const pitch = entry.pitch;
    if (result.length === 0) {
      result.push({ label: entry.label, pitch });
      continue;
    }
    const prev = result[result.length - 1].pitch;
    let adjusted = pitch;
    while (adjusted < prev) adjusted += 12;
    while (adjusted - 12 >= prev) adjusted -= 12;
    result.push({ label: entry.label, pitch: adjusted });
  }
  return result;
}

function getNotes(root: string, intervals: number[]) {
  const rootIndex = CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]);
  return intervals.map((interval) => CHROMATIC[(rootIndex + interval) % 12]);
}

const INTERVAL_NAMES: Record<number, string> = {
  1: "m2",
  2: "M2",
  3: "m3",
  4: "M3",
  5: "P4",
  6: "TT",
  7: "P5",
  8: "m6",
  9: "M6",
  10: "m7",
  11: "M7",
};

function intervalName(root: string, note: string) {
  const gap = (CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]) - CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]) + 12) % 12;
  return gap === 0 ? "R" : INTERVAL_NAMES[gap] ?? "";
}

function diatonicTriads(scale: string[]): string[][] {
  const chords: string[][] = [];
  for (let i = 0; i < scale.length; i += 1) {
    chords.push([
      scale[i],
      scale[(i + 2) % scale.length],
      scale[(i + 4) % scale.length],
    ]);
  }
  return chords;
}

function triadQuality(root: string, third: string, fifth: string): string {
  const rootIdx = CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]);
  const thirdIdx = CHROMATIC.indexOf(third as (typeof CHROMATIC)[number]);
  const fifthIdx = CHROMATIC.indexOf(fifth as (typeof CHROMATIC)[number]);
  const thirdGap = (thirdIdx - rootIdx + 12) % 12;
  const fifthGap = (fifthIdx - rootIdx + 12) % 12;
  if (thirdGap === 4 && fifthGap === 7) return "M";
  if (thirdGap === 3 && fifthGap === 7) return "m";
  if (thirdGap === 3 && fifthGap === 6) return "dim";
  if (thirdGap === 4 && fifthGap === 8) return "aug";
  return "";
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

function romanNumeral(degree: number, quality: string) {
  const base = ROMAN_NUMERALS[degree] ?? `${degree + 1}`;
  if (quality === "M") return base;
  if (quality === "m") return base.toLowerCase();
  if (quality === "dim") return `${base.toLowerCase()}°`;
  return `${base}+`;
}

export function TheoryLabClient() {
  const { getAudioContext } = useAudio();
  const [scaleRoot, setScaleRoot] = useState("C");
  const [chordRoot, setChordRoot] = useState("C");
  const [scaleType, setScaleType] = useState("Major");
  const [chordType, setChordType] = useState("Major");
  const [inversion, setInversion] = useState(0);
  const [highlightMode, setHighlightMode] = useState<"scale" | "chord" | "none">("scale");
  const [keyboardVoice, setKeyboardVoice] = useState<KeyboardVoice>("piano");
  const [keyboardOctave, setKeyboardOctave] = useState(4);

  const playFrequency = (frequency: number) => {
    playKeyboardNote(getAudioContext(), frequency, keyboardVoice);
  };

  const playNoteAtOctave = (note: string, octave = keyboardOctave) => {
    playFrequency(noteFrequency(note, octave));
  };

  const scaleNotes = getNotes(scaleRoot, SCALES[scaleType]);
  const chordNotes = invertNotes(getNotes(chordRoot, CHORDS[chordType]), inversion).map((entry) => entry.label);
  const activeNotes = highlightMode === "scale" ? scaleNotes : highlightMode === "chord" ? chordNotes : [];

  const chordFrequencies = useMemo(
    () => invertNotes(getNotes(chordRoot, CHORDS[chordType]), inversion).map((entry) => noteFrequency(entry.label, keyboardOctave)),
    [chordRoot, chordType, inversion, keyboardOctave],
  );

  const playNotes = (notes: string[]) => {
    const frequencies = notes.map((note) => noteFrequency(note, keyboardOctave));
    playKeyboardNotes(getAudioContext(), frequencies, keyboardVoice);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel relative space-y-5 overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-md group">
          <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-30">
            <Book className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-pill bg-[var(--color-brass)]/10 p-2 text-[var(--color-brass)]">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Scale Explorer</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Modal analysis active</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setHighlightMode("scale"); playNotes(scaleNotes); }}
              className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:bg-[var(--color-brass)] hover:text-black"
            >
              <Play className="mr-1 inline h-3 w-3 fill-current" /> Play scale
            </button>
          </div>
          <div className="relative z-10 flex gap-2">
            <select value={scaleRoot} onChange={(e) => setScaleRoot(e.target.value)} className="field flex-1">
              {CHROMATIC.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={scaleType} onChange={(e) => setScaleType(e.target.value)} className="field flex-[2]">
              {Object.keys(SCALES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2">
            {scaleNotes.map((n, i) => (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => playNoteAtOctave(n)}
                className="glass-pill flex min-w-[50px] flex-col items-center border-white/10 bg-white/5 px-4 py-2"
              >
                <span className="text-[8px] font-black uppercase opacity-40">{i + 1}</span>
                <span className="text-sm font-black">{n}</span>
                <span className="text-[8px] font-bold uppercase text-[var(--color-brass)]/70">{intervalName(scaleRoot, n)}</span>
              </button>
            ))}
          </div>
          <div className="relative z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <Search className="h-3 w-3" />
            {scaleRoot} {scaleType} · {scaleNotes.length} notes
          </div>
        </div>

        <div className="panel relative space-y-5 overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-6 backdrop-blur-md group">
          <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-30">
            <Sparkles className="h-24 w-24" />
          </div>
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="glass-pill bg-[var(--color-berry)]/10 p-2 text-[var(--color-berry)]">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Chord Constructor</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {inversion === 0 ? "Root position" : `Inversion ${inversion}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={inversion}
                onChange={(e) => setInversion(Number(e.target.value))}
                className="field !w-auto !px-2 !py-1 text-[10px]"
                aria-label="Chord inversion"
              >
                {Array.from({ length: Math.max(1, CHORDS[chordType].length) }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? "Root" : `${i}${i === 1 ? "st" : i === 2 ? "nd" : "rd"} inv.`}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setHighlightMode("chord"); playKeyboardNotes(getAudioContext(), chordFrequencies, keyboardVoice, 90); }}
                className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all hover:bg-[var(--color-berry)] hover:text-black"
              >
                <Play className="mr-1 inline h-3 w-3 fill-current" /> Arpeggiate
              </button>
            </div>
          </div>
          <div className="relative z-10 flex gap-2">
            <select
              value={chordRoot}
              onChange={(e) => { setChordRoot(e.target.value); setInversion(0); }}
              className="field flex-1"
            >
              {CHROMATIC.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={chordType}
              onChange={(e) => { setChordType(e.target.value); setInversion(0); }}
              className="field flex-[2]"
            >
              {Object.keys(CHORDS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="relative z-10 flex flex-wrap gap-2">
            {chordNotes.map((n, i) => (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => playNoteAtOctave(n)}
                className={`glass-pill flex min-w-[50px] flex-col items-center border-white/10 bg-white/5 px-4 py-2 ${
                  i === 0 ? "!border-[var(--color-berry)]" : ""
                }`}
              >
                <span className="text-[8px] font-black uppercase opacity-40">
                  {i === 0 ? "Bass" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
                </span>
                <span className="text-sm font-black">{n}</span>
                <span className="text-[8px] font-bold uppercase text-[var(--color-berry)]/70">{intervalName(chordRoot, n)}</span>
              </button>
            ))}
          </div>
          <div className="relative z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            <RotateCcw className="h-3 w-3" />
            Tap a note chip to hear it
          </div>
        </div>
      </div>

      <div className="panel rounded-[2.5rem] border border-white/5 bg-zinc-950/60 p-8 backdrop-blur-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest opacity-40">Diatonic chords · {scaleRoot} {scaleType}</h4>
            <p className="text-xs font-bold text-zinc-500">
              Triads built from every degree of the scale. Click one to load it into the Chord Constructor and hear it.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-2">
          {diatonicTriads(scaleNotes).map((triad, degree) => {
            const quality = triadQuality(triad[0], triad[1], triad[2]);
            const chordTypeName = quality === "M" ? "Major" : quality === "m" ? "Minor" : quality === "dim" ? "Diminished" : quality === "aug" ? "Augmented" : "";
            return (
              <button
                key={`${triad.join("-")}-${degree}`}
                type="button"
                onClick={() => {
                  if (chordTypeName) {
                    setChordRoot(triad[0]);
                    setChordType(chordTypeName);
                    setInversion(0);
                  }
                  setHighlightMode("chord");
                  playKeyboardNotes(getAudioContext(), triad.map((n) => noteFrequency(n, keyboardOctave)), keyboardVoice, 90);
                }}
                className="glass-pill flex flex-col items-start border-white/10 bg-white/5 px-4 py-2 transition hover:border-[var(--color-berry)]"
                title={triad.join(" ")}
              >
                <span className="text-[10px] font-black uppercase text-[var(--color-berry)]">{romanNumeral(degree, quality)}</span>
                <span className="text-sm font-black">{triad[0]}{quality === "m" ? "m" : quality === "dim" ? "°" : quality === "aug" ? "+" : ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel rounded-[2.5rem] border border-white/5 bg-zinc-950/60 p-8 backdrop-blur-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <h4 className="text-sm font-black uppercase tracking-widest opacity-40">Interactive Master Keyboard</h4>
            <p className="text-xs font-bold text-zinc-500">
              Highlighting: <span className="uppercase text-[var(--color-copper)]">{highlightMode}</span>
              {" · "}
              {KEYBOARD_VOICES.find((item) => item.id === keyboardVoice)?.label}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setHighlightMode(highlightMode === "scale" ? "none" : "scale")}
              className={`rounded-full border px-3 py-1 text-[10px] font-black transition-all ${
                highlightMode === "scale"
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white shadow-lg"
                  : "border-white/10 opacity-40 hover:opacity-100"
              }`}
            >
              Scale mode
            </button>
            <button
              type="button"
              onClick={() => setHighlightMode(highlightMode === "chord" ? "none" : "chord")}
              className={`rounded-full border px-3 py-1 text-[10px] font-black transition-all ${
                highlightMode === "chord"
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white shadow-lg"
                  : "border-white/10 opacity-40 hover:opacity-100"
              }`}
            >
              Chord mode
            </button>
          </div>
        </div>

        <PianoKeyboard
          activeNotes={activeNotes}
          startOctave={keyboardOctave}
          voice={keyboardVoice}
          onVoiceChange={setKeyboardVoice}
          showInstrumentSelector
          onNotePlay={(note, frequency) => {
            const midi = 69 + 12 * Math.log2(frequency / 440);
            setKeyboardOctave(Math.max(1, Math.min(6, Math.floor(midi / 12) - 1)));
            playFrequency(frequency);
          }}
        />
      </div>
    </div>
  );
}
