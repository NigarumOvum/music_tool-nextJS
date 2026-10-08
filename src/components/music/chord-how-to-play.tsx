"use client";

import { useMemo, useState } from "react";
import { Drum, Guitar, Mic2, Music2, Piano, Play } from "lucide-react";

import { useI18n } from "@/components/language-provider";
import { InteractiveFretboard } from "@/components/music/interactive-fretboard";
import { useAudio } from "@/components/music/audio-provider";
import { AVAILABLE_INSTRUMENTS } from "@/lib/music/instruments";
import { CHROMATIC, noteFrequency } from "@/lib/music/notes";
import { GUITAR_TUNINGS, BASS_TUNINGS } from "@/lib/music/tunings";
import { playKeyboardNote, type KeyboardVoice } from "@/lib/music/keyboard-synth";
import { playReferencePluck } from "@/lib/music/instrument-synth";
import { playMetronomeSound } from "@/lib/music/metronome-sound";

const INSTRUMENT_ICONS: Record<string, typeof Guitar> = {
  piano: Piano,
  guitar: Guitar,
  bass: Music2,
  ukulele: Guitar,
  drums: Drum,
  vocals: Mic2,
};

const GUITAR_OPEN = ["E", "A", "D", "G", "B", "E"];
const BASS_OPEN = ["E", "A", "D", "G"];
const UKULELE_OPEN = ["G", "C", "E", "A"];

function pc(note: string) {
  return CHROMATIC.indexOf(note as (typeof CHROMATIC)[number]);
}

/** Keep inversion order: each tone sits at or above the previous pitch. */
function stackedFrequencies(notes: string[], baseOctave: number): number[] {
  const out: number[] = [];
  for (const note of notes) {
    let frequency = noteFrequency(note, baseOctave);
    const previous = out[out.length - 1];
    if (previous !== undefined) {
      while (frequency <= previous) frequency *= 2;
    }
    out.push(frequency);
  }
  return out;
}

function voiceForInstrument(instrumentId: string): KeyboardVoice | null {
  if (instrumentId === "piano") return "piano";
  if (instrumentId === "vocals") return "strings";
  return null;
}

/** Greedy fret assignment: cover every chord tone, then fill with octaves. */
function fretsForShape(openStrings: string[], chordNotes: string[]): (number | -1)[] {
  const covered = new Set<string>();
  return openStrings.map((open) => {
    const openPc = pc(open);
    if (openPc === -1) return -1;
    let bestFret = -1;
    let bestScore = Infinity;
    for (const tone of chordNotes) {
      const tonePc = pc(tone);
      if (tonePc === -1) continue;
      const fret = (tonePc - openPc + 12) % 12;
      const alreadyCovered = covered.has(tone);
      // Prefer uncovering new tones, then lowest fret.
      const score = fret + (alreadyCovered ? 12 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestFret = fret;
      }
    }
    if (bestFret === -1) return -1;
    // Mute strings that would need an awkward stretch (>5) unless it's the bass root string.
    const toneAtBest = CHROMATIC[(openPc + bestFret) % 12];
    covered.add(toneAtBest);
    return bestFret;
  });
}

