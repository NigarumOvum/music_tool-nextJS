import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useEffect, useRef, useState } from "react";
import { Music, Search } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALES = { "Major": [0, 2, 4, 5, 7, 9, 11], "Minor": [0, 2, 3, 5, 7, 8, 10], "Dorian": [0, 2, 3, 5, 7, 9, 10], "Phrygian": [0, 1, 3, 5, 7, 8, 10], "Lydian": [0, 2, 4, 6, 7, 9, 11], "Mixolydian": [0, 2, 4, 5, 7, 9, 10], "Aeolian": [0, 2, 3, 5, 7, 8, 10], "Locrian": [0, 1, 3, 5, 6, 8, 10] };
const CHORDS = { "Major": [0, 4, 7], "Minor": [0, 3, 7], "Diminished": [0, 3, 6], "Augmented": [0, 4, 8], "Major 7": [0, 4, 7, 11], "Minor 7": [0, 3, 7, 10], "Dominant 7": [0, 4, 7, 10] };

export function TheoryLabClient() {
  const { getAudioContext } = useAudio();
  const [root, setRoot] = useState("C");

  const playNote = (note: string, offset = 0) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Simple frequency calculation
    const index = NOTES.indexOf(note);
    const freq = 261.63 * Math.pow(2, index / 12); // Starting from C4

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  };

  const getNotes = (intervals: number[]) => {
    const rootIndex = NOTES.indexOf(root);
    return intervals.map((interval) => NOTES[(rootIndex + interval) % NOTES.length]);
  };

  const scaleNotes = getNotes(SCALES[scaleType]);
  const chordNotes = getNotes(CHORDS[chordType]);

  const playNotes = (notes: string[]) => {
    notes.forEach((n, i) => {
      setTimeout(() => playNote(n), i * 150);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scale Explorer */}
        <div className="panel p-5 rounded-3xl space-y-4 border border-white/5 bg-zinc-900/20 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-pill p-2 text-[var(--color-brass)] bg-[var(--color-brass)]/10">
                <Search className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Scale Explorer</h3>
            </div>
            <button onClick={() => playNotes(scaleNotes)} className="glass-pill px-3 py-1 text-[10px] font-bold hover:bg-white hover:text-black transition-all">PLAY ALL</button>
          </div>

          <div className="flex gap-2">
            <select
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="glass-pill px-3 py-2 text-xs font-bold border-none outline-none flex-1"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value as any)}
                className="glass-pill px-3 py-2 text-xs font-bold border-none outline-none flex-[2]"
              >
                {Object.keys(SCALES).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {scaleNotes.map((note, idx) => (
              <button 
                key={idx} 
                onClick={() => playNote(note)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/50 text-xs font-black border border-white/5 hover:border-[var(--color-brass)] hover:bg-[var(--color-brass)] hover:text-black transition-all"
              >
                {note}
              </button>
            ))}
          </div>
        </div>

        {/* Chord Dictionary */}
        <div className="panel p-5 rounded-3xl space-y-4 border border-white/5 bg-zinc-900/20 backdrop-blur-sm">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-pill p-2 text-[var(--color-berry)] bg-[var(--color-berry)]/10">
                <Music className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Chord Finder</h3>
            </div>
            <button onClick={() => playNotes(chordNotes)} className="glass-pill px-3 py-1 text-[10px] font-bold hover:bg-white hover:text-black transition-all">PLAY ALL</button>
          </div>

          <div className="flex gap-2">
            <select
                value={root}
                onChange={(e) => setRoot(e.target.value)}
                className="glass-pill px-3 py-2 text-xs font-bold border-none outline-none flex-1"
              >
                {NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select
                value={chordType}
                onChange={(e) => setChordType(e.target.value as any)}
                className="glass-pill px-3 py-2 text-xs font-bold border-none outline-none flex-[2]"
              >
                {Object.keys(CHORDS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {chordNotes.map((note, idx) => (
              <button 
                key={idx} 
                onClick={() => playNote(note)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/50 text-xs font-black border border-white/5 hover:border-[var(--color-berry)] hover:bg-[var(--color-berry)] hover:text-black transition-all"
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-6 rounded-[2.5rem] bg-gradient-to-b from-zinc-900/40 to-transparent border border-white/5">
        <div className="mb-4 text-center">
            <span className="eyebrow text-[0.6rem] opacity-50 uppercase tracking-[0.2em]">Interactive Piano</span>
        </div>
        <PianoKeyboard 
          onNotePlay={playNote} 
          activeNotes={scaleNotes} 
        />
      </div>

      {/* Circle bar minimized */}
      <div className="flex flex-wrap items-center justify-center gap-2 py-2 opacity-50 hover:opacity-100 transition-opacity">
          {["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"].map((note) => (
            <button
              key={note}
              onClick={() => setRoot(note)}
              className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter transition-all ${
                root === note 
                  ? "bg-[var(--color-copper)] text-white" 
                  : "glass-pill hover:bg-zinc-800"
              }`}
            >
              {note}
            </button>
          ))}
      </div>
    </div>
  );
}
