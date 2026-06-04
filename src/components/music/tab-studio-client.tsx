"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Download, Play, Plus, Upload, Trash2, Music, Volume2, Save, Square, Settings2 } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

type TabFile = {
  id: string;
  name: string;
  extension: string;
  preview: string;
  markers: string[];
  size: number;
};

function extractMarkers(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\[.*\]$|^(verse|chorus|bridge|intro|outro)/i.test(line.trim()))
    .slice(0, 12);
}

const STRINGS = ["e", "B", "G", "D", "A", "E"];

export function TabStudioClient() {
  const { getAudioContext } = useAudio();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TabFile[]>([]);
  const [activeFileId, setActiveFileId] = useState("");
  const [grid, setGrid] = useState(() => STRINGS.map(s => ({ label: s, cells: Array.from({ length: 16 }, () => "-") })));
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playhead, setPlayhead] = useState(-1);
  const [metronome, setMetronome] = useState(false);

  // Plucked String Synthesis (Karplus-Strong-like using Filtered Noise + Waveguide)
  // For a lightweight browser version, we use multiple harmonics + filtered noise
  const playPluck = (fret: number, stringIdx: number, time: number) => {
    if (fret < 0 || isNaN(fret)) return;
    const ctx = getAudioContext();
    
    const baseFreqs = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41];
    const freq = baseFreqs[stringIdx] * Math.pow(2, fret / 12);

    // Fundamental
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, time);
    
    // Noise Burst for the 'Pluck'
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.02; // 20ms burst
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(freq * 2, time);
    
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.02);

    // Main Note Envelope
    gain1.gain.setValueAtTime(0, time);
    gain1.gain.linearRampToValueAtTime(0.2, time + 0.005);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 1.5);

    // Harmonics for "Steel String" feel
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2, time);
    gain2.gain.setValueAtTime(0, time);
    gain2.gain.linearRampToValueAtTime(0.05, time + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.0001, time + 0.8);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    noise.start(time);
    osc1.start(time);
    osc2.start(time);
    
    osc1.stop(time + 1.6);
    osc2.stop(time + 0.9);
  };

  const playClick = (time: number, accent = false) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(accent ? 1200 : 800, time);
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  };

  useEffect(() => {
    if (isPlaying) {
      let currentStep = 0;
      const stepDuration = (60 / bpm) / 4; // 16th notes
      
      const playNextStep = () => {
        if (!isPlaying) return;
        const ctx = getAudioContext();
        setPlayhead(currentStep);

        // Metronome
        if (metronome && currentStep % 4 === 0) {
            playClick(ctx.currentTime, currentStep % 16 === 0);
        }

        // Notes
        grid.forEach((row, sIdx) => {
          const cell = row.cells[currentStep];
          if (cell !== "-" && cell !== "") {
            playPluck(parseInt(cell), sIdx, ctx.currentTime);
          }
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

  const importFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    void Promise.all(Array.from(fileList).map(async (file) => {
      const preview = await file.text().catch(() => "Binary preview unavailable.");
      return {
        id: crypto.randomUUID(),
        name: file.name,
        extension: file.name.split(".").pop()?.toLowerCase() || "",
        preview,
        markers: extractMarkers(preview),
        size: file.size,
      } satisfies TabFile;
    })).then((next) => {
      setFiles((current) => [...current, ...next]);
      if (!activeFileId && next[0]) setActiveFileId(next[0].id);
    });
  };

  return (
    <div className="space-y-4">
      {/* Enhanced Tab Toolbar */}
      <div className="panel p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-zinc-900/40 backdrop-blur-md">
         <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${isPlaying ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-[var(--color-mint)] text-black shadow-lg hover:scale-110"}`}
            >
              {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
            </button>
            
            <div className="flex flex-col">
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black opacity-40 uppercase tracking-widest tabular-nums">BPM</span>
                  <input 
                    type="number" value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
                    className="bg-transparent border-none p-0 w-12 text-lg font-black text-[var(--color-mint)] focus:ring-0 outline-none"
                  />
               </div>
               <div className="flex gap-1">
                  <button onClick={() => setMetronome(!metronome)} className={`text-[8px] font-black px-1.5 py-0.5 rounded border transition-colors ${metronome ? "bg-[var(--color-mint)]/20 border-[var(--color-mint)]/50 text-[var(--color-mint)]" : "border-white/10 opacity-40"}`}>CLICK</button>
                  <button className="text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 opacity-40 uppercase">MIDI OUT</button>
               </div>
            </div>
         </div>

         <div className="flex gap-2">
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />
            <button onClick={() => inputRef.current?.click()} className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">Import File</button>
            <button className="glass-pill px-4 py-2 text-[10px] font-black bg-[var(--color-copper)] text-white uppercase tracking-widest hover:scale-105 transition-transform"><Save className="h-3 w-3 mr-1 inline" /> Save Tab</button>
         </div>
      </div>

      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 space-y-8 overflow-hidden">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="glass-pill p-2 text-[var(--color-copper)] bg-[var(--color-copper)]/10">
                  <Music className="h-4 w-4" />
               </div>
               <div>
                  <h3 className="text-lg font-black tracking-tight">Virtual Scoring Studio</h3>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">High-Fidelity Pluck Synthesis Active</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <div className="text-right">
                  <div className="text-[10px] font-black opacity-40 uppercase">Time Sig</div>
                  <div className="text-xs font-black">4/4</div>
               </div>
               <Settings2 className="h-4 w-4 opacity-20" />
            </div>
         </div>

         {/* Virtual Tablature */}
         <div className="relative">
            <div className="absolute inset-y-0 left-0 w-8 flex flex-col justify-between py-[2px] z-20 bg-zinc-900/80 backdrop-blur-md rounded-l-lg border-r border-white/10">
               {STRINGS.map(s => <span key={s} className="h-8 flex items-center justify-center text-xs font-black text-[var(--color-sand-2)]">{s}</span>)}
            </div>
            
            <div className="pl-8 overflow-x-auto [scrollbar-width:none]">
               <div className="flex min-w-max relative pb-8">
                  {/* Staff Lines */}
                  <div className="absolute inset-x-0 top-[15px] bottom-[47px] flex flex-col justify-between opacity-10 pointer-events-none">
                     {STRINGS.map(s => <div key={s} className="h-[1px] w-full bg-white" />)}
                  </div>

                  {/* Columns */}
                  {grid[0].cells.map((_, cIdx) => (
                    <div key={cIdx} className={`w-10 relative flex flex-col justify-between transition-colors ${playhead === cIdx ? "bg-[var(--color-mint)]/20 shadow-[inset_0_0_10px_var(--color-mint)]" : "hover:bg-white/5"}`}>
                       {grid.map((row, rIdx) => (
                         <div key={rIdx} className="h-8 flex items-center justify-center z-10">
                            <input 
                               className={`w-7 h-7 rounded-md transition-all text-center text-xs font-black outline-none border focus:ring-1 focus:ring-[var(--color-copper)] ${
                                 row.cells[cIdx] === "-" 
                                   ? "bg-transparent border-transparent text-zinc-700 hover:text-zinc-500" 
                                   : "bg-white text-black border-white shadow-xl scale-110 active:scale-95"
                               }`}
                               value={row.cells[cIdx] === "-" ? "" : row.cells[cIdx]}
                               onChange={(e) => {
                                 const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                                 setGrid(grid.map((r, i) => i === rIdx ? { ...r, cells: r.cells.map((c, j) => j === cIdx ? val || "-" : c) } : r));
                               }}
                               placeholder="-"
                               onFocus={() => {
                                 const val = grid[rIdx].cells[cIdx];
                                 if (val !== "-" && val !== "") playPluck(parseInt(val), rIdx, getAudioContext().currentTime);
                               }}
                            />
                         </div>
                       ))}
                       <div className={`absolute -bottom-6 left-0 right-0 text-center text-[8px] font-mono transition-opacity ${cIdx % 4 === 0 ? "opacity-40" : "opacity-10"}`}>{cIdx + 1}</div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setGrid(grid.map(r => ({ ...r, cells: [...r.cells, ...Array.from({ length: 16 }, () => "-")] })))}
                    className="w-20 h-full flex items-center justify-center opacity-40 hover:opacity-100 transition-all text-zinc-500 bg-white/5 rounded-r-lg ml-2 group"
                  >
                     <div className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform">
                        <Plus className="h-5 w-5" />
                        <span className="text-[8px] font-black uppercase">Add measure</span>
                     </div>
                  </button>
               </div>
            </div>

            {/* Playhead Marker */}
            {playhead !== -1 && (
               <div className="absolute top-0 bottom-8 w-[2px] bg-[var(--color-mint)] z-30 pointer-events-none transition-all ml-8 shadow-[0_0_10px_var(--color-mint)]" style={{ left: `${playhead * 40}px` }} />
            )}
         </div>
         <div className="pt-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
         {/* Markers & Metadata */}
         <div className="panel p-5 rounded-3xl border border-white/5 bg-zinc-900/20">
            <div className="eyebrow mb-3 uppercase tracking-[0.2em] opacity-40">Section Context</div>
            <div className="flex flex-wrap gap-2">
               {files.find(f => f.id === activeFileId)?.markers.map(m => (
                 <span key={m} className="glass-pill px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--color-brass)] bg-[var(--color-brass)]/5 border-[var(--color-brass)]/20">{m}</span>
               )) || <span className="text-[10px] font-bold text-zinc-600 italic">No structural markers defined.</span>}
            </div>
         </div>

         {/* File List */}
         <div className="panel p-5 rounded-3xl border border-white/5 bg-zinc-900/20">
            <div className="eyebrow mb-3 uppercase tracking-[0.2em] opacity-40">Imported Score History</div>
            <div className="space-y-2">
               {files.map(file => (
                 <div key={file.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${file.id === activeFileId ? "border-[var(--color-copper)] bg-white/5 shadow-lg" : "border-white/5 hover:border-white/10"}`} onClick={() => setActiveFileId(file.id)}>
                    <div className="flex items-center gap-3">
                       <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-black/40"><Music className="h-4 w-4 text-zinc-500" /></div>
                       <span className="text-xs font-black">{file.name}</span>
                    </div>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase">{(file.size/1024).toFixed(0)}KB</span>
                 </div>
               ))}
               {files.length === 0 && <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Project library local-only</span>}
            </div>
         </div>
      </div>
    </div>
  );
}