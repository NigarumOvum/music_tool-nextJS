"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Square, Activity, Radio, Volume2, Mic, MicOff } from "lucide-react";
import { useAudio } from "@/components/music/audio-provider";

const REFERENCE_PITCHES = [
  { name: "E4", freq: 329.63 },
  { name: "B3", freq: 246.94 },
  { name: "G3", freq: 196.00 },
  { name: "D3", freq: 146.83 },
  { name: "A2", freq: 110.00 },
  { name: "E2", freq: 82.41 },
];

const TIME_SIGNATURES = ["4/4", "3/4", "2/4", "6/8"] as const;

export function HelpersClient() {
  const { getAudioContext } = useAudio();
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePitch, setActivePitch] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [timeSignature, setTimeSignature] = useState<(typeof TIME_SIGNATURES)[number]>("4/4");
  const [subdivision, setSubdivision] = useState<1 | 2 | 4>(1);
  const [beatCount, setBeatCount] = useState(0);
  
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  const getBeatsPerBar = (sig: (typeof TIME_SIGNATURES)[number]) => {
    if (sig === "6/8") return 6;
    return Number(sig.split("/")[0]);
  };

  // Metronome logic ...
  const playClick = (isAccent: boolean, volume = 1) => {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isAccent ? 1600 : 1200, ctx.currentTime);
    envelope.gain.setValueAtTime(0.5 * volume, ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(envelope);
    envelope.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  };

  useEffect(() => {
    if (isPlaying) {
      stepRef.current = 0;
      const beatsPerBar = getBeatsPerBar(timeSignature);
      const baseIntervalMs = (60 / bpm) * 1000;
      const stepIntervalMs = baseIntervalMs / subdivision;

      const tick = () => {
        const step = stepRef.current;
        const beatInBar = Math.floor(step / subdivision) % beatsPerBar;
        const isSubdivisionStep = step % subdivision !== 0;
        if (subdivision === 1) {
          playClick(beatInBar === 0, 1);
        } else if (isSubdivisionStep) {
          playClick(false, 0.35);
        } else {
          playClick(beatInBar === 0, 1);
        }
        setBeatCount(beatInBar);
        stepRef.current += 1;
      };

      tick();
      timerRef.current = setInterval(tick, stepIntervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setBeatCount(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm, timeSignature, subdivision]);

  // Tuner Logic (Visualizer)
  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      analyzerRef.current = analyzer;
      setIsListening(true);
      draw();
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const draw = () => {
    if (!analyzerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const renderFrame = () => {
      if (!isListening) return;
      requestRef.current = requestAnimationFrame(renderFrame);
      analyzerRef.current?.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(20, 184, 166, ${dataArray[i] / 255})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    renderFrame();
  };

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const togglePitch = (pitch: any) => {
    const ctx = getAudioContext();
    if (activePitch === pitch.name) {
      oscillatorRef.current?.stop();
      setActivePitch(null);
      return;
    }
    if (oscillatorRef.current) oscillatorRef.current.stop();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(pitch.freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    oscillatorRef.current = osc;
    setActivePitch(pitch.name);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="glass-pill p-2 text-[var(--color-mint)] bg-[var(--color-mint)]/10">
               <Activity className="h-4 w-4" />
             </div>
             <h3 className="text-lg font-black italic tracking-tight uppercase">Pro Metronome</h3>
          </div>
          <div className={`h-2 w-2 rounded-full ${isPlaying ? "bg-[var(--color-mint)] shadow-[0_0_10px_var(--color-mint)] mb-1" : "bg-zinc-800"}`} />
        </div>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex items-baseline gap-3 text-6xl font-black tabular-nums tracking-tighter text-[var(--color-foreground)]">
            {bpm}
            <span className="text-sm font-bold text-[var(--color-sand-2)] ml-[-8px]">BPM</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Signature</span>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(e.target.value as (typeof TIME_SIGNATURES)[number])}
                className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none"
              >
                {TIME_SIGNATURES.map((sig) => (
                  <option key={sig} value={sig}>{sig}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">Subdivision</span>
              <select
                value={subdivision}
                onChange={(e) => setSubdivision(Number(e.target.value) as 1 | 2 | 4)}
                className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none"
              >
                <option value={1}>Quarter</option>
                <option value={2}>Eighths</option>
                <option value={4}>Sixteenths</option>
              </select>
            </div>
          </div>

          <div className="flex gap-1.5">
            {Array.from({ length: getBeatsPerBar(timeSignature) }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`h-2.5 rounded-full transition-all ${
                  isPlaying && beatCount === i
                    ? "w-6 bg-[var(--color-mint)]"
                    : "w-2.5 bg-zinc-700"
                }`}
                aria-label={`Beat ${i + 1}`}
              />
            ))}
          </div>

          <input
            type="range" min="40" max="240" value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[var(--color-mint)]"
          />

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
              isPlaying 
                ? "bg-red-500/10 text-red-500 border border-red-500/30" 
                : "bg-[var(--color-mint)] text-black shadow-lg hover:scale-105"
            }`}
          >
            {isPlaying ? <Square className="h-8 w-8 fill-current" /> : <Play className="h-8 w-8 fill-current ml-1" />}
          </button>
        </div>
      </div>

      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-copper)] bg-[var(--color-copper)]/10">
              <Radio className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-black italic tracking-tight uppercase">Intelligent Tuner</h3>
          </div>
          <button 
            onClick={toggleListening}
            className={`flex items-center gap-2 glass-pill px-3 py-1.5 text-[10px] font-bold transition-all ${isListening ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
          >
            {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            {isListening ? "STOP LISTENING" : "START AUTO-TUNE"}
          </button>
        </div>

        <div className="relative h-24 w-full bg-black/40 rounded-2xl overflow-hidden border border-white/5">
           <canvas ref={canvasRef} className="w-full h-full" width={400} height={100} />
           {!isListening && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-loose">Visualizer Inactive - Start Mic</span>
             </div>
           )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {REFERENCE_PITCHES.map((pitch) => (
            <button
              key={pitch.name}
              onClick={() => togglePitch(pitch)}
              className={`py-3 rounded-xl flex flex-col items-center gap-1 border transition-all ${
                activePitch === pitch.name
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10 text-[var(--color-copper)]"
                  : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800"
              }`}
            >
              <Volume2 className={`h-3 w-3 ${activePitch === pitch.name ? "animate-pulse" : ""}`} />
              <span className="text-sm font-black">{pitch.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
