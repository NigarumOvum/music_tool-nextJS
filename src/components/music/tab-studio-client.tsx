"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Download, Play, Plus, Upload, Trash2, Music, Volume2, Save } from "lucide-react";
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
  const [playhead, setPlayhead] = useState(-1);

  const playNote = (fret: number, stringIdx: number, time: number) => {
    if (fret < 0 || isNaN(fret)) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const baseFreqs = [329.63, 246.94, 196.00, 146.83, 110.00, 82.41];
    const freq = baseFreqs[stringIdx] * Math.pow(2, fret / 12);

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.5);
  };

  useEffect(() => {
    if (isPlaying) {
      let currentStep = 0;
      const interval = setInterval(() => {
        setPlayhead(currentStep);
        const ctx = getAudioContext();
        grid.forEach((row, sIdx) => {
          const cell = row.cells[currentStep];
          if (cell !== "-" && cell !== "") {
            playNote(parseInt(cell), sIdx, ctx.currentTime);
          }
        });
        currentStep++;
        if (currentStep >= grid[0].cells.length) {
          clearInterval(interval);
          setIsPlaying(false);
          setPlayhead(-1);
        }
      }, 250);
      return () => clearInterval(interval);
    }
  }, [isPlaying, grid]);

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
      {/* Tab Toolbar */}
      <div className="panel p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-zinc-900/40 backdrop-blur-md">
         <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className={`p-2 rounded-full transition-all ${isPlaying ? "bg-red-500 text-white" : "bg-[var(--color-mint)] text-black shadow-lg hover:scale-110"}`}
            >
              {isPlaying ? <Trash2 className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex gap-1">
               {["4/4", "3/4", "6/8"].map(m => (
                 <button key={m} className="px-2 py-1 rounded-lg text-[9px] font-black bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest">{m}</button>
               ))}
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
               <h3 className="text-lg font-black tracking-tight">Notation Editor</h3>
            </div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tempo: 120 BPM</div>
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
                    <div key={cIdx} className={`w-10 relative flex flex-col justify-between transition-colors ${playhead === cIdx ? "bg-[var(--color-mint)]/20" : "hover:bg-white/5"}`}>
                       {grid.map((row, rIdx) => (
                         <div key={rIdx} className="h-8 flex items-center justify-center z-10">
                            <input 
                               className={`w-7 h-7 rounded-md transition-all text-center text-xs font-black outline-none border focus:ring-1 focus:ring-[var(--color-copper)] ${
                                 row.cells[cIdx] === "-" 
                                   ? "bg-transparent border-transparent text-zinc-700 hover:text-zinc-500" 
                                   : "bg-white text-black border-white shadow-xl scale-110"
                               }`}
                               value={row.cells[cIdx] === "-" ? "" : row.cells[cIdx]}
                               onChange={(e) => {
                                 const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 2);
                                 setGrid(grid.map((r, i) => i === rIdx ? { ...r, cells: r.cells.map((c, j) => j === cIdx ? val || "-" : c) } : r));
                               }}
                               placeholder="-"
                            />
                         </div>
                       ))}
                       <div className="absolute -bottom-6 left-0 right-0 text-center text-[8px] font-mono opacity-20">{cIdx + 1}</div>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => setGrid(grid.map(r => ({ ...r, cells: [...r.cells, "-"] })))}
                    className="w-10 h-full flex items-center justify-center opacity-40 hover:opacity-100 transition-all text-zinc-500 bg-white/5 rounded-r-lg ml-2"
                  >
                     <Plus className="h-4 w-4" />
                  </button>
               </div>
            </div>

            {/* Playhead Marker */}
            {playhead !== -1 && (
               <div className="absolute top-0 bottom-8 w-[2px] bg-[var(--color-mint)] z-30 pointer-events-none transition-all ml-8" style={{ left: `${playhead * 40}px` }} />
            )}
         </div>
         <div className="pt-2" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
         {/* Markers & Metadata */}
         <div className="panel p-5 rounded-3xl border border-white/5 bg-zinc-900/20">
            <div className="eyebrow mb-3 uppercase tracking-[0.2em] opacity-40">Extracted Markers</div>
            <div className="flex flex-wrap gap-2">
               {files.find(f => f.id === activeFileId)?.markers.map(m => (
                 <span key={m} className="glass-pill px-3 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--color-brass)] bg-[var(--color-brass)]/5 border-[var(--color-brass)]/20">{m}</span>
               )) || <span className="text-[10px] font-bold text-zinc-600">No markers found in file.</span>}
            </div>
         </div>

         {/* File List */}
         <div className="panel p-5 rounded-3xl border border-white/5 bg-zinc-900/20">
            <div className="eyebrow mb-3 uppercase tracking-[0.2em] opacity-40">Loaded Project Files</div>
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
               {files.length === 0 && <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest pl-1">Library empty</span>}
            </div>
         </div>
      </div>
    </div>
  );
}