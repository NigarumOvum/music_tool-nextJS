"use client";

import { useMemo, useState } from "react";
import { Guitar, Piano, Drum, Music2, Play, Search, Sparkles } from "lucide-react";

import { CollapsibleCard } from "@/components/collapsible-card";
import { InfoTooltip } from "@/components/info-tooltip";
import { PianoKeyboard } from "@/components/music/piano-keyboard";
import { AVAILABLE_INSTRUMENTS } from "@/lib/music/instruments";
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

const INSTRUMENTS = (["piano", "guitar", "bass", "drums"] as const).map((id) => {
  const meta = AVAILABLE_INSTRUMENTS.find((item) => item.id === id)!;
  const icon = id === "piano" ? Piano : id === "guitar" ? Guitar : id === "bass" ? Music2 : Drum;
  return { id, label: meta.label, icon };
});

type InstrumentId = (typeof INSTRUMENTS)[number]["id"];

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

function GuitarFretboard({ notes, root }: { notes: string[]; root: string }) {
  const strings = ["E", "A", "D", "G", "B", "E"];
  const frets = 12;

  const getFretPosition = (stringNote: string, targetNote: string) => {
    const stringIndex = CHROMATIC.indexOf(stringNote as (typeof CHROMATIC)[number]);
    const targetIndex = CHROMATIC.indexOf(targetNote as (typeof CHROMATIC)[number]);
    const diff = (targetIndex - stringIndex + 12) % 12;
    return diff;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Guitar className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Guitar Fretboard</h3>
        <InfoTooltip
          content="Shows scale positions across all 6 strings and 12 frets. Copper cells show root notes, mint cells show other scale notes. Use this to find scale patterns on guitar."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2 overflow-x-auto pb-2">
        {strings.map((string, stringIdx) => (
          <div key={string} className="flex items-center gap-1">
            <span className="w-8 text-right text-xs font-bold text-[var(--color-sand-2)]">{string}</span>
            <div className="flex gap-1">
              {Array.from({ length: frets }).map((_, fret) => {
                const note = CHROMATIC[(CHROMATIC.indexOf(string as (typeof CHROMATIC)[number]) + fret) % 12];
                const isInScale = notes.includes(note);
                const isRoot = note === root;
                return (
                  <div
                    key={fret}
                    className={`h-8 w-8 flex items-center justify-center rounded text-[10px] font-bold transition ${
                      isInScale
                        ? isRoot
                          ? "bg-[var(--color-copper)] text-white"
                          : "bg-[var(--color-mint)]/80 text-black"
                        : "bg-white/5 text-[var(--color-sand-2)]"
                    }`}
                  >
                    {isInScale ? note : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BassFretboard({ notes, root }: { notes: string[]; root: string }) {
  const strings = ["E", "A", "D", "G"];
  const frets = 12;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Bass Fretboard</h3>
        <InfoTooltip
          content="Shows scale positions across 4 bass strings and 12 frets. Similar to guitar but optimized for bass guitar patterns."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2 overflow-x-auto pb-2">
        {strings.map((string) => (
          <div key={string} className="flex items-center gap-1">
            <span className="w-8 text-right text-xs font-bold text-[var(--color-sand-2)]">{string}</span>
            <div className="flex gap-1">
              {Array.from({ length: frets }).map((_, fret) => {
                const note = CHROMATIC[(CHROMATIC.indexOf(string as (typeof CHROMATIC)[number]) + fret) % 12];
                const isInScale = notes.includes(note);
                const isRoot = note === root;
                return (
                  <div
                    key={fret}
                    className={`h-10 w-10 flex items-center justify-center rounded text-xs font-bold transition ${
                      isInScale
                        ? isRoot
                          ? "bg-[var(--color-copper)] text-white"
                          : "bg-[var(--color-mint)]/80 text-black"
                        : "bg-white/5 text-[var(--color-sand-2)]"
                    }`}
                  >
                    {isInScale ? note : ""}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DrumPattern({ notes }: { notes: string[] }) {
  const drumKit = ["Kick", "Snare", "Hi-hat", "Open HH", "Crash", "Ride", "Tom L", "Tom M", "Tom H"];
  const [pattern, setPattern] = useState(drumKit.map(() => Array.from({ length: 16 }, () => false)));

  const toggleCell = (drumIdx: number, step: number) => {
    setPattern((current) =>
      current.map((row, idx) =>
        idx === drumIdx ? row.map((cell, s) => (s === step ? !cell : cell)) : row,
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Drum className="h-4 w-4 text-[var(--color-brass)]" />
        <h3 className="text-lg font-black">Drum Pattern</h3>
        <InfoTooltip
          content="16-step drum pattern editor. Click cells to add/remove hits. Use this to create rhythmic patterns that complement your chosen scale."
          position="right"
          size="md"
        />
      </div>
      <div className="space-y-2">
        {drumKit.map((drum, drumIdx) => (
          <div key={drum} className="flex items-center gap-1">
            <span className="w-20 text-xs font-bold uppercase text-[var(--color-sand-2)]">{drum}</span>
            <div className="flex gap-1">
              {Array.from({ length: 16 }).map((_, step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => toggleCell(drumIdx, step)}
                  className={`h-6 w-6 rounded border text-[8px] font-bold transition ${
                    pattern[drumIdx][step]
                      ? step % 4 === 0
                        ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white"
                        : "border-[var(--color-mint)] bg-[var(--color-mint)]/80 text-black"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {pattern[drumIdx][step] ? "x" : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScalesClient() {
  const audio = useAudio();
  const [root, setRoot] = useState("C");
  const [scale, setScale] = useState("Major");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [voice, setVoice] = useState<KeyboardVoice>("piano");
  const [search, setSearch] = useState("");

  const scaleNotes = useMemo(() => getNotes(root, SCALES[scale]), [root, scale]);
  const scaleIntervals = useMemo(() => SCALES[scale], [scale]);

  const filteredScales = useMemo(
    () => Object.keys(SCALES).filter((s) => s.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  const activeInstrument = INSTRUMENTS.find((i) => i.id === instrument);
  const InstrumentIcon = activeInstrument?.icon ?? Music2;

  function playScale() {
    if (!audio) return;
    const audioContext = audio.getAudioContext();
    const frequencies = scaleNotes.map((note) => noteFrequency(note, 4));
    playKeyboardNotes(audioContext, frequencies, voice);
  }

  function playNote(note: string) {
    if (!audio) return;
    const audioContext = audio.getAudioContext();
    const freq = noteFrequency(note, 4);
    playKeyboardNote(audioContext, freq, voice);
  }

  return (
    <SplitViewFullScreen className="space-y-4">
      <div className="panel glass-shine rounded-[1.25rem] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-[var(--color-brass)]" />
            <h2 className="text-xl font-black">Scale Explorer</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <select
                className="field"
                value={root}
                onChange={(e) => setRoot(e.target.value)}
              >
                {CHROMATIC.map((note) => (
                  <option key={note} value={note}>{note}</option>
                ))}
              </select>
              <InfoTooltip
                content="The root note is the starting note of the scale. All other notes in the scale are calculated from this note."
                position="top"
                size="sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                className="field"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
              >
                {filteredScales.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <InfoTooltip
                content="Choose from 13 different scale types including Major, Minor, Pentatonic, Blues, and various modes. Each scale has a unique pattern of intervals."
                position="top"
                size="sm"
              />
            </div>
            <input
              className="field"
              placeholder="Search scales..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel glass-shine rounded-[1.25rem] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((inst) => {
              const Icon = inst.icon;
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => setInstrument(inst.id)}
                  className={`glass-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    instrument === inst.id
                      ? "glass-pill-active text-[var(--color-foreground)]"
                      : "text-[var(--color-sand-2)] hover:-translate-y-0.5"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {inst.label}
                </button>
              );
            })}
            <InfoTooltip
              content="Switch between different instrument visualizations to see how the scale appears on piano, guitar fretboard, bass, or drum patterns."
              position="bottom"
              size="sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={playScale}
              className="glass-pill inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition hover:-translate-y-0.5"
            >
              <Play className="h-3.5 w-3.5" />
              Play Scale
            </button>
            <div className="flex items-center gap-2">
              <select
                className="field w-auto"
                value={voice}
                onChange={(e) => setVoice(e.target.value as KeyboardVoice)}
              >
                {KEYBOARD_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <InfoTooltip
                content="Choose the instrument sound for playback. Different voices create unique timbres for the same notes."
                position="bottom"
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="panel glass-shine rounded-[1.75rem] p-5">
        <div className="mb-4 flex items-center gap-2">
          <InstrumentIcon className="h-5 w-5 text-[var(--color-brass)]" />
          <h3 className="text-2xl font-black uppercase italic tracking-tighter">
            {root} {scale} Scale
          </h3>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {scaleNotes.map((note, idx) => (
            <button
              key={note}
              type="button"
              onClick={() => playNote(note)}
              className="glass-pill inline-flex items-center gap-2 px-3 py-2 text-sm font-bold transition hover:-translate-y-0.5"
            >
              <span className={note === root ? "text-[var(--color-copper)]" : ""}>{note}</span>
              <span className="text-[10px] text-[var(--color-sand-2)]">{intervalName(root, note)}</span>
            </button>
          ))}
          <InfoTooltip
            content="Click any note to hear it individually. The interval name shows the relationship to the root note (R = root, m2 = minor 2nd, M3 = major 3rd, etc.)."
            position="top"
            size="md"
          />
        </div>

        {instrument === "piano" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Piano className="h-4 w-4 text-[var(--color-brass)]" />
              <h3 className="text-lg font-black">Piano Keyboard</h3>
              <InfoTooltip
                content="Visual representation of the scale on a piano keyboard. Copper notes are the root, mint notes are other scale degrees. Click keys to hear individual notes."
                position="right"
                size="md"
              />
            </div>
            <PianoKeyboard activeNotes={scaleNotes} onNotePlay={(note) => playNote(note)} />
          </div>
        )}

        {instrument === "guitar" && <GuitarFretboard notes={scaleNotes} root={root} />}

        {instrument === "bass" && <BassFretboard notes={scaleNotes} root={root} />}

        {instrument === "drums" && <DrumPattern notes={scaleNotes} />}
      </div>

      <CollapsibleCard
        title="Scale Theory"
        icon={<Sparkles className="h-4 w-4" />}
        defaultOpen={false}
        headerActions={
          <InfoTooltip
            content="Learn about the theory behind scales including interval patterns and note relationships. Understanding theory helps you compose and improvise more effectively."
            position="left"
            size="md"
          />
        }
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Intervals</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {scaleIntervals.map((interval, idx) => (
                <div key={interval} className="flex items-center gap-2 text-sm">
                  <span className="w-6 font-bold text-[var(--color-copper)]">{interval}</span>
                  <span className="text-[var(--color-sand-2)]">{INTERVAL_NAMES[interval] || ""}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wider">Notes</h4>
            <div className="flex flex-wrap gap-2">
              {scaleNotes.map((note) => (
                <span key={note} className={`glass-pill px-2 py-1 text-sm font-bold ${note === root ? "text-[var(--color-copper)]" : ""}`}>
                  {note}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </SplitViewFullScreen>
  );
}