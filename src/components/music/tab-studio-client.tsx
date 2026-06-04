"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Download, Play, Plus, Upload, Trash2, Music, Volume2, Save, Square, Settings2, Guitar, Layers } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";
import { parseMidi, MidiEvent } from "@/lib/music/midi-parser";

type TabFile = {
  id: string;
  name: string;
  extension: string;
  preview: string;
  markers: string[];
  size: number;
};

type InstrumentType = "Steel" | "Nylon" | "Bass" | "Overdrive";

interface StringFreq {
  label: string;
  base: number;
}

const GUITAR_STRINGS: StringFreq[] = [
  { label: "e", base: 329.63 },
  { label: "B", base: 246.94 },
  { label: "G", base: 196.00 },
  { label: "D", base: 146.83 },
  { label: "A", base: 110.00 },
  { label: "E", base: 82.41 },
];

const BASS_STRINGS: StringFreq[] = [
  { label: "G", base: 98.00 },
  { label: "D", base: 73.42 },
  { label: "A", base: 55.00 },
  { label: "E", base: 41.20 },
];

export function TabStudioClient() {
  const { getAudioContext } = useAudio();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TabFile[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [instrument, setInstrument] = useState<InstrumentType>("Steel");
  const [strings, setStrings] = useState(GUITAR_STRINGS);
  const [grid, setGrid] = useState(() => GUITAR_STRINGS.map(s => ({ label: s.label, cells: Array.from({ length: 16 }, () => "-") })));
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playhead, setPlayhead] = useState(-1);
  const [metronome, setMetronome] = useState(false);

  useEffect(() => {
    if (instrument === "Bass") {
      setStrings(BASS_STRINGS);
      setGrid(BASS_STRINGS.map(s => ({ label: s.label, cells: Array.from({ length: grid[0]?.cells.length || 16 }, () => "-") })));
    } else {
      setStrings(GUITAR_STRINGS);
      setGrid(GUITAR_STRINGS.map(s => ({ label: s.label, cells: Array.from({ length: grid[0]?.cells.length || 16 }, () => "-") })));
    }
  }, [instrument]);

  const createOverdriveCurve = () => {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0 ; i < n_samples; ++i ) {
      const x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + 20 ) * x * 20 * deg / ( Math.PI + 20 * Math.abs(x) );
    }
    return curve;
  };

  const playPluck = (fret: number, stringIdx: number, time: number) => {
    if (fret < 0 || isNaN(fret)) return;
    const ctx = getAudioContext();
    const freq = strings[stringIdx].base * Math.pow(2, fret / 12);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, time);

    if (instrument === "Overdrive") {
      const shaper = ctx.createWaveShaper();
      shaper.curve = createOverdriveCurve();
      shaper.oversample = "4x";
      masterGain.connect(shaper);
      shaper.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Synthesis based on type
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    if (instrument === "Nylon") {
      osc.type = "sine";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    } else if (instrument === "Bass") {
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 2.0);
      
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(freq / 2, time);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.1, time);
      subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start(time);
      sub.stop(time + 1.5);
    } else {
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
    }

    osc.frequency.setValueAtTime(freq, time);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 2.0);
  };

  useEffect(() => {
    if (isPlaying) {
      let currentStep = 0;
      const stepDuration = (60 / bpm) / 4;
      
      const playNextStep = () => {
        if (!isPlaying) return;
        const ctx = getAudioContext();
        setPlayhead(currentStep);

        grid.forEach((row, sIdx) => {
          const cell = row.cells[currentStep];
          if (cell !== "-" && cell !== "") playPluck(parseInt(cell), sIdx, ctx.currentTime);
        });

        currentStep++;
        if (currentStep < grid[0].cells.length) {
          setTimeout(playNextStep, stepDuration * 1000);
        } else {
          setIsPlaying(false);
          setPlayhead(-1);
        }
      };
      playNextStep();
    }
  }, [isPlaying]);

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList) return;
    const file = fileList[0];
    if (file.name.endsWith(".mid") || file.name.endsWith(".midi")) {
      const buffer = await file.arrayBuffer();
      const events = parseMidi(buffer);
      
      // Basic MIDI to Tab translation (just for demo/starting point)
      // We map the first 16 ticks or similar to the first 4 measures
      const newGrid = strings.map(s => ({ label: s.label, cells: Array.from({ length: 64 }, () => "-") }));
      
      events.forEach(ev => {
        if (ev.type === "noteOn" && ev.note) {
          const tickStep = Math.floor(ev.time / 120); // Assumed 480 PPQ for now
          if (tickStep < 64) {
             // Find closest string
             let bestString = 0;
             let minDiff = 100;
             strings.forEach((s, i) => {
                const fret = ev.note! - (21 + (i * 5)); // very loose mock
                if (fret >= 0 && fret < 24 && fret < minDiff) {
                   minDiff = fret;
                   bestString = i;
                }
             });
             newGrid[bestString].cells[tickStep] = String(Math.max(0, ev.note - 40));
          }
        }
      });
      setGrid(newGrid);
    } else {
      // Normal text tab import...
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Toolbar */}
      <div className="panel p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-zinc-900/40 backdrop-blur-md">
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${isPlaying ? "bg-red-500 text-white shadow-lg" : "bg-[var(--color-mint)] text-black shadow-lg"}`}
            >
              {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
            <div className="flex flex-col">
               <span className="text-[10px] font-black opacity-40 uppercase">Instrument</span>
               <select 
                value={instrument} 
                onChange={(e) => setInstrument(e.target.value as any)}
                className="bg-transparent border-none p-0 text-xs font-black text-[var(--color-mint)] focus:ring-0 outline-none"
               >
                 <option value="Steel">Steel String</option>
                 <option value="Nylon">Nylon String</option>
                 <option value="Bass">Electric Bass</option>
                 <option value="Overdrive">Overdrive Elec</option>
               </select>
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black opacity-40 uppercase">BPM</span>
               <input type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="bg-transparent border-none p-0 w-12 text-lg font-black text-white" />
            </div>
         </div>

         <div className="flex gap-2">
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleImport(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black">Import MIDI/Tab</button>
         </div>
      </div>

      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 space-y-8 overflow-hidden min-h-[400px]">
         <div className="relative">
            <div className="absolute inset-y-0 left-0 w-8 flex flex-col justify-between py-[2px] z-20 bg-zinc-900/80 backdrop-blur-md rounded-l-lg border-r border-white/10">
               {strings.map(s => <span key={s.label} className="h-8 flex items-center justify-center text-xs font-black text-[var(--color-sand-2)]">{s.label}</span>)}
            </div>
            <div className="pl-8 overflow-x-auto">
               <div className="flex min-w-max relative pb-8">
                  {grid[0].cells.map((_, cIdx) => (
                    <div key={cIdx} className={`w-10 relative flex flex-col justify-between transition-colors ${playhead === cIdx ? "bg-[var(--color-mint)]/20" : "hover:bg-white/5"}`}>
                       {grid.map((row, rIdx) => (
                         <div key={rIdx} className="h-8 flex items-center justify-center">
                            <input 
                               className={`w-7 h-7 rounded-md text-center text-xs font-black outline-none border ${row.cells[cIdx] === "-" ? "bg-transparent border-transparent text-zinc-700" : "bg-white text-black border-white"}`}
                               value={row.cells[cIdx] === "-" ? "" : row.cells[cIdx]}
                               onChange={(e) => setGrid(grid.map((r, i) => i === rIdx ? { ...r, cells: r.cells.map((c, j) => j === cIdx ? e.target.value.replace(/[^0-9]/g, "") || "-" : c) } : r))}
                               placeholder="-"
                            />
                         </div>
                       ))}
                    </div>
                  ))}
               </div>
            </div>
            {playhead !== -1 && (
               <div className="absolute top-0 bottom-8 w-[2px] bg-[var(--color-mint)] z-30 pointer-events-none transition-all ml-8" style={{ left: `${playhead * 40}px` }} />
            )}
         </div>
      </div>
    </div>
  );
}