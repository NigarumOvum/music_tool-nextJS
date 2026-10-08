"use client";

import { useEffect, useMemo, useState } from "react";
import { Book, Layers, Music, Play, RotateCcw, Search, Sparkles, Piano, Guitar } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { ChordHowToPlay } from "@/components/music/chord-how-to-play";
import { MetronomeCard } from "@/components/music/metronome-card";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { InteractiveFretboard } from "@/components/music/interactive-fretboard";
import { useI18n } from "@/components/language-provider";
import { SoundIndicator } from "@/components/ui/sound-indicator";
import { ScaleInstrumentVisuals, ScaleTheory, NoteButtons, ScaleTypeButtons } from "@/components/music/scale-visuals";
import { useCurrentUserId, usePersistentState } from "@/lib/persist";
import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import { useAudio } from "@/components/music/audio-provider";
import { KEYBOARD_VOICES, playKeyboardNote, playKeyboardNotes, preloadVoice, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { CHROMATIC, noteFrequency } from "@/lib/music/notes";
import { GUITAR_TUNINGS } from "@/lib/music/tunings";

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
  6: [0, 4, 7, 9],
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
  const { t } = useI18n();
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

  // Preload real instrument samples in the background; playback stays live regardless.
  useEffect(() => {
    void preloadVoice(getAudioContext(), keyboardVoice).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardVoice]);

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
    <SplitViewFullScreen className="space-y-4" showControls={false}>
      {/* 0. Timing Precision (metronome, tap tempo, speed & gap trainers) */}
      <MetronomeCard />

      {/* 1. Unified Theory Lab: Master Keyboard + Scale Explorer + Fretboard */}
      <CollapsibleCard
        defaultOpen={true}
        title="Master Keyboard"
        subtitle={`${highlightMode === "scale" ? "Scale Mode" : highlightMode === "chord" ? "Chord Mode" : "—"} · ${scaleRoot} ${scaleType} · ${KEYBOARD_VOICES.find((item) => item.id === keyboardVoice)?.label}`}
        eyebrow="Theory & Fretboard Lab"
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
              Scale Mode
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
              Chord Mode
            </button>
            <InfoTooltip
              content="Toggle between scale and chord highlighting modes on the keyboard. Scale mode shows all notes in the selected scale, chord mode shows the current chord notes."
              position="left"
              size="md"
            />
          </div>
        }
      >
        <div className="space-y-6">
          {/* Scale Controls */}
          <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl border border-white/10 bg-black/20">
            <div className="flex items-center gap-2">
              <span className="field-label">Root Note</span>
              <NoteButtons value={scaleRoot} onChange={setScaleRoot} ariaLabel="Select scale root note" />
            </div>
            <div className="flex items-center gap-2">
              <span className="field-label">Scale Type</span>
              <input
                className="field w-32 sm:max-w-[140px]"
                placeholder="Search scales..."
                value={scaleSearch}
                onChange={(e) => setScaleSearch(e.target.value)}
              />
              <ScaleTypeButtons types={filteredScaleTypes} value={scaleType} onChange={setScaleType} />
            </div>
            <button
              type="button"
              onClick={() => { setHighlightMode("scale"); playNotes(scaleNotes); }}
              title="Play Scale"
              className="glass-pill btn-sound px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all hover:bg-[var(--color-brass)] hover:text-black"
            >
              <Play className="mr-1 inline h-3 w-3 fill-current" /> Play Scale
            </button>
          </div>

          {/* Split View: Piano Keyboard + Fretboard */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Piano Keyboard */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-[var(--color-copper)]">
                  <Piano className="h-4 w-4" />
                  <span>Piano Keyboard</span>
                </div>
              </div>
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
            </div>

            {/* Interactive Fretboard */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-[var(--color-brass)]">
                  <Guitar className="h-4 w-4" />
                  <span>Interactive Fretboard</span>
                </div>
              </div>
              <InteractiveFretboard
                mode="guitar"
                tuning={GUITAR_TUNINGS[0]}
                showControls={true}
                scaleOverlay={scaleType === "Major" ? "major" : scaleType === "Minor" ? "minor" : scaleType === "Pentatonic Major" ? "pentatonic" : scaleType === "Blues" ? "blues" : "none"}
                onScaleChange={(scale) => {
                  if (scale === "major") setScaleType("Major");
                  else if (scale === "minor") setScaleType("Minor");
                  else if (scale === "pentatonic") setScaleType("Pentatonic Major");
                  else if (scale === "blues") setScaleType("Blues");
                }}
                rootNote={scaleRoot}
                onRootNoteChange={setScaleRoot}
                className="scale-90 origin-top"
              />
            </div>
          </div>

          {/* Scale Notes Display */}
          <div className="flex flex-wrap gap-2 p-4 rounded-2xl border border-white/10 bg-black/20">
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

          {/* Scale Instrument Visuals */}
          <ScaleInstrumentVisuals
            notes={scaleNotes}
            root={scaleRoot}
            voice={keyboardVoice}
            onPlayNote={(note) => playNoteAtOctave(note)}
          />

          {/* Diatonic Triads */}
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
              <span className="text-[10px] text-[var(--color-sand-2)]">Click triad to play</span>
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

          {/* Scale Theory */}
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

      {/* 2. Chord Constructor & Inversions */}
      <CollapsibleCard
        defaultOpen={false}
        title="Chord Constructor"
        subtitle={`${chordRoot} ${chordType} · ${inversion === 0 ? "Root Position" : `Inversion ${inversion}`}`}
        eyebrow="Harmony Builder"
        icon={<Layers className="h-5 w-5 text-[var(--color-berry)]" />}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setHighlightMode("chord"); playKeyboardNotes(getAudioContext(), chordFrequencies, keyboardVoice, 90); }}
              title="Arpeggiate"
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
              <span className="field-label">Chord Root Note</span>
              <InfoTooltip
                content="Select the root note (starting note) for the chord."
                position="top"
                size="sm"
              />
            </div>
            <NoteButtons value={chordRoot} onChange={setChordRoot} ariaLabel="Select chord root note" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Chord Type</span>
              <InfoTooltip
                content="Choose from 17 different chord types. Each has a unique interval pattern that creates its characteristic sound."
                position="top"
                size="sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(CHORDS).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChordType(type)}
                  className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    chordType === type
                      ? "bg-[var(--color-berry)] text-black"
                      : "text-[var(--color-sand-2)] hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="field-label">Inversion</span>
              <InfoTooltip
                content="Inversions change which note is in the bass. Root position has the root in the bass, first inversion has the third, second inversion has the fifth."
                position="top"
                size="sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((inv) => (
                <button
                  key={inv}
                  type="button"
                  onClick={() => setInversion(inv)}
                  className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
                    inversion === inv
                      ? "bg-[var(--color-berry)] text-black"
                      : "text-[var(--color-sand-2)] hover:text-white"
                  }`}
                >
                  {inv === 0 ? "Root Position" : `Inversion ${inv}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {chordNotes.map((n, i) => (
              <button
                key={`${n}-${i}`}
                type="button"
                onClick={() => playNoteAtOctave(n)}
                title={`Play ${n}`}
                className="glass-pill btn-sound flex min-w-[50px] flex-col items-center border-white/10 bg-white/5 px-4 py-2 hover:border-[var(--color-berry)]"
              >
                <span className="text-[8px] font-black uppercase opacity-40">{i + 1}</span>
                <span className="text-sm font-black">{n}</span>
                <span className="flex items-center gap-1 text-[8px] font-bold uppercase text-[var(--color-berry)]/70">
                  <SoundIndicator className="h-2.5 w-2.5" />{intervalName(chordRoot, n)}
                </span>
              </button>
            ))}
          </div>

          <PianoKeyboard
            activeNotes={chordNotes}
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
        </div>
      </CollapsibleCard>

      {/* 3. Chord How-to-Play */}
      <ChordHowToPlay chordLabel={chordType} root={chordRoot} notes={chordNotes} />
    </SplitViewFullScreen>
  );
}
