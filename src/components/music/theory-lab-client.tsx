"use client";

import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useEffect, useRef, useState } from "react";
import { Music, Search, Play, Book, Sparkles } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = { 
  "Major": [0, 2, 4, 5, 7, 9, 11], 
  "Minor": [0, 2, 3, 5, 7, 8, 10], 
  "Dorian": [0, 2, 3, 5, 7, 9, 10], 
  "Phrygian": [0, 1, 3, 5, 7, 8, 10], 
  "Lydian": [0, 2, 4, 6, 7, 9, 11], 
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10], 
  "Aeolian": [0, 2, 3, 5, 7, 8, 10], 
  "Locrian": [0, 1, 3, 5, 6, 8, 10] 
};
const CHORDS = { 
  "Major": [0, 4, 7], 
  "Minor": [0, 3, 7], 
  "Diminished": [0, 3, 6], 
  "Augmented": [0, 4, 8], 
  "Major 7": [0, 4, 7, 11], 
  "Minor 7": [0, 3, 7, 10], 
  "Dominant 7": [0, 4, 7, 10] 
};

export function TheoryLabClient() {
  const { getAudioContext } = useAudio();
  const [root, setRoot] = useState("C");
  const [scaleType, setScaleType] = useState<keyof typeof SCALES>("Major");
  const [chordType, setChordType] = useState<keyof typeof CHORDS>("Major");
  const [highlightMode, setHighlightMode] = useState<"scale" | "chord" | "none">("scale");

  const playNote = (note: string) => {
    const ctx = getAudioContext();
    const index = NOTES.indexOf(note);
    const freq = 261.63 * Math.pow(2, index / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Better piano-like synth (two oscillators)
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

  const getNotes = (intervals: number[]) => {
    const rootIndex = NOTES.indexOf(root);
    return intervals.map((interval) => NOTES[(rootIndex + interval) % NOTES.length]);
  };

  const scaleNotes = getNotes(SCALES[scaleType]);
  const chordNotes = getNotes(CHORDS[chordType]);

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
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="field flex-1"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value as any)}
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
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inversion Ready</p>
              </div>
            </div>
            <button 
                onClick={() => { setHighlightMode("chord"); playNotes(chordNotes); }} 
                className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-berry)] hover:text-black transition-all shadow-lg"
            >
                <Play className="h-3 w-3 mr-1 inline fill-current" /> Arpeggiate
            </button>
          </div>

          <div className="flex gap-2 relative z-10">
            <select
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="field flex-1"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
                value={chordType}
                onChange={(e) => setChordType(e.target.value as any)}
                className="field flex-[2]"
              >
                {Object.keys(CHORDS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 relative z-10">
            {chordNotes.map((n, i) => (
              <div key={`${n}-${i}`} className="glass-pill px-4 py-2 flex flex-col items-center min-w-[50px] border-white/10 bg-white/5">
                <span className="text-[8px] font-black opacity-40 uppercase">{i === 0 ? "Root" : i === 1 ? "3rd" : i === 2 ? "5th" : "7th"}</span>
                <span className="text-sm font-black">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visual Piano Output */}
      <div className="panel p-8 rounded-[2.5rem] border border-white/5 bg-zinc-950/60 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-8 px-2">
            <div>
               <h4 className="text-sm font-black tracking-widest uppercase opacity-40">Interactive Master Keyboard</h4>
               <p className="text-xs text-zinc-500 font-bold">Currently Highlighting: <span className="text-[var(--color-copper)] uppercase">{highlightMode}</span></p>
            </div>
            <div className="flex gap-3">
               <button onClick={() => setHighlightMode(highlightMode === "scale" ? "none" : "scale")} className={`text-[10px] font-black px-3 py-1 rounded-full border transition-all ${highlightMode === "scale" ? "bg-[var(--color-copper)] border-[var(--color-copper)] text-white shadow-lg" : "border-white/10 opacity-40 hover:opacity-100"}`}>SCALE MODE</button>
               <button onClick={() => setHighlightMode(highlightMode === "chord" ? "none" : "chord")} className={`text-[10px] font-black px-3 py-1 rounded-full border transition-all ${highlightMode === "chord" ? "bg-[var(--color-copper)] border-[var(--color-copper)] text-white shadow-lg" : "border-white/10 opacity-40 hover:opacity-100"}`}>CHORD MODE</button>
            </div>
        </div>
        <PianoKeyboard onNotePlay={playNote} activeNotes={activeNotes} />
      </div>
    </div>
  );
}
