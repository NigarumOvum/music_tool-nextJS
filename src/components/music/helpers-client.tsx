"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Activity, Radio, Volume2 } from "lucide-react";

const REFERENCE_PITCHES = [
  { name: "E4", freq: 329.63 },
  { name: "B3", freq: 246.94 },
  { name: "G3", freq: 196.00 },
  { name: "D3", freq: 146.83 },
  { name: "A2", freq: 110.00 },
  { name: "E2", freq: 82.41 },
];

export function HelpersClient() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePitch, setActivePitch] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const playClick = () => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    
    envelope.gain.setValueAtTime(1, ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(envelope);
    envelope.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  useEffect(() => {
    if (isPlaying) {
      const interval = (60 / bpm) * 1000;
      timerRef.current = setInterval(playClick, interval);
      playClick(); // Initial click
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm]);

  const togglePitch = (pitch: typeof REFERENCE_PITCHES[0]) => {
    const ctx = getAudioContext();
    
    if (activePitch === pitch.name) {
      oscillatorRef.current?.stop();
      setActivePitch(null);
      return;
    }

    oscillatorRef.current?.stop();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.setValueAtTime(pitch.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);

    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    oscillatorRef.current = osc;
    setActivePitch(pitch.name);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Metronome */}
      <div className="panel p-8 rounded-[2.5rem] border-2 border-[var(--color-mint)] space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="glass-pill p-3 text-[var(--color-mint)]">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tighter">Metronome</h3>
          </div>
          <div className={`h-4 w-4 rounded-full ${isPlaying ? "bg-[var(--color-mint)] animate-ping" : "bg-zinc-800"}`} />
        </div>

        <div className="flex flex-col items-center gap-8 py-4">
          <div className="text-7xl font-black tabular-nums tracking-tighter text-[var(--color-foreground)]">
            {bpm} <span className="text-lg font-bold text-[var(--color-sand-2)] ml-[-10px]">BPM</span>
          </div>

          <input
            type="range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--color-mint)]"
          />

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
                ? "bg-red-500/20 text-red-500 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]" 
                : "bg-[var(--color-mint)] text-black shadow-[0_0_40px_rgba(var(--color-mint-rgb),0.4)] hover:scale-105"
            }`}
          >
            {isPlaying ? <Square className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current ml-1" />}
          </button>
        </div>
      </div>

      {/* Tuner / Reference Pitch */}
      <div className="panel p-8 rounded-[2.5rem] space-y-6">
        <div className="flex items-center gap-4">
          <div className="glass-pill p-3 text-[var(--color-copper)]">
            <Radio className="h-6 w-6" />
          </div>
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">Reference Tuner</h3>
        </div>

        <p className="text-sm text-[var(--color-sand-2)]">Standard guitar tuning reference pitches.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {REFERENCE_PITCHES.map((pitch) => (
            <button
              key={pitch.name}
              onClick={() => togglePitch(pitch)}
              className={`p-6 rounded-3xl flex flex-col items-center gap-2 border-2 transition-all ${
                activePitch === pitch.name
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)] shadow-[0_10px_20px_-10px_rgba(var(--color-copper-rgb),0.3)]"
                  : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <Volume2 className={`h-5 w-5 ${activePitch === pitch.name ? "animate-pulse" : ""}`} />
              <span className="text-xl font-black">{pitch.name}</span>
            </button>
          ))}
        </div>
        
        <div className="glass-pill p-4 text-center mt-4 border-dashed border-2 border-zinc-800">
           <p className="text-[10px] text-[var(--color-sand-2)] font-bold uppercase tracking-widest leading-relaxed">
             Pro-Tip: Use these pitches to tune your instrument by ear to maintain internal hearing accuracy.
           </p>
        </div>
      </div>
    </div>
  );
}