function FretDiagram({ openStrings, frets }: { openStrings: string[]; frets: (number | -1)[] }) {
  const maxFret = Math.max(4, ...frets.filter((f): f is number => f >= 0));
  const shown = Math.min(maxFret, 7);
  return (
    <div className="flex gap-1">
      {openStrings.map((open, idx) => {
        const fret = frets[idx];
        return (
          <div key={`${open}-${idx}`} className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-black text-[var(--color-sand-2)]">{open}</span>
            <div className="flex flex-col gap-px rounded bg-black/30 p-0.5">
              {Array.from({ length: shown }, (_, f) => {
                const fretNo = f + 1;
                return (
                  <div
                    key={fretNo}
                    className={`flex h-4 w-5 items-center justify-center rounded-sm text-[8px] font-black ${
                      fret === fretNo
                        ? "bg-[var(--color-mint)] text-black"
                        : fret === 0 && f === 0
                          ? "bg-[var(--color-brass)] text-black"
                          : "bg-white/5 text-transparent"
                    }`}
                  >
                    {fret === fretNo ? fretNo : fret === 0 && f === 0 ? "0" : "·"}
                  </div>
                );
              })}
            </div>
            <span className="text-[8px] font-bold text-[var(--color-sand-2)]">
              {fret === -1 ? "x" : fret === 0 ? "open" : `f${fret}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ChordHowToPlay({
  chordLabel,
  root,
  notes,
}: {
  chordLabel: string;
  root: string;
  notes: string[];
}) {
  const { t } = useI18n();
  const { getAudioContext } = useAudio();
  const [showInteractiveFretboard, setShowInteractiveFretboard] = useState(false);
  const [fretboardMode, setFretboardMode] = useState<"guitar" | "bass">("guitar");
  const [fretboardRootNote, setFretboardRootNote] = useState(root);

  const bassNote = notes[0] ?? root;

  const playChordForInstrument = (instrumentId: string) => {
    const audioContext = getAudioContext();
    const now = audioContext.currentTime;
    const chordFreqs = stackedFrequencies(notes, 4);
    const guitarFreqs = stackedFrequencies(notes, 3);
    const bassFreqs = stackedFrequencies(notes, 2);
    const keyboardVoice = voiceForInstrument(instrumentId);

    if (keyboardVoice) {
      chordFreqs.forEach((frequency, index) => {
        playKeyboardNote(audioContext, frequency, keyboardVoice, now + index * 0.03);
      });
      return;
    }

    if (instrumentId === "guitar") {
      guitarFreqs.forEach((frequency, index) => {
        playReferencePluck(audioContext, frequency, "guitar-steel", now + index * 0.04);
      });
      return;
    }

    if (instrumentId === "ukulele") {
      chordFreqs.forEach((frequency, index) => {
        playReferencePluck(audioContext, frequency, "guitar-nylon", now + index * 0.035);
      });
      return;
    }

    if (instrumentId === "bass") {
      bassFreqs.forEach((frequency, index) => {
        playReferencePluck(audioContext, frequency, index === 0 ? "bass" : "bass-pick", now + index * 0.05);
      });
      return;
    }

    if (instrumentId === "drums") {
      playMetronomeSound(audioContext, "mechanical", true, 1, now);
      playMetronomeSound(audioContext, "woodblock", false, 0.45, now + 0.25, true);
      playMetronomeSound(audioContext, "rimshot", false, 1, now + 0.5);
      playMetronomeSound(audioContext, "woodblock", false, 0.45, now + 0.75, true);
    }
  };

  const playable = useMemo(
    () =>
      AVAILABLE_INSTRUMENTS.filter((item) =>
        ["piano", "guitar", "ukulele", "bass", "drums", "vocals"].includes(item.id),
      ),
    [],
  );

  const guitarFrets = useMemo(() => fretsForShape(GUITAR_OPEN, notes), [notes]);
  const bassFrets = useMemo(() => fretsForShape(BASS_OPEN, [bassNote]), [bassNote]);
  const ukuleleFrets = useMemo(() => fretsForShape(UKULELE_OPEN, notes), [notes]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-black/15 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="eyebrow text-[0.62rem]">{t("theory.howToPlay")} · {chordLabel}</span>
        <span className="text-[10px] text-[var(--color-sand-2)]">{t("theory.sameList")}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {playable.map((instrument) => {
          const Icon = INSTRUMENT_ICONS[instrument.id] ?? Music2;
          return (
            <div
              key={instrument.id}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                  <span className="text-xs font-black">{instrument.label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => playChordForInstrument(instrument.id)}
                  className="glass-pill btn-sound flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-wider hover:border-[var(--color-mint)] hover:text-[var(--color-mint)]"
                  title={`${t("theory.playChord")} · ${instrument.label}`}
                >
                  <Play className="h-2.5 w-2.5 fill-current" />
                  {t("theory.playChord")}
                </button>
              </div>
              {instrument.id === "piano" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  {t("theory.pianoHow")
                    .replace("{notes}", notes.join(" – "))
                    .replace("{bass}", bassNote)}
                </p>
              )}
              {instrument.id === "guitar" && (
                <FretDiagram openStrings={GUITAR_OPEN} frets={guitarFrets} />
              )}
              {instrument.id === "ukulele" && (
                <FretDiagram openStrings={UKULELE_OPEN} frets={ukuleleFrets} />
              )}
              {instrument.id === "bass" && (
                <div className="space-y-2">
                  <FretDiagram openStrings={BASS_OPEN} frets={bassFrets} />
                  <p className="text-[11px] text-[var(--color-sand-2)]">
                    {t("theory.bassHow").replace("{root}", bassNote)}
                  </p>
                </div>
              )}
              {instrument.id === "drums" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  {t("theory.drumsHow").replace("{root}", bassNote)}
                </p>
              )}
              {instrument.id === "vocals" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  {t("theory.vocalsHow").replace("{notes}", notes.join(" · "))}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-white/8 pt-4">
        <button
          type="button"
          onClick={() => setShowInteractiveFretboard(!showInteractiveFretboard)}
          className="glass-pill w-full px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-mint)]"
        >
          {showInteractiveFretboard ? "Hide" : "Show"} Interactive Fretboard
        </button>

        {showInteractiveFretboard && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)]">
                Mode
              </label>
              <select
                value={fretboardMode}
                onChange={(e) => setFretboardMode(e.target.value as "guitar" | "bass")}
                className="glass-pill border-white/10 bg-black/40 px-3 py-1.5 text-xs font-bold text-[var(--color-mint)] outline-none"
              >
                <option value="guitar">Guitar</option>
                <option value="bass">Bass</option>
              </select>
            </div>
            <InteractiveFretboard
              mode={fretboardMode}
              tuning={fretboardMode === "guitar" ? GUITAR_TUNINGS[0] : BASS_TUNINGS[0]}
              showControls={true}
              scaleOverlay="major"
              rootNote={fretboardRootNote}
              onRootNoteChange={setFretboardRootNote}
              className="scale-90 origin-top"
            />
          </div>
        )}
      </div>
    </div>
  );
}
