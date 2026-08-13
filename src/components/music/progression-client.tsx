"use client";

import { useState } from "react";
import { Plus, Trash2, PlayCircle, Music, Layers, Zap, Download } from "lucide-react";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useAudio } from "@/components/music/audio-provider";
import { toast } from "sonner";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITIES = ["Maj", "min", "7", "maj7", "min7", "dim", "sus4", "sus2", "aug", "dim7"];
const ROMAN_NUMERALS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const DEGREE_ROOTS = [0, 2, 4, 5, 7, 9, 11];
const FUNCTIONS: Record<string, string> = {
  I: "Tonic",
  IV: "Subdominant",
  V: "Dominant",
  vi: "Tonic (rel.)",
  ii: "Subdominant (rel.)",
  iii: "Tonic (rel.)",
  "vii°": "Dominant (rel.)",
};

const PRESETS: { name: string; chords: Array<{ root: string; quality: string }> }[] = [
  { name: "I-IV-V", chords: [{ root: "C", quality: "Maj" }, { root: "F", quality: "Maj" }, { root: "G", quality: "Maj" }] },
  { name: "ii-V-I", chords: [{ root: "D", quality: "min" }, { root: "G", quality: "7" }, { root: "C", quality: "Maj" }] },
  { name: "vi-IV-I-V", chords: [{ root: "A", quality: "min" }, { root: "F", quality: "Maj" }, { root: "C", quality: "Maj" }, { root: "G", quality: "Maj" }] },
  { name: "Doo-wop", chords: [{ root: "C", quality: "Maj" }, { root: "A", quality: "min" }, { root: "F", quality: "Maj" }, { root: "G", quality: "Maj" }] },
];

interface Chord {
  id: string;
  root: string;
  quality: string;
}

function analyzeChord(chord: Chord, keyRoot: string): { numeral: string; functionLabel: string } | null {
  const keyIndex = NOTES.indexOf(keyRoot);
  const chordIndex = NOTES.indexOf(chord.root);
  if (keyIndex === -1 || chordIndex === -1) return null;

  const distance = (chordIndex - keyIndex + 12) % 12;
  let degreeIndex = -1;
  for (let i = 0; i < DEGREE_ROOTS.length; i += 1) {
    if ((DEGREE_ROOTS[i] - distance + 12) % 12 === 0 || (distance - DEGREE_ROOTS[i] + 12) % 12 === 0) {
      degreeIndex = i;
      break;
    }
  }
  if (degreeIndex === -1) return null;

  const numeral = ROMAN_NUMERALS[degreeIndex];
  const quality = chord.quality.replace(/[0-9]/g, "").toLowerCase();
  const isMinorLike = quality.startsWith("min") || quality.startsWith("dim");
  const rendered = isMinorLike && numeral === numeral.toLowerCase()
    ? numeral
    : !isMinorLike && numeral !== numeral.toUpperCase()
      ? numeral.toUpperCase()
      : numeral;

  return {
    numeral: rendered,
    functionLabel: FUNCTIONS[rendered] || "",
  };
}

