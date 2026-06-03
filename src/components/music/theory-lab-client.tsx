"use client";

import { useState } from "react";
import { Music, Search, Info } from "lucide-react";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

const CHORDS = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  "Major 7": [0, 4, 7, 11],
  "Minor 7": [0, 3, 7, 10],
  Dominant: [0, 4, 7, 10],
  Diminished: [0, 3, 6],
};

export function TheoryLabClient() {
  const [root, setRoot] = useState("C");
  const [scaleType, setScaleType] = useState<keyof typeof SCALES>("Major");
  const [chordType, setChordType] = useState<keyof typeof CHORDS>("Major");

  const getNotes = (intervals: number[]) => {
    const rootIndex = NOTES.indexOf(root);
    return intervals.map((interval) => NOTES[(rootIndex + interval) % NOTES.length]);
  };

  const scaleNotes = getNotes(SCALES[scaleType]);
  const chordNotes = getNotes(CHORDS[chordType]);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scale Explorer */}
        <div className="panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-brass)]">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Scale Explorer</h3>
              <p className="text-xs text-[var(--color-sand-2)] uppercase tracking-wider">Note Calculator</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[var(--color-sand-2)] px-1">Root</label>
              <select
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="glass-pill w-full px-4 py-2 text-sm font-semibold border-none outline-none ring-0 focus:ring-1 focus:ring-[var(--color-brass)]"
              >
                {NOTES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-[10px] uppercase font-bold text-[var(--color-sand-2)] px-1">Scale Type</label>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value as any)}
                className="glass-pill w-full px-4 py-2 text-sm font-semibold border-none outline-none ring-0 focus:ring-1 focus:ring-[var(--color-brass)]"
              >
                {Object.keys(SCALES).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-pill p-4 rounded-2xl">
            <div className="flex flex-wrap gap-2">
              {scaleNotes.map((note, idx) => (
                <div key={idx} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-sm font-bold border border-[var(--color-surface-brighter)]">
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chord Dictionary */}
        <div className="panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-berry)]">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Chord Finder</h3>
              <p className="text-xs text-[var(--color-sand-2)] uppercase tracking-wider">Interval Harmony</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-[var(--color-sand-2)] px-1">Root</label>
              <select
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="glass-pill w-full px-4 py-2 text-sm font-semibold border-none outline-none ring-0 focus:ring-1 focus:ring-[var(--color-berry)]"
              >
                {NOTES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-[10px] uppercase font-bold text-[var(--color-sand-2)] px-1">Chord Quality</label>
              <select
                value={chordType}
                onChange={(e) => setChordType(e.target.value as any)}
                className="glass-pill w-full px-4 py-2 text-sm font-semibold border-none outline-none ring-0 focus:ring-1 focus:ring-[var(--color-berry)]"
              >
                {Object.keys(CHORDS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="glass-pill p-4 rounded-2xl">
            <div className="flex flex-wrap gap-3">
              {chordNotes.map((note, idx) => (
                <div key={idx} className="flex flex-col items-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-base font-black text-[var(--color-foreground)] border-2 border-[var(--color-berry)] shadow-[0_0_15px_rgba(var(--color-berry-rgb),0.2)]">
                    {note}
                  </div>
                  <span className="text-[9px] mt-1 font-bold text-[var(--color-sand-2)]">{idx === 0 ? "Root" : idx === 1 ? "3rd" : idx === 2 ? "5th" : "7th"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Circle of Fifths Visualization (Simplified) */}
      <div className="panel p-8 rounded-3xl space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-black">Circle of Fifths Reference</h3>
          <p className="text-sm text-[var(--color-sand-2)] max-w-md mx-auto">Click a key to explore its neighboring harmonies and relative minor.</p>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].map((note) => (
            <button
              key={note}
              onClick={() => setRoot(note)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                root === note 
                  ? "bg-[var(--color-copper)] text-white shadow-lg scale-105" 
                  : "glass-pill hover:bg-[var(--color-surface-strong)]"
              }`}
            >
              <span className="text-lg font-black">{note}</span>
              <span className="text-[10px] opacity-70">Maj</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
