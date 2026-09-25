"use client";

import { useMemo, useState } from "react";
import { Book, Layers, Music, Play, RotateCcw, Search, Sparkles, Piano } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { ChordHowToPlay } from "@/components/music/chord-how-to-play";
import { MetronomeCard } from "@/components/music/metronome-card";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { SoundIndicator } from "@/components/ui/sound-indicator";
import { ScaleInstrumentVisuals, ScaleTheory, NoteButtons, ScaleTypeButtons } from "@/components/music/scale-visuals";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { useAudio } from "@/components/music/audio-provider";
import { KEYBOARD_VOICES, playKeyboardNote, playKeyboardNotes, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC, noteFrequency } from "@/lib/music/notes";

const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
  Blues: [0, 3, 5, 6, 7, 10],
  "Harmonic Minor": [0, 2, 3, 5, 7, 8, 11],
  "Melodic Minor": [0, 2, 3, 5, 7, 9, 11],
};

const CHORDS: Record<string, number[]> = {
  Major: [0, 4, 7],
  Minor: [0, 3, 7],
  Diminished: [0, 3, 6],
  Augmented: [0, 4, 8],
  "Major 7": [0, 4, 7, 11],
  "Minor 7": [0, 3, 7, 10],
  "Dominant 7": [0, 4, 7, 10],
  "Minor 7 b5": [0, 3, 6, 10],
  "Diminished 7": [0, 3, 6, 9],
  "Major 9": [0, 4, 7, 11, 14],
  "Dominant 9": [0, 4, 7, 10, 14],
  "Minor 9": [0, 3, 7, 10, 14],
  "6": [0, 4, 7, 9],
  "Minor 6": [0, 3, 7, 9],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
};

type ChordNotePitch = { label: string; pitch: number };

function invertNotes(notes: string[], inversion: number): ChordNotePitch[] {
  const base: ChordNotePitch[] = notes.map((note) => ({
    label: note,
    pitch: CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]),
  }));

  if (inversion === 0) return base;

  const offset = inversion % notes.length;
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];
  const result: ChordNotePitch[] = [];

  for (const entry of rotated) {
    const pitch = entry.pitch;
    if (result.length === 0) {
      result.push({ label: entry.label, pitch });
      continue;
    }
    const prev = result[result.length - 1].pitch;
    let adjusted = pitch;
    while (adjusted < prev) adjusted += 12;
    while (adjusted - 12 >= prev) adjusted -= 12;
    result.push({ label: entry.label, pitch: adjusted });
  }
  return result;
}

function getNotes(root: string, intervals: number[]) {
  const rootIndex = CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]);
  return intervals.map((interval) => CHROMATIC[(rootIndex + interval) % 12]);
}

const INTERVAL_NAMES: Record<number, string> = {
  1: "m2",
  2: "M2",
  3: "m3",
  4: "M3",
  5: "P4",
  6: "TT",
  7: "P5",
  8: "m6",
  9: "M6",
  10: "m7",
  11: "M7",
};

function intervalName(root: string, note: string) {
  const gap = (CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]) - CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]) + 12) % 12;
  return gap === 0 ? "R" : INTERVAL_NAMES[gap] ?? "";
}

function diatonicTriads(scale: string[]): string[][] {
  const chords: string[][] = [];
  for (let i = 0; i < scale.length; i += 1) {
    chords.push([
      scale[i],
      scale[(i + 2) % scale.length],
      scale[(i + 4) % scale.length],
    ]);
  }
  return chords;
}

function triadQuality(root: string, third: string, fifth: string): string {
  const rootIdx = CHROMATIC.indexOf(root as (typeof CHROMATIC)[number]);
  const thirdIdx = CHROMATIC.indexOf(third as (typeof CHROMATIC)[number]);
  const fifthIdx = CHROMATIC.indexOf(fifth as (typeof CHROMATIC)[number]);
  const thirdGap = (thirdIdx - rootIdx + 12) % 12;
  const fifthGap = (fifthIdx - rootIdx + 12) % 12;
  if (thirdGap === 4 && fifthGap === 7) return "M";
  if (thirdGap === 3 && fifthGap === 7) return "m";
  if (thirdGap === 3 && fifthGap === 6) return "dim";
  if (thirdGap === 4 && fifthGap === 8) return "aug";
  return "";
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];

