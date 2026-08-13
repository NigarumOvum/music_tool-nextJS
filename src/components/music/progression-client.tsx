"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Layers, Music, PlayCircle, Plus, RotateCcw, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useAudio } from "@/components/music/audio-provider";
import {
  PROGRESSION_CATEGORIES,
  PROGRESSION_PRESETS,
  transposePreset,
  type ProgressionPreset,
} from "@/lib/music/progression-presets";

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
  const [bpm, setBpm] = useState(80);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string>("All");
  const [activeChordId, setActiveChordId] = useState<string | null>(null);
  const playingRef = useRef(false);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  const filteredPresets = useMemo(() => {
    if (presetCategory === "All") return PROGRESSION_PRESETS;
    return PROGRESSION_PRESETS.filter((preset) => preset.category === presetCategory);
  }, [presetCategory]);

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
    const baseFreq = 261.63 * 2 ** (NOTES.indexOf(chord.root) / 12);

    const intervals: Record<string, number[]> = {
      Maj: [0, 4, 7],
      min: [0, 3, 7],
      "7": [0, 4, 7, 10],
      maj7: [0, 4, 7, 11],
      min7: [0, 3, 7, 10],
      dim: [0, 3, 6],
      sus4: [0, 5, 7],
      sus2: [0, 2, 7],
      aug: [0, 4, 8],
      dim7: [0, 3, 6, 9],
    };

    intervals[chord.quality]?.forEach((interval, idx) => {
      playNote(baseFreq * 2 ** (interval / 12), startTime, idx * 0.02);
    });
  };

  const playProgression = () => {
    if (progression.length === 0) return;
    if (isPlaying) {
      playingRef.current = false;
      setIsPlaying(false);
      setActiveChordId(null);
      return;
    }

    setIsPlaying(true);
    playingRef.current = true;
    const beatMs = 60000 / bpm;

    const runPass = () => {
      if (!playingRef.current) return;
      progression.forEach((chord, idx) => {
        setTimeout(() => {
          if (!playingRef.current) return;
          setActiveChordId(chord.id);
          playChord(chord);
          if (idx === progression.length - 1) {
            setTimeout(() => {
              if (!playingRef.current) return;
              if (loopPlayback) {
                runPass();
              } else {
                playingRef.current = false;
                setIsPlaying(false);
                setActiveChordId(null);
              }
            }, beatMs * 0.85);
          }
        }, idx * beatMs);
      });
    };

    runPass();
  };

  const applyPreset = (preset: ProgressionPreset) => {
    const chords = transposePreset(preset, keyRoot);
    setProgression(chords.map((chord) => ({ id: crypto.randomUUID(), ...chord })));
    toast.success(`Loaded ${preset.name} in ${keyRoot}`);
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
    <div className="space-y-4 animate-fade-up">
      <div className="panel glass-shine space-y-6 rounded-[1.75rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="glass-pill p-2 text-[var(--color-brass)]">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="eyebrow">Harmony builder</div>
              <h3 className="text-xl font-black tracking-tight">Progression sequence</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
              className="field w-auto min-w-[110px] py-2 text-xs font-bold"
              aria-label="Playback tempo"
            >
              {[50, 60, 70, 80, 90, 100, 110, 120, 140, 160].map((tempo) => (
                <option key={tempo} value={tempo}>{tempo} BPM</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setLoopPlayback((current) => !current)}
              className={`glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest ${loopPlayback ? "glass-pill-active" : ""}`}
            >
              Loop
            </button>
            <button
              type="button"
              disabled={progression.length === 0}
              onClick={playProgression}
              className="glass-pill flex items-center gap-2 bg-[var(--color-copper)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-30"
            >
              <PlayCircle className="h-4 w-4" />
              {isPlaying ? "Stop" : "Play"}
            </button>
            <button
              type="button"
              onClick={exportProgression}
              disabled={progression.length === 0}
              className="glass-pill flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={() => setProgression([])}
              disabled={progression.length === 0}
              className="glass-pill flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>

        <div className="flex min-h-[120px] flex-wrap gap-2 rounded-[1.25rem] border border-dashed border-[var(--color-border)] bg-black/15 p-4">
          {progression.length === 0 ? (
            <div className="flex w-full items-center justify-center py-6 text-sm text-[var(--color-sand-2)]">
              Add chords below or load a preset to start building.
            </div>
          ) : null}
          {progression.map((chord, idx) => {
            const analysis = analyzeChord(chord, keyRoot);
            return (
              <motion.button
                key={chord.id}
                type="button"
                layout
                className={`group relative flex h-28 w-[4.5rem] flex-col items-center justify-center rounded-xl border transition-all ${
                  activeChordId === chord.id
                    ? "border-[var(--color-mint)] bg-[var(--color-success-surface)] shadow-[0_0_20px_rgba(34,197,94,0.25)]"
                    : "song-list-item border-[var(--color-stroke)]"
                }`}
                onClick={() => playChord(chord)}
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setProgression(progression.filter((item) => item.id !== chord.id));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      setProgression(progression.filter((item) => item.id !== chord.id));
                    }
                  }}
                  className="absolute -right-1 -top-1 scale-75 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
                <span className="text-lg font-black leading-none">{chord.root}</span>
                <span className="text-[8px] font-bold uppercase text-[var(--color-brass)]">{chord.quality}</span>
                {analysis ? (
                  <span className="mt-1 text-[8px] font-black text-[var(--color-mint)]" title={analysis.functionLabel}>
                    {analysis.numeral}
                  </span>
                ) : (
                  <span className="mt-1 text-[8px] font-bold text-zinc-500">#{idx + 1}</span>
                )}
              </motion.button>
            );
          })}
          <button
            type="button"
            onClick={() => setProgression([...progression, { id: crypto.randomUUID(), root, quality }])}
            className="flex h-28 w-[4.5rem] items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] transition hover:border-[var(--color-copper)]"
          >
            <Plus className="h-5 w-5 text-[var(--color-sand-2)]" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="field-group">
            <span className="field-label">Key</span>
            <select value={keyRoot} onChange={(event) => setKeyRoot(event.target.value)} className="field py-2">
              {NOTES.map((note) => <option key={note} value={note}>{note}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Root</span>
            <select value={root} onChange={(event) => setRoot(event.target.value)} className="field py-2">
              {NOTES.map((note) => <option key={note} value={note}>{note}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Quality</span>
            <select value={quality} onChange={(event) => setQuality(event.target.value)} className="field py-2">
              {QUALITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setProgression([...progression, { id: crypto.randomUUID(), root, quality }])}
              className="glass-pill w-full px-4 py-2.5 text-[10px] font-black uppercase tracking-widest"
            >
              Add chord
            </button>
          </div>
        </div>
      </div>

      <div className="panel glass-shine rounded-[1.75rem] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Preset library</div>
            <h4 className="text-lg font-black">{filteredPresets.length} progressions</h4>
          </div>
          <select
            value={presetCategory}
            onChange={(event) => setPresetCategory(event.target.value)}
            className="field w-auto min-w-[180px] py-2 text-xs font-bold"
          >
            <option value="All">All categories</option>
            {PROGRESSION_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="song-list-item rounded-[1rem] px-4 py-3 text-left transition"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-black">{preset.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brass)]">{preset.category}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-sand-2)]">{preset.description}</p>
              <p className="mt-2 font-mono text-[10px] text-[var(--color-foreground)] opacity-80">
                {preset.chords.map((chord) => `${chord.root}${chord.quality === "Maj" ? "" : chord.quality}`).join(" · ")}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="panel glass-shine rounded-[1.75rem] p-5">
        <PianoKeyboard
          onNotePlay={(note) => {
            setRoot(note);
            playChord({ id: "preview", root: note, quality });
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel glass-shine flex items-center gap-4 rounded-[1.25rem] border-l-4 border-l-[var(--color-mint)] p-4">
          <Zap className="h-5 w-5 text-[var(--color-mint)]" />
          <div>
            <h4 className="text-xs font-black uppercase">Smart suggestions</h4>
            <p className="text-xs text-[var(--color-sand-2)]">
              Try a{" "}
              <button type="button" onClick={() => setRoot(NOTES[(NOTES.indexOf(root) + 7) % 12])} className="text-[var(--color-brass)] underline">
                dominant (V)
              </button>{" "}
              or{" "}
              <button type="button" onClick={() => setRoot(NOTES[(NOTES.indexOf(root) + 5) % 12])} className="text-[var(--color-brass)] underline">
                subdominant (IV)
              </button>
              .
            </p>
          </div>
        </div>
        <div className="panel glass-shine flex items-center gap-4 rounded-[1.25rem] border-l-4 border-l-fuchsia-400 p-4">
          <Music className="h-5 w-5 text-fuchsia-400" />
          <div>
            <h4 className="text-xs font-black uppercase">Transpose on load</h4>
            <p className="text-xs text-[var(--color-sand-2)]">
              Presets auto-transpose to your selected key ({keyRoot}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
