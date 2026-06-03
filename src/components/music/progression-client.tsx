import { PianoKeyboard } from "@/components/music/piano-keyboard";
// ... (Chord interface remains same)

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
    progression.forEach((chord, idx) => {
      setTimeout(() => playChord(chord), idx * 1000);
    });
  };

  return (
    <div className="space-y-4">
      <div className="panel p-6 rounded-3xl border border-white/5 bg-zinc-900/20 backdrop-blur-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="glass-pill p-2 text-[var(--color-brass)] bg-[var(--color-brass)]/10">
               <Layers className="h-4 w-4" />
             </div>
             <h3 className="text-lg font-black tracking-tight">Progression Sequence</h3>
          </div>
          <button 
            disabled={progression.length === 0}
            onClick={playProgression}
            className="flex items-center gap-2 glass-pill px-4 py-1.5 bg-[var(--color-copper)] text-white text-[10px] font-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
          >
            <PlayCircle className="h-4 w-4" />
            PLAY SEQUENCE
          </button>
        </div>

        <div className="flex flex-wrap gap-2 min-h-[100px] p-4 rounded-2xl bg-black/20 border border-white/5 border-dashed">
          {progression.map((chord) => (
            <div 
              key={chord.id} 
              className="group relative flex flex-col items-center justify-center h-20 w-16 rounded-xl glass-pill bg-zinc-900/50 border border-white/5 hover:border-[var(--color-brass)] transition-all cursor-pointer"
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
            </div>
          ))}
          <button 
            onClick={() => setProgression([...progression, { id: crypto.randomUUID(), root, quality }])}
            className="h-20 w-16 rounded-xl flex items-center justify-center border border-dashed border-zinc-700 hover:border-zinc-500 transition-all"
          >
            <Plus className="h-5 w-5 text-zinc-600" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
            <select value={root} onChange={(e) => setRoot(e.target.value)} className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none">
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={quality} onChange={(e) => setQuality(e.target.value)} className="glass-pill px-3 py-1.5 text-xs font-bold border-none outline-none">
                {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <div className="text-[10px] text-zinc-500 font-bold uppercase ml-2">Click icons to add to sequence</div>
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
