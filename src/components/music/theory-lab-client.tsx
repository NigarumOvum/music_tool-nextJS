"use client";

import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useState } from "react";
import { Music, Search, Play, Book, Sparkles, Layers, RotateCcw } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES: Record<string, number[]> = {
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Minor": [0, 2, 3, 5, 7, 8, 10],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Phrygian": [0, 1, 3, 5, 7, 8, 10],
  "Lydian": [0, 2, 4, 6, 7, 9, 11],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10],
  "Aeolian": [0, 2, 3, 5, 7, 8, 10],
  "Locrian": [0, 1, 3, 5, 6, 8, 10],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  "Blues": [0, 3, 5, 6, 7, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
};
const CHORDS: Record<string, number[]> = {
  "Major": [0, 4, 7],
  "Minor": [0, 3, 7],
  "Diminished": [0, 3, 6],
  "Augmented": [0, 4, 8],
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
  "add9": [0, 4, 7, 14],
  "sus2": [0, 2, 7],
  "sus4": [0, 5, 7],
};

type ChordNotePitch = { label: string; pitch: number };

function invertNotes(notes: string[], inversion: number): ChordNotePitch[] {
  // Start with the root-position notes in pitch space (all within one octave).
  const base: ChordNotePitch[] = notes.map((note) => ({
    label: note,
    pitch: NOTES.indexOf(note),
  }));

  if (inversion === 0) {
    return base;
  }

  // Rotate the list so the chosen degree becomes the bass note.
  const offset = inversion % notes.length;
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];

  // Normalize spans so each note sits close to the previous one (compressed voicing).
  const result: ChordNotePitch[] = [];
  for (const entry of rotated) {
    const pitch = entry.pitch;
    if (result.length === 0) {
      result.push({ label: entry.label, pitch });
      continue;
    }

    const prev = result[result.length - 1].pitch;
    // Raise the current note up by octaves until it is within a seventh of the previous note.
    let adjusted = pitch;
    while (adjusted < prev) {
      adjusted += 12;
    }
    while (adjusted - 12 >= prev) {
      adjusted -= 12;
    }
    result.push({ label: entry.label, pitch: adjusted });
  }
  return result;
}