function romanNumeral(degree: number, quality: string) {
  const base = ROMAN_NUMERALS[degree] ?? `${degree + 1}`;
  if (quality === "M") return base;
  if (quality === "m") return base.toLowerCase();
  if (quality === "dim") return `${base.toLowerCase()}°`;
  return `${base}+`;
}

export function TheoryLabClient() {
  const { getAudioContext } = useAudio();
  const userId = useCurrentUserId();
  const [scaleRoot, setScaleRoot] = usePersistentState("theory_scale_root", "C", { userId });
  const [chordRoot, setChordRoot] = usePersistentState("theory_chord_root", "C", { userId });
  const [scaleType, setScaleType] = usePersistentState("theory_scale_type", "Major", { userId });
  const [chordType, setChordType] = usePersistentState("theory_chord_type", "Major", { userId });
  const [inversion, setInversion] = usePersistentState("theory_inversion", 0, { userId });
  const [highlightMode, setHighlightMode] = usePersistentState<"scale" | "chord" | "none">("theory_highlight", "scale", { userId });
  const [keyboardVoice, setKeyboardVoice] = usePersistentState<KeyboardVoice>("theory_voice", "piano", { userId });
  const [keyboardOctave, setKeyboardOctave] = usePersistentState("theory_octave", 4, { userId });
  const [scaleSearch, setScaleSearch] = useState("");

  const playFrequency = (frequency: number) => {
    playKeyboardNote(getAudioContext(), frequency, keyboardVoice);
  };

  const playNoteAtOctave = (note: string, octave = keyboardOctave) => {
    playFrequency(noteFrequency(note, octave));
  };

  const scaleNotes = getNotes(scaleRoot, SCALES[scaleType]);
  const scaleIntervals = SCALES[scaleType];
  const filteredScaleTypes = useMemo(
    () => Object.keys(SCALES).filter((s) => s.toLowerCase().includes(scaleSearch.toLowerCase())),
    [scaleSearch],
  );
  const chordNotes = invertNotes(getNotes(chordRoot, CHORDS[chordType]), inversion).map((entry) => entry.label);
  const activeNotes = highlightMode === "scale" ? scaleNotes : highlightMode === "chord" ? chordNotes : [];

  const chordFrequencies = useMemo(
    () => invertNotes(getNotes(chordRoot, CHORDS[chordType]), inversion).map((entry) => noteFrequency(entry.label, keyboardOctave)),
    [chordRoot, chordType, inversion, keyboardOctave],
  );

  const playNotes = (notes: string[]) => {
    const frequencies = notes.map((note) => noteFrequency(note, keyboardOctave));
    playKeyboardNotes(getAudioContext(), frequencies, keyboardVoice);
  };

  return (
    <SplitViewFullScreen className="space-y-6">
      {/* 0. Timing Precision (metronome, tap tempo, speed & gap trainers) */}
      <MetronomeCard />

      {/* 1. Master Keyboard & Visualizer (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title="Interactive Master Keyboard"
        subtitle={`Highlighting ${highlightMode.toUpperCase()} mode · ${KEYBOARD_VOICES.find((item) => item.id === keyboardVoice)?.label}`}
        eyebrow="Synth & Fretboard Lab"
        icon={<Piano className="h-5 w-5 text-[var(--color-copper)]" />}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHighlightMode(highlightMode === "scale" ? "none" : "scale")}
              className={`rounded-full border px-3 py-1 text-[10px] font-black transition-all ${
                highlightMode === "scale"
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white shadow-lg"
                  : "border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              Scale mode
            </button>
            <button
              type="button"
              onClick={() => setHighlightMode(highlightMode === "chord" ? "none" : "chord")}
              className={`rounded-full border px-3 py-1 text-[10px] font-black transition-all ${
                highlightMode === "chord"
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white shadow-lg"
                  : "border-white/10 opacity-60 hover:opacity-100"
              }`}
            >
              Chord mode
            </button>
            <InfoTooltip
              content="Toggle between scale and chord highlighting modes on the keyboard. Scale mode shows all notes in the selected scale, chord mode shows the current chord notes."
              position="left"
              size="md"
            />
          </div>
        }
      >
        <PianoKeyboard
          activeNotes={activeNotes}
          startOctave={keyboardOctave}
          voice={keyboardVoice}
          onVoiceChange={setKeyboardVoice}
          showInstrumentSelector
          onNotePlay={(note, frequency) => {
            const midi = 69 + 12 * Math.log2(frequency / 440);
            setKeyboardOctave(Math.max(1, Math.min(6, Math.floor(midi / 12) - 1)));
            playFrequency(frequency);
          }}
        />
      </CollapsibleCard>

      {/* 2. Scale Explorer & Diatonic Triads (Important: Open by default) */}
      <CollapsibleCard
        defaultOpen={true}
        title={`Scale Explorer · ${scaleRoot} ${scaleType}`}
        subtitle={`${scaleNotes.length} notes in modal structure with diatonic chords`}
        eyebrow="Modal Analysis"
        icon={<Music className="h-5 w-5 text-[var(--color-brass)]" />}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setHighlightMode("scale"); playNotes(scaleNotes); }}
              title="Play scale"
              className="glass-pill btn-sound px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all hover:bg-[var(--color-brass)] hover:text-black"
            >
              <Play className="mr-1 inline h-3 w-3 fill-current" /> Play Scale
            </button>
            <InfoTooltip
              content="Explore different scales and see their diatonic triads. Understanding scales helps with melody writing and chord progressions."
              position="left"
              size="md"
            />
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Root note</span>
              <InfoTooltip
                content="Select the root note (starting note) for the scale."
                position="top"
                size="sm"
              />
            </div>
            <NoteButtons value={scaleRoot} onChange={setScaleRoot} ariaLabel="Select scale root note" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Scale type</span>
              <InfoTooltip
                content="Choose from 13 different scale types. Each has a unique interval pattern that creates its characteristic sound."
                position="top"
                size="sm"
              />
            </div>
            <input
              className="field w-full sm:max-w-[240px]"
              placeholder="Search scales..."
              value={scaleSearch}
              onChange={(e) => setScaleSearch(e.target.value)}
            />
            <ScaleTypeButtons types={filteredScaleTypes} value={scaleType} onChange={setScaleType} />
          </div>

          <div className="flex flex-wrap gap-2">
            {scaleNotes.map((n, i) => (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => playNoteAtOctave(n)}
                title={`Play ${n}`}
                className="glass-pill btn-sound flex min-w-[50px] flex-col items-center border-white/10 bg-white/5 px-4 py-2 hover:border-[var(--color-brass)]"
              >
                <span className="text-[8px] font-black uppercase opacity-40">{i + 1}</span>
                <span className="text-sm font-black">{n}</span>
                <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-[var(--color-brass)]/70">
                  <SoundIndicator className="h-2.5 w-2.5" />{intervalName(scaleRoot, n)}
                </span>
              </button>
            ))}
          </div>

          <ScaleInstrumentVisuals
            notes={scaleNotes}
            root={scaleRoot}
            voice={keyboardVoice}
            onPlayNote={(note) => playNoteAtOctave(note)}
          />

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="eyebrow text-[0.62rem]">Diatonic Chords</span>
                <InfoTooltip
                  content="These are the 7 triads built from each scale degree. They're the foundation of chord progressions in that key. Click any triad to hear it and load it into the chord explorer."
                  position="top"
                  size="md"
                />
              </div>
              <span className="text-[10px] text-[var(--color-sand-2)]">Click triad to load & hear</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {diatonicTriads(scaleNotes).map((triad, degree) => {
                const quality = triadQuality(triad[0], triad[1], triad[2]);
                const chordTypeName = quality === "M" ? "Major" : quality === "m" ? "Minor" : quality === "dim" ? "Diminished" : quality === "aug" ? "Augmented" : "";
                return (
                  <button
                    key={`${triad.join("-")}-${degree}`}
                    type="button"
                    onClick={() => {
                      if (chordTypeName) {
                        setChordRoot(triad[0]);
                        setChordType(chordTypeName);
                        setInversion(0);
                      }
                      setHighlightMode("chord");
                      playKeyboardNotes(getAudioContext(), triad.map((n) => noteFrequency(n, keyboardOctave)), keyboardVoice, 90);
                    }}
                    className="glass-pill btn-sound flex flex-col items-start border-white/10 bg-white/5 px-4 py-2 transition hover:border-[var(--color-berry)]"
                    title={`${triad.join(" ")} — tap to play`}
                  >
                    <span className="text-[10px] font-black uppercase text-[var(--color-berry)]">{romanNumeral(degree, quality)}</span>
                    <span className="flex items-center gap-1 text-sm font-black">
                      <SoundIndicator className="h-3 w-3" />
                      {triad[0]}{quality === "m" ? "m" : quality === "dim" ? "°" : quality === "aug" ? "+" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="eyebrow text-[0.62rem]">Scale Theory</span>
              <InfoTooltip
                content="Learn about the theory behind scales including interval patterns and note relationships. Understanding theory helps you compose and improvise more effectively."
                position="top"
                size="md"
              />
            </div>
            <ScaleTheory
              intervals={scaleIntervals}
              intervalNames={INTERVAL_NAMES}
              notes={scaleNotes}
              root={scaleRoot}
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* 3. Chord Constructor & Inversions (Less critical: Closed by default) */}
      <CollapsibleCard
        defaultOpen={false}
        title="Chord Constructor & Inversions"
        subtitle={`${chordRoot} ${chordType} · ${inversion === 0 ? "Root position" : `Inversion ${inversion}`}`}
        eyebrow="Harmony Builder"
        icon={<Layers className="h-5 w-5 text-[var(--color-berry)]" />}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setHighlightMode("chord"); playKeyboardNotes(getAudioContext(), chordFrequencies, keyboardVoice, 90); }}
              title="Arpeggiate chord"
              className="glass-pill btn-sound px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all hover:bg-[var(--color-berry)] hover:text-black"
            >
              <Play className="mr-1 inline h-3 w-3 fill-current" /> Arpeggiate
            </button>
            <InfoTooltip
              content="Build and explore different chord types with inversions. Inversions change which note is in the bass, creating different voicings of the same chord."
              position="left"
              size="md"
            />
          </div>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Chord root note</span>
              <InfoTooltip
                content="Select the root note (bass note) for the chord."
                position="top"
                size="sm"
              />
            </div>
            <NoteButtons
              value={chordRoot}
              onChange={(note) => { setChordRoot(note); setInversion(0); }}
              accent="berry"
              ariaLabel="Select chord root note"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-[2] items-center gap-2">
              <select
                value={chordType}
                onChange={(e) => { setChordType(e.target.value); setInversion(0); }}
                className="field flex-[2]"
              >
                {Object.keys(CHORDS).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <InfoTooltip
                content="Choose from 18 different chord types including triads, 7th chords, 9th chords, and extended voicings."
                position="top"
                size="sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={inversion}
                onChange={(e) => setInversion(Number(e.target.value))}
                className="field w-auto"
                aria-label="Chord inversion"
              >
                {Array.from({ length: Math.max(1, CHORDS[chordType].length) }, (_, i) => (
                <option key={i} value={i}>{i === 0 ? "Root Position" : `${i}${i === 1 ? "st" : i === 2 ? "nd" : "rd"} Inversion`}</option>
              ))}
            </select>
              <InfoTooltip
                content="Change the chord inversion. Root position has the root in bass, 1st inversion has the 3rd in bass, etc. Inversions create smoother voice leading."
                position="top"
                size="sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {chordNotes.map((n, i) => (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => playNoteAtOctave(n)}
                title={`Play ${n}`}
                className={`glass-pill btn-sound flex min-w-[50px] flex-col items-center border-white/10 bg-white/5 px-4 py-2 ${
                  i === 0 ? "!border-[var(--color-berry)]" : ""
                }`}
              >
                <span className="text-[8px] font-black uppercase opacity-40">
                  {i === 0 ? "Bass" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`}
                </span>
                <span className="text-sm font-black">{n}</span>
                <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-[var(--color-berry)]/70">
                  <SoundIndicator className="h-2.5 w-2.5" />{intervalName(chordRoot, n)}
                </span>
              </button>
            ))}
            <InfoTooltip
              content="Click individual notes to hear them. The bass note (highlighted in berry) determines the chord inversion and voicing."
              position="top"
              size="md"
            />
          </div>

          <ChordHowToPlay
            chordLabel={`${chordRoot} ${chordType}`}
            root={chordRoot}
            notes={chordNotes}
          />
        </div>
      </CollapsibleCard>
    </SplitViewFullScreen>
  );
}
