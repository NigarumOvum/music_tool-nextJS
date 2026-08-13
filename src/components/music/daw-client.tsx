"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Download, Plus, Trash2, Upload, Play, Pause, RotateCcw, Volume2, Maximize2 } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

type AssetKind = "audio" | "midi" | "project" | "other";

type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  format: string;
  size: number;
  file?: File;
};

type LayerRecord = {
  id: string;
  name: string;
  kind: "audio" | "midi" | "instrument" | "aux";
  assetId: string;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

function classifyKind(file: File): AssetKind {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) return "midi";
  if ([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"].some((ext) => lower.endsWith(ext))) return "audio";
  if (lower.endsWith(".json")) return "project";
  return "other";
}

export function DawClient() {
  const { getAudioContext } = useAudio();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [layers, setLayers] = useState<LayerRecord[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const togglePlayback = () => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => (prev >= 60 ? 0 : prev + 0.1));
      }, 100);
    }
  };

  const importFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      kind: classifyKind(file),
      format: file.name.split(".").pop()?.toLowerCase() || "",
      size: file.size,
      file,
    } satisfies AssetRecord));
    setAssets((current) => [...current, ...next]);
  };

  const addTrack = (kind: LayerRecord["kind"]) => {
    setLayers([...layers, {
      id: crypto.randomUUID(),
      name: `New ${kind} track`,
      kind,
      assetId: "",
      gain: 80,
      pan: 0,
      mute: false,
      solo: false,
    }]);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const exportManifest = () => {
    const manifest = {
      app: "music-tool-daw",
      version: 1,
      exportedAt: new Date().toISOString(),
      bpm: 120,
      layers: layers.map((layer) => ({
        name: layer.name,
        kind: layer.kind,
        asset: assets.find((asset) => asset.id === layer.assetId)?.name || null,
        gain: layer.gain,
        pan: layer.pan,
        mute: layer.mute,
        solo: layer.solo,
      })),
      assets: assets.map((asset) => ({
        name: asset.name,
        kind: asset.kind,
        format: asset.format,
        size: asset.size,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "daw-session.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="panel p-3 rounded-2xl flex items-center justify-between border border-white/5 bg-zinc-900/40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 glass-pill px-3 py-1.5 bg-black/40 ring-1 ring-white/10">
            <button onClick={() => setCurrentTime(0)} className="p-1 hover:text-[var(--color-copper)] transition-colors"><RotateCcw className="h-4 w-4" /></button>
            <button onClick={togglePlayback} className={`p-1 transition-colors ${isPlaying ? "text-[var(--color-mint)]" : "hover:text-[var(--color-mint)]"}`}>
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
          </div>
          <div className="text-xl font-mono tracking-tighter text-[var(--color-mint)] tabular-nums">
             {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, "0")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} />
          <button onClick={() => inputRef.current?.click()} className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">Import Assets</button>
          <button onClick={exportManifest} className="glass-pill px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-black transition-all">
            <Download className="h-3.5 w-3.5 mr-1 inline" />
            Export Session
          </button>
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          <div className="flex gap-1">
             <button onClick={() => addTrack("audio")} className="glass-pill px-3 py-2 text-[8px] font-black uppercase text-[var(--color-mint)] border-[var(--color-mint)]/20 hover:bg-[var(--color-mint)] hover:text-black transition-all">+ Audio</button>
             <button onClick={() => addTrack("midi")} className="glass-pill px-3 py-2 text-[8px] font-black uppercase text-[var(--color-brass)] border-[var(--color-brass)]/20 hover:bg-[var(--color-brass)] hover:text-black transition-all">+ MIDI</button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* Track Headers */}
        <div className="space-y-1">
          <div className="panel p-3 rounded-xl border border-white/5 bg-black/20 h-[40px] flex items-center justify-between">
             <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">Track List</span>
             <Maximize2 className="h-3 w-3 opacity-20" />
          </div>
          <div className="space-y-2">
            {layers.map(layer => (
              <div key={layer.id} className="panel p-3 rounded-xl border border-white/5 bg-zinc-900/40 min-h-[100px] flex flex-col justify-between group">
                <div className="flex items-center justify-between gap-2">
                   <div className={`h-2 w-2 rounded-full ${layer.kind === "audio" ? "bg-[var(--color-mint)]" : "bg-[var(--color-brass)]"}`} />
                   <input className="bg-transparent border-none text-xs font-bold w-full outline-none focus:text-[var(--color-copper)]" value={layer.name} onChange={(e) => setLayers(layers.map(l => l.id === layer.id ? { ...l, name: e.target.value } : l))} />
                   <button onClick={() => setLayers(layers.filter(l => l.id !== layer.id))} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex gap-1">
                   <button className={`flex-1 text-[8px] font-black py-1 rounded border ${layer.mute ? "bg-red-500/20 border-red-500/50 text-red-500" : "border-white/10 opacity-40"}`} onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, mute: !l.mute } : l))}>MUTE</button>
                   <button className={`flex-1 text-[8px] font-black py-1 rounded border ${layer.solo ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500" : "border-white/10 opacity-40"}`} onClick={() => setLayers(layers.map(l => l.id === layer.id ? { ...l, solo: !l.solo } : l))}>SOLO</button>
                </div>
              </div>
            ))}
            {layers.length === 0 && (
                <div className="p-4 text-[10px] font-bold text-zinc-600 uppercase text-center border border-dashed border-zinc-800 rounded-xl">No tracks</div>
            )}
          </div>
        </div>

        {/* Timeline View */}
        <div className="panel rounded-2xl border border-white/5 bg-black/40 relative overflow-hidden flex flex-col min-h-[600px]">
           {/* Timeline Header */}
           <div className="h-[40px] border-b border-white/5 flex relative overflow-x-auto [scrollbar-width:none]">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="flex-none w-[60px] border-r border-white/5 text-[9px] font-mono text-zinc-600 pl-1 pt-1 tabular-nums">
                  {i}s
                </div>
              ))}
              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-[var(--color-copper)] z-10 transition-all shadow-[0_0_10px_var(--color-copper)]"
                style={{ left: `${currentTime * 60}px` }}
              />
           </div>

           {/* Tracks Rendering */}
           <div className="flex-1 relative overflow-auto">
              <div className="space-y-2 py-2">
                {layers.map(layer => (
                  <div key={layer.id} className="h-[100px] border-b border-white/5 relative group bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors">
                     {layer.assetId && (
                        <div className="absolute top-2 bottom-2 bg-[var(--color-copper)]/20 border border-[var(--color-copper)]/40 rounded-lg p-2 flex items-center overflow-hidden" style={{ left: "0px", width: "400px" }}>
                           <span className="text-[10px] font-black whitespace-nowrap opacity-60">REGION: {assets.find(a => a.id === layer.assetId)?.name}</span>
                        </div>
                     )}
                     {!layer.assetId && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <select 
                            className="glass-pill px-4 py-1 text-[9px] font-black bg-black border-white/10 outline-none focus:ring-1 focus:ring-[var(--color-copper)]"
                            onChange={(e) => setLayers(layers.map(l => l.id === layer.id ? { ...l, assetId: e.target.value } : l))}
                           >
                             <option value="">ASSIGN ASSET</option>
                             {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                           </select>
                        </div>
                     )}
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>

      {/* Asset Library Compact */}
      <div className="panel p-5 rounded-3xl border border-white/5 bg-zinc-900/20">
         <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Asset Browser</h3>
            <span className="text-[10px] font-bold text-zinc-500">{assets.length} items available</span>
         </div>
         <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {assets.map(asset => (
              <div key={asset.id} className="glass-pill p-3 rounded-2xl flex items-center justify-between group">
                <div className="flex items-center gap-3 overflow-hidden">
                   <div className={`h-8 w-8 flex items-center justify-center rounded-lg bg-black/40`}>
                      {asset.kind === "audio" ? <Volume2 className="h-4 w-4 text-[var(--color-mint)]" /> : <Maximize2 className="h-4 w-4 text-[var(--color-brass)]" />}
                   </div>
                   <div className="min-w-0">
                      <div className="text-xs font-black truncate">{asset.name}</div>
                      <div className="text-[9px] opacity-40 font-bold uppercase">{asset.format} • {(asset.size/1024).toFixed(0)}KB</div>
                   </div>
                </div>
                <button 
                  onClick={() => setAssets(assets.filter(a => a.id !== asset.id))}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {assets.length === 0 && (
                <div className="col-span-full py-8 text-center border border-dashed border-zinc-800 rounded-3xl">
                   <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">No assets in library. Start by importing files.</p>
                </div>
            )}
         </div>
      </div>
    </div>
  );
}