export function TheoryLabClient() {
  const { getAudioContext } = useAudio();
  const [scaleRoot, setScaleRoot] = useState("C");
  const [chordRoot, setChordRoot] = useState("C");
  const [scaleType, setScaleType] = useState<string>("Major");
  const [chordType, setChordType] = useState<string>("Major");
  const [inversion, setInversion] = useState(0);
  const [highlightMode, setHighlightMode] = useState<"scale" | "chord" | "none">("scale");

  const playNoteAt = (note: string, freq: number) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq * 2, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    sub.start();
    osc.stop(ctx.currentTime + 1.3);
    sub.stop(ctx.currentTime + 1.3);
  };

  const playNote = (note: string) => {
    const index = NOTES.indexOf(note);
    const freq = 261.63 * Math.pow(2, index / 12);
    playNoteAt(note, freq);
  };

  const getNotes = (root: string, intervals: number[]) => {
    const rootIndex = NOTES.indexOf(root);
    return intervals.map((interval) => NOTES[(rootIndex + interval) % NOTES.length]);
  };

  const scaleNotes = getNotes(scaleRoot, SCALES[scaleType]);
  const chordNotes = invertNotes(getNotes(chordRoot, CHORDS[chordType]), inversion).map((entry) => entry.label);

  const activeNotes = highlightMode === "scale" ? scaleNotes : highlightMode === "chord" ? chordNotes : [];

  const playNotes = (notes: string[]) => {
    notes.forEach((n, i) => {
      setTimeout(() => playNote(n), i * 180);
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scale Explorer */}
        <div className="panel p-6 rounded-3xl space-y-5 border border-white/5 bg-zinc-900/40 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <Book className="h-24 w-24" />
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="glass-pill p-2 text-[var(--color-brass)] bg-[var(--color-brass)]/10">
                <Music className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase">Scale Explorer</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Modal Analysis Active</p>
              </div>
            </div>
            <button
              onClick={() => { setHighlightMode("scale"); playNotes(scaleNotes); }}
              className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-brass)] hover:text-black transition-all shadow-lg"
            >
              <Play className="h-3 w-3 mr-1 inline fill-current" /> Play Scale
            </button>
          </div>

          <div className="flex gap-2 relative z-10">
            <select
              value={scaleRoot}
              onChange={(e) => setScaleRoot(e.target.value)}
              className="field flex-1"
            >
              {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={scaleType}
              onChange={(e) => setScaleType(e.target.value)}
              className="field flex-[2]"
            >
              {Object.keys(SCALES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 relative z-10">
            {scaleNotes.map((n, i) => (
              <div key={`${n}-${i}`} className="glass-pill px-4 py-2 flex flex-col items-center min-w-[50px] border-white/10 bg-white/5">
                <span className="text-[8px] font-black opacity-40 uppercase">{i + 1}</span>
                <span className="text-sm font-black">{n}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 relative z-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <Search className="h-3 w-3" />
            {scaleRoot} {scaleType} • {scaleNotes.length} notes
          </div>
        </div>

        {/* Chord Constructor */}
        <div className="panel p-6 rounded-3xl space-y-5 border border-white/5 bg-zinc-900/40 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <Sparkles className="h-24 w-24" />
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="glass-pill p-2 text-[var(--color-berry)] bg-[var(--color-berry)]/10">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase">Chord Constructor</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  {inversion === 0 ? "Root Position" : `Inversion ${inversion}`}
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
                onClick={() => { setHighlightMode("chord"); playNotes(chordNotes); }}
                className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-berry)] hover:text-black transition-all shadow-lg"
              >
                <Play className="h-3 w-3 mr-1 inline fill-current" /> Arpeggiate
              </button>
            </div>
          </div>

          <div className="flex gap-2 relative z-10">
            <select
              value={chordRoot}
              onChange={(e) => { setChordRoot(e.target.value); setInversion(0); }}
              className="field flex-1"
            >
              {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
              value={chordType}
              onChange={(e) => { setChordType(e.target.value); setInversion(0); }}
              className="field flex-[2]"
            >
              {Object.keys(CHORDS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 relative z-10">
            {chordNotes.map((n, i) => (
              <div
                key={`${n}-${i}`}
                className={`glass-pill px-4 py-2 flex flex-col items-center min-w-[50px] border-white/10 bg-white/5 ${
                  i === 0 ? "!border-[var(--color-berry)]" : ""
                }`}
              >
                <span className="text-[8px] font-black opacity-40 uppercase">
                  {i === 0 ? "Bass" : i === 1 ? "2nd" : i === 2 ? "3rd" : i === 3 ? "4th" : `${i + 1}th`}
                </span>
                <span className="text-sm font-black">{n}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 relative z-10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <RotateCcw className="h-3 w-3" />
            Click a note chip to hear it
          </div>
        </div>
      </div>

      {/* Visual Piano Output */}
      <div className="panel p-8 rounded-[2.5rem] border border-white/5 bg-zinc-950/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h4 className="text-sm font-black tracking-widest uppercase opacity-40">Interactive Master Keyboard</h4>
            <p className="text-xs text-zinc-500 font-bold">
              Currently Highlighting: <span className="text-[var(--color-copper)] uppercase">{highlightMode}</span>
              {highlightMode === "chord" && inversion > 0 ? <span className="ml-2 text-[var(--color-berry)]">• {inversion}{inversion === 1 ? "st" : inversion === 2 ? "nd" : "rd"} inversion</span> : null}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setHighlightMode(highlightMode === "scale" ? "none" : "scale")} className={`text-[10px] font-black px-3 py-1 rounded-full border transition-all ${highlightMode === "scale" ? "bg-[var(--color-copper)] border-[var(--color-copper)] text-white shadow-lg" : "border-white/10 opacity-40 hover:opacity-100"}`}>SCALE MODE</button>
            <button onClick={() => setHighlightMode(highlightMode === "chord" ? "none" : "chord")} className={`text-[10px] font-black px-3 py-1 rounded-full border transition-all ${highlightMode === "chord" ? "bg-[var(--color-copper)] border-[var(--color-copper)] text-white shadow-lg" : "border-white/10 opacity-40 hover:opacity-100"}`}>CHORD MODE</button>
          </div>
        </div>
        <div className="mb-3">
          <button
            onClick={() => playNotes(chordNotes)}
            className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-berry)] hover:text-black transition-all"
          >
            <Play className="h-3 w-3 mr-1 inline fill-current" /> Play {chordRoot} {chordType} {inversion > 0 ? `(${inversion} inv.)` : ""}
          </button>
        </div>
        <PianoKeyboard onNotePlay={playNote} activeNotes={activeNotes} />
      </div>
    </div>
  );
}