"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, PlayCircle, Music, Layers, Zap } from "lucide-react";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const QUALITIES = ["Maj", "min", "7", "maj7", "min7", "dim", "sus4"];

interface Chord {
  id: string;
  root: string;
  quality: string;
}

export function ProgressionClient() {
  const [progression, setProgression] = useState<Chord[]>([]);
  const [root, setRoot] = useState("C");
  const [quality, setQuality] = useState("Maj");
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const addChord = () => {
    setProgression([...progression, { id: crypto.randomUUID(), root, quality }]);
  };

  const removeChord = (id: string) => {
    setProgression(progression.filter((c) => c.id !== id));
  };

  const playChord = (chord: Chord) => {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime;
    
    // Frequency map logic
    const baseFreq = 440 * Math.pow(2, (NOTES.indexOf(chord.root) - 9) / 12);
    
    const intervals: Record<string, number[]> = {
      "Maj": [0, 4, 7],
      "min": [0, 3, 7],
      "7": [0, 4, 7, 10],
      "maj7": [0, 4, 7, 11],
      "min7": [0, 3, 7, 10],
      "dim": [0, 3, 6],
      "sus4": [0, 5, 7],
    };

    const playTone = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime + delay);
      
      gain.gain.setValueAtTime(0, startTime + delay);
      gain.gain.linearRampToValueAtTime(0.15, startTime + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + delay + 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime + delay);
      osc.stop(startTime + delay + 1.5);
    };

    intervals[chord.quality].forEach((interval, idx) => {
      playTone(baseFreq * Math.pow(2, interval / 12), idx * 0.05);
    });
  };

  const playProgression = () => {
    const ctx = getAudioContext();
    progression.forEach((chord, idx) => {
      setTimeout(() => playChord(chord), idx * 1000);
    });
  };

  return (
    <div className="space-y-6">
      <div className="panel p-8 rounded-[3rem] space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="glass-pill p-4 text-[var(--color-brass)] bg-[var(--color-brass)]/10 ring-2 ring-[var(--color-brass)]/20">
              <Layers className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Progression Builder</h3>
              <p className="text-sm text-[var(--color-sand-2)] uppercase font-bold tracking-widest opacity-60">Harmonic Playground</p>
            </div>
          </div>
          
          <button 
            disabled={progression.length === 0}
            onClick={playProgression}
            className="flex items-center gap-2 glass-pill px-8 py-3 bg-[var(--color-copper)] text-white font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
          >
            <PlayCircle className="h-5 w-5" />
            PLAY ALL
          </button>
        </div>

        {/* Builder Interface */}
        <div className="flex flex-wrap items-end gap-4 p-6 rounded-3xl bg-zinc-950/50 border border-zinc-900 border-dashed">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[var(--color-sand-2)] ml-1">Root</label>
            <div className="flex flex-wrap gap-1 max-w-[200px]">
              {["C", "D", "E", "F", "G", "A", "B"].map(n => (
                <button 
                  key={n} 
                  onClick={() => setRoot(n)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${root === n ? "bg-[var(--color-brass)] text-black" : "glass-pill hover:bg-zinc-800"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-[var(--color-sand-2)] ml-1">Quality</label>
            <div className="flex flex-wrap gap-1">
              {QUALITIES.slice(0, 4).map(q => (
                <button 
                  key={q} 
                  onClick={() => setQuality(q)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${quality === q ? "bg-[var(--color-berry)] text-white" : "glass-pill hover:bg-zinc-800"}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={addChord}
            className="h-12 w-12 rounded-2xl flex items-center justify-center bg-white text-black hover:bg-[var(--color-brass)] transition-colors active:scale-90"
          >
            <Plus className="h-6 w-6 stroke-[3px]" />
          </button>
        </div>

        {/* Visualizer */}
        <div className="flex flex-wrap gap-4 min-h-[140px] p-2">
          {progression.map((chord) => (
            <div 
              key={chord.id} 
              className="group relative flex flex-col items-center justify-center h-32 w-28 rounded-3xl glass-pill bg-zinc-900/30 border-2 border-zinc-800 hover:border-[var(--color-brass)] transition-all cursor-pointer overflow-hidden"
              onClick={() => playChord(chord)}
            >
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); removeChord(chord.id); }}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <span className="text-3xl font-black tracking-tighter text-white">{chord.root}</span>
              <span className="text-xs font-bold text-[var(--color-brass)] uppercase">{chord.quality}</span>
              <div className="mt-2 text-[8px] text-[var(--color-sand-2)] opacity-0 group-hover:opacity-100 uppercase tracking-tighter">Click to Play</div>
            </div>
          ))}
          
          {progression.length === 0 && (
            <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-zinc-900 rounded-[2.5rem] py-12 opacity-40">
               <Music className="h-12 w-12 mb-4 text-[var(--color-sand-2)]" />
               <p className="text-sm font-bold uppercase tracking-[0.2em]">Add your first chord to begin</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
         <div className="panel p-6 rounded-3xl border-l-4 border-l-[var(--color-mint)]">
            <h4 className="flex items-center gap-2 text-sm font-black mb-2"><Zap className="h-4 w-4 text-[var(--color-mint)]" /> Pro Mode</h4>
            <p className="text-xs text-[var(--color-sand-2)] leading-relaxed">Sequence complex jazz turnarounds or gospel substitutions in second.</p>
         </div>
         <div className="panel p-6 rounded-3xl border-l-4 border-l-orange-500">
            <h4 className="flex items-center gap-2 text-sm font-black mb-2"><Layers className="h-4 w-4 text-orange-500" /> Layered Theory</h4>
            <p className="text-xs text-[var(--color-sand-2)] leading-relaxed">Visualize voice-leading and common tone relationships instantly.</p>
         </div>
         <div className="panel p-6 rounded-3xl border-l-4 border-l-fuchsia-500">
            <h4 className="flex items-center gap-2 text-sm font-black mb-2"><PlayCircle className="h-4 w-4 text-fuchsia-500" /> Export Flow</h4>
            <p className="text-xs text-[var(--color-sand-2)] leading-relaxed">Export progressions directly to DAW MIDI regions or notation slots.</p>
         </div>
      </div>
    </div>
  );
}