export function ProgressionClient() {
  const { getAudioContext } = useAudio();
  const [progression, setProgression] = useState<Chord[]>([]);
  const [root, setRoot] = useState("C");
  const [quality, setQuality] = useState("Maj");
  const [keyRoot, setKeyRoot] = useState("C");
  const [bpm, setBpm] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);

  const playNote = (freq: number, startTime: number, delay: number, duration = 1.5) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, startTime + delay);
    gain.gain.setValueAtTime(0, startTime + delay);
    gain.gain.linearRampToValueAtTime(0.08, startTime + delay + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime + delay);
    osc.stop(startTime + delay + duration);
  };

  const playChord = (chord: Chord, delay = 0) => {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime + delay;
    const baseFreq = 261.63 * Math.pow(2, (NOTES.indexOf(chord.root) - 0) / 12);
    
    const intervals: Record<string, number[]> = {
      "Maj": [0, 4, 7], "min": [0, 3, 7], "7": [0, 4, 7, 10], "maj7": [0, 4, 7, 11],
      "min7": [0, 3, 7, 10], "dim": [0, 3, 6], "sus4": [0, 5, 7]
    };

    intervals[chord.quality]?.forEach((interval, idx) => {
      playNote(baseFreq * Math.pow(2, interval / 12), startTime, idx * 0.02);
    });
  };

  const playProgression = () => {
    if (progression.length === 0) return;
    setIsPlaying(true);
    const beatMs = 60000 / bpm;
    progression.forEach((chord, idx) => {
      setTimeout(() => {
        playChord(chord);
        if (idx === progression.length - 1) {
          setIsPlaying(false);
        }
      }, idx * beatMs);
    });
  };

  const addChord = (chord: Chord) => {
    setProgression([...progression, chord]);
  };

  const addChordFromRoot = () => {
    addChord({ id: crypto.randomUUID(), root, quality });
  };

  const applyPreset = (preset: { name: string; chords: Array<{ root: string; quality: string }> }) => {
    setProgression(preset.chords.map((c) => ({ id: crypto.randomUUID(), root: c.root, quality: c.quality })));
    toast.success(`Loaded ${preset.name}`);
  };

  const exportProgression = () => {
    const blob = new Blob([JSON.stringify({ key: keyRoot, bpm, chords: progression }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "progression.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Progression exported");
  };

  return (
    <div className="space-y-4">
      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 backdrop-blur-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="glass-pill p-2 text-[var(--color-brass)] bg-[var(--color-brass)]/10">
               <Layers className="h-4 w-4" />
             </div>
             <h3 className="text-lg font-black tracking-tight">Progression Sequence</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none"
              aria-label="Playback tempo"
            >
              {[40, 50, 60, 70, 80, 90, 100, 120, 140].map((tempo) => (
                <option key={tempo} value={tempo}>{tempo} BPM</option>
              ))}
            </select>
            <button
              disabled={progression.length === 0}
              onClick={playProgression}
              className="flex items-center gap-2 glass-pill px-4 py-1.5 bg-[var(--color-copper)] text-white text-[10px] font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
            >
              <PlayCircle className="h-4 w-4" />
              {isPlaying ? "PLAYING..." : `PLAY @ ${bpm} BPM`}
            </button>
            <button
              onClick={exportProgression}
              disabled={progression.length === 0}
              className="flex items-center gap-2 glass-pill px-3 py-1.5 text-[10px] font-black opacity-80 hover:opacity-100 transition-all disabled:opacity-30"
            >
              <Download className="h-3.5 w-3.5" />
              EXPORT
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 min-h-[100px] p-4 rounded-2xl bg-black/20 border border-white/5 border-dashed">
          {progression.map((chord, idx) => {
            const analysis = analyzeChord(chord, keyRoot);
            return (
              <div 
                key={chord.id} 
                className="group relative flex flex-col items-center justify-center h-24 w-16 rounded-xl glass-pill bg-zinc-900/50 border border-white/5 hover:border-[var(--color-brass)] transition-all cursor-pointer"
                onClick={() => playChord(chord)}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); setProgression(progression.filter(c => c.id !== chord.id)); }}
                  className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all scale-75"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                <span className="text-lg font-black leading-none">{chord.root}</span>
                <span className="text-[8px] font-bold text-[var(--color-brass)] uppercase">{chord.quality}</span>
                {analysis ? (
                  <span className="mt-1 text-[8px] font-black text-[var(--color-mint)]" title={analysis.functionLabel}>
                    {analysis.numeral} · {analysis.functionLabel.split(" ")[0]}
                  </span>
                ) : (
                  <span className="mt-1 text-[8px] font-bold text-zinc-600">#{idx + 1}</span>
                )}
              </div>
            );
          })}
          <button 
            onClick={() => setProgression([...progression, { id: crypto.randomUUID(), root, quality }])}
            className="h-24 w-16 rounded-xl flex items-center justify-center border border-dashed border-zinc-700 hover:border-zinc-500 transition-all"
          >
            <Plus className="h-5 w-5 text-zinc-600" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <select value={keyRoot} onChange={(e) => setKeyRoot(e.target.value)} className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none">
                {NOTES.map(n => <option key={n} value={n}>Key: {n}</option>)}
            </select>
            <select value={root} onChange={(e) => setRoot(e.target.value)} className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none">
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none">
                {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <div className="text-[10px] text-zinc-500 font-bold uppercase ml-2">Click + to add, click a chord to preview</div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-widest opacity-40">Presets</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-brass)] hover:text-black transition-all"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-6 rounded-[2.5rem] bg-gradient-to-b from-zinc-900/40 to-transparent border border-white/5">
         <PianoKeyboard 
           onNotePlay={(note) => { 
             setRoot(note);
             playChord({ id: "preview", root: note, quality });
           }} 
         />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
         <div className="panel p-4 rounded-2xl border-l-[3px] border-l-[var(--color-mint)] flex items-center gap-4">
            <Zap className="h-5 w-5 text-[var(--color-mint)]" />
            <div>
              <h4 className="text-xs font-black uppercase">Smart Suggestions</h4>
              <p className="text-[10px] text-[var(--color-sand-2)]">Try adding a <button onClick={() => setRoot(NOTES[(NOTES.indexOf(root)+7)%12])} className="underline text-[var(--color-brass)]">Dominant (V)</button> or <button onClick={() => setRoot(NOTES[(NOTES.indexOf(root)+5)%12])} className="underline text-[var(--color-brass)]">Subdominant (IV)</button>.</p>
            </div>
         </div>
         <div className="panel p-4 rounded-2xl border-l-[3px] border-l-fuchsia-500 flex items-center gap-4">
            <Music className="h-5 w-5 text-fuchsia-500" />
            <div>
              <h4 className="text-xs font-black uppercase">Voice Leading</h4>
              <p className="text-[10px] text-[var(--color-sand-2)]">Automated smooth transitions between chord inversions (Coming Soon).</p>
            </div>
         </div>
      </div>
    </div>
  );
}
