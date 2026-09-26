"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Layers, Music, PlayCircle, Plus, RotateCcw, Trash2, Zap, Sliders } from "lucide-react";
import { toast } from "sonner";

import { CollapsibleCard } from "@/components/collapsible-card";
import { ChordHowToPlay } from "@/components/music/chord-how-to-play";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { useAudio } from "@/components/music/audio-provider";
import { playKeyboardNote, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC, intervalsToPitchClasses, noteFrequency } from "@/lib/music/notes";
import {
  PROGRESSION_CATEGORIES,
  PROGRESSION_PRESETS,
  transposePreset,
  type ProgressionPreset,
} from "@/lib/music/progression-presets";

const NOTES: string[] = [...CHROMATIC];
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
  const keyIndex = NOTES.indexOf(keyRoot as (typeof NOTES)[number]);
  const chordIndex = NOTES.indexOf(chord.root as (typeof NOTES)[number]);
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

function analyzeCadence(progression: Chord[], keyRoot: string): { label: string; description: string } | null {
  if (progression.length < 2) return null;
  const last = analyzeChord(progression[progression.length - 1], keyRoot);
  const prev = analyzeChord(progression[progression.length - 2], keyRoot);
  if (!last || !prev) return null;
  const lastNumeral = last.numeral.toUpperCase();
  const prevNumeral = prev.numeral.toUpperCase();
  if (lastNumeral === "I") {
    if (prevNumeral === "V") return { label: "Authentic (V→I)", description: "The strongest resolution — dominant to tonic." };
    if (prevNumeral === "IV") return { label: "Plagal (IV→I)", description: "The 'Amen' cadence — subdominant to tonic." };
    if (prevNumeral === "VII") return { label: "Leading tone (vii°→I)", description: "The leading tone resolves into the tonic." };
  }
  if (lastNumeral === "V") {
    if (prevNumeral === "II") return { label: "Half cadence (ii→V)", description: "Pauses on the dominant, unresolved." };
    return { label: "Half cadence (→V)", description: "Ends on the dominant, unresolved." };
  }
  if (lastNumeral === "VI") return { label: "Deceptive (→vi)", description: "A tonic was expected, but the relative minor answered." };
  return null;
}

export function ProgressionClient() {
  const { getAudioContext } = useAudio();
  const userId = useCurrentUserId();
  const [progression, setProgression] = usePersistentState<Chord[]>("progression_chords", [], { userId });
  const [root, setRoot] = usePersistentState("progression_root", "C", { userId });
  const [quality, setQuality] = usePersistentState("progression_quality", "Maj", { userId });
  const [keyRoot, setKeyRoot] = usePersistentState("progression_key", "C", { userId });
  const [bpm, setBpm] = usePersistentState("progression_bpm", 80, { userId });
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = usePersistentState("progression_loop", false, { userId });
  const [presetCategory, setPresetCategory] = usePersistentState("progression_category", "All", { userId });
  const [activeChordId, setActiveChordId] = useState<string | null>(null);
  const [keyboardVoice, setKeyboardVoice] = usePersistentState<KeyboardVoice>("progression_voice", "electric-piano", { userId });
  const [keyboardOctave, setKeyboardOctave] = usePersistentState("progression_octave", 3, { userId });
  const playingRef = useRef(false);

  const chordIntervals: Record<string, number[]> = {
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

  const previewActiveNotes = useMemo(
    () => intervalsToPitchClasses(root, chordIntervals[quality] ?? [0, 4, 7]),
    [root, quality],
  );

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  const filteredPresets = useMemo(() => {
    if (presetCategory === "All") return PROGRESSION_PRESETS;
    return PROGRESSION_PRESETS.filter((preset) => preset.category === presetCategory);
  }, [presetCategory]);

  const playChord = (chord: Chord, delay = 0) => {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime + delay;
    const intervals = chordIntervals[chord.quality] ?? [0, 4, 7];
    const rootIndex = CHROMATIC.indexOf(chord.root as (typeof CHROMATIC)[number]);
    const frequencies = intervals.map((interval) =>
      noteFrequency(CHROMATIC[(rootIndex + interval) % 12], keyboardOctave),
    );
    frequencies.forEach((frequency, idx) => {
      playKeyboardNote(ctx, frequency, keyboardVoice, startTime + idx * 0.03);
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

  const transposeAll = (semitones: number) => {
    if (progression.length === 0) return;
    setProgression((current) => current.map((chord) => {
      const index = NOTES.indexOf(chord.root as (typeof NOTES)[number]);
      if (index === -1) return chord;
      return { ...chord, root: NOTES[(index + semitones + 12) % 12] };
    }));
    toast.success(`Transposed ${semitones > 0 ? "+" : ""}${semitones} st`);
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
    <SplitViewFullScreen className="space-y-4" showControls={false}>
      {/* 1. Progression Timeline & Audio Player (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title="Progression Timeline"
        subtitle={`${progression.length} chord${progression.length === 1 ? "" : "s"} in sequence · Key of ${keyRoot}`}
        eyebrow="Harmonic Structure"
        icon={<Music className="h-5 w-5 text-[var(--color-copper)]" />}
        badge={
          <span className="glass-pill px-2.5 py-0.5 text-[10px] font-bold text-[var(--color-mint)]">
            {keyRoot} Major
          </span>
        }
        headerActions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={progression.length === 0}
              onClick={playProgression}
              title="Play progression"
              className="glass-pill btn-sound flex items-center gap-1.5 bg-[var(--color-copper)] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-30"
            >
              <PlayCircle className="h-4 w-4" />
              {isPlaying ? "Stop" : "Play"}
            </button>
            <button
              type="button"
              onClick={exportProgression}
              disabled={progression.length === 0}
              className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-sand-2)]">Transpose:</span>
              <button
                type="button"
                onClick={() => transposeAll(-1)}
                disabled={progression.length === 0}
                className="glass-pill px-2.5 py-1 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                -1 st
              </button>
              <button
                type="button"
                onClick={() => transposeAll(1)}
                disabled={progression.length === 0}
                className="glass-pill px-2.5 py-1 text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
              >
                +1 st
              </button>
            </div>

            <button
              type="button"
              onClick={() => setProgression([])}
              disabled={progression.length === 0}
              className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:underline disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear All
            </button>
          </div>

          <div className="flex min-h-[120px] flex-wrap gap-2 rounded-2xl border border-dashed border-[var(--color-border)] bg-black/15 p-4">
            {progression.length === 0 ? (
              <div className="flex w-full items-center justify-center py-6 text-xs text-[var(--color-sand-2)]">
                Add chords below or load a preset to start building.
              </div>
            ) : null}
            {progression.map((chord, idx) => {
              const analysis = analyzeChord(chord, keyRoot);
              return (
                <motion.div
                  key={chord.id}
                  layout
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${chord.root}${chord.quality}`}
                  title={`Tap to play ${chord.root}${chord.quality}`}
                  className={`group btn-sound relative flex h-28 w-[4.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-copper)] ${
                    activeChordId === chord.id
                      ? "border-[var(--color-mint)] bg-[var(--color-success-surface)] shadow-[0_0_20px_rgba(34,197,94,0.25)]"
                      : "song-list-item border-[var(--color-stroke)]"
                  }`}
                  onClick={() => playChord(chord)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      playChord(chord);
                    }
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Remove ${chord.root}${chord.quality}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProgression(progression.filter((item) => item.id !== chord.id));
                    }}
                    className="absolute -right-1 -top-1 scale-75 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <span className="text-lg font-black leading-none">{chord.root}</span>
                  <span className="text-[8px] font-bold uppercase text-[var(--color-brass)]">{chord.quality}</span>
                  {analysis ? (
                    <span className="mt-1 text-[8px] font-black text-[var(--color-mint)]" title={analysis.functionLabel}>
                      {analysis.numeral}
                    </span>
                  ) : (
                    <span className="mt-1 text-[8px] font-bold text-zinc-500">#{idx + 1}</span>
                  )}
                </motion.div>
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

          {(() => {
            const cadence = analyzeCadence(progression, keyRoot);
            return cadence ? (
              <div className="flex items-center gap-3 rounded-xl border-l-4 border-l-[var(--color-mint)] bg-black/15 px-4 py-3">
                <Zap className="h-4 w-4 shrink-0 text-[var(--color-mint)]" />
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-[var(--color-mint)]">{cadence.label}</span>
                  <p className="text-xs text-[var(--color-sand-2)]">{cadence.description}</p>
                </div>
              </div>
            ) : null;
          })()}

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
      </CollapsibleCard>

      {/* 2. Preset Chord Catalog (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title="Progression Preset Library"
        subtitle={`${filteredPresets.length} curated harmonic sequences across genres`}
        eyebrow="Songcrafting Presets"
        icon={<Layers className="h-5 w-5 text-[var(--color-brass)]" />}
        headerActions={
          <select
            value={presetCategory}
            onChange={(event) => setPresetCategory(event.target.value)}
            className="field w-auto py-1 text-xs font-bold"
          >
            <option value="All">All categories</option>
            {PROGRESSION_CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="song-list-item rounded-2xl p-4 text-left transition hover:border-[var(--color-copper)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-black text-[var(--color-foreground)]">{preset.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brass)]">{preset.category}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-[var(--color-sand-2)]">{preset.description}</p>
              <p className="mt-2 font-mono text-[11px] font-bold text-[var(--color-copper)]">
                {preset.chords.map((chord) => `${chord.root}${chord.quality === "Maj" ? "" : chord.quality}`).join(" · ")}
              </p>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      {/* 3. Keyboard Preview & Suggestions (Less critical: Closed by default) */}
      <CollapsibleCard
        defaultOpen={false}
        title={`Chord Voicing Preview · ${root}${quality === "Maj" ? "" : quality}`}
        subtitle="Keyboard visualizer and cadence recommendations"
        eyebrow="Interactive Voicing"
        icon={<Sliders className="h-5 w-5 text-[var(--color-mint)]" />}
        headerActions={
          <button
            type="button"
            onClick={() => playChord({ id: "preview", root, quality })}
            title="Play chord"
            className="glass-pill btn-sound px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
          >
            Play Chord
          </button>
        }
      >
        <div className="space-y-4">
          <PianoKeyboard
            activeNotes={previewActiveNotes}
            startOctave={keyboardOctave}
            voice={keyboardVoice}
            onVoiceChange={setKeyboardVoice}
            showInstrumentSelector
            onNotePlay={(note, frequency) => {
              setRoot(note);
              const midi = 69 + 12 * Math.log2(frequency / 440);
              setKeyboardOctave(Math.max(1, Math.min(6, Math.floor(midi / 12) - 1)));
              playKeyboardNote(getAudioContext(), frequency, keyboardVoice);
            }}
          />

          <ChordHowToPlay
            chordLabel={`${root}${quality === "Maj" ? "" : quality}`}
            root={root}
            notes={previewActiveNotes}
          />

          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-mint)]">
                <Zap className="h-4 w-4" />
                <span>Smart Suggestions</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-sand-2)]">
                Try resolving to a{" "}
                <button type="button" onClick={() => setRoot(NOTES[(NOTES.indexOf(root) + 7) % 12])} className="text-[var(--color-brass)] font-bold underline">
                  dominant (V)
                </button>{" "}
                or{" "}
                <button type="button" onClick={() => setRoot(NOTES[(NOTES.indexOf(root) + 5) % 12])} className="text-[var(--color-brass)] font-bold underline">
                  subdominant (IV)
                </button>
                .
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-copper)]">
                <Music className="h-4 w-4" />
                <span>Auto-Transposition</span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-sand-2)]">
                Presets automatically transpose to your selected master key ({keyRoot}).
              </p>
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </SplitViewFullScreen>
  );
}
