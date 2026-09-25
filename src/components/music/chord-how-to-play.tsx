"use client";

import { useMemo } from "react";
import { Drum, Guitar, Mic2, Music2, Piano } from "lucide-react";

import { AVAILABLE_INSTRUMENTS } from "@/lib/music/instruments";
import { CHROMATIC } from "@/lib/music/notes";

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
  const playable = useMemo(
    () =>
      AVAILABLE_INSTRUMENTS.filter((item) =>
        ["piano", "guitar", "ukulele", "bass", "drums", "vocals"].includes(item.id),
      ),
    [],
  );

  const guitarFrets = useMemo(() => fretsForShape(GUITAR_OPEN, notes), [notes]);
  const bassFrets = useMemo(() => fretsForShape(BASS_OPEN, [root]), [root]);
  const ukuleleFrets = useMemo(() => fretsForShape(UKULELE_OPEN, notes), [notes]);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-black/15 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="eyebrow text-[0.62rem]">How to play · {chordLabel}</span>
        <span className="text-[10px] text-[var(--color-sand-2)]">Same list everywhere</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {playable.map((instrument) => {
          const Icon = INSTRUMENT_ICONS[instrument.id] ?? Music2;
          return (
            <div
              key={instrument.id}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 text-[var(--color-brass)]" />
                <span className="text-xs font-black">{instrument.label}</span>
              </div>
              {instrument.id === "piano" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  Keys <span className="font-black text-white">{notes.join(" – ")}</span> in one
                  octave. Bass note <span className="font-black text-[var(--color-berry)]">{notes[0] ?? root}</span> in
                  the left hand.
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
                    Root <span className="font-black text-white">{root}</span> on the E string, add
                    the fifth for movement.
                  </p>
                </div>
              )}
              {instrument.id === "drums" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  Kick on beat 1 with the <span className="font-black text-white">{root}</span>{" "}
                  accent, hats on 8ths, snare backbeat — chord changes land on bar lines.
                </p>
              )}
              {instrument.id === "vocals" && (
                <p className="text-xs text-[var(--color-sand-1)]">
                  Sing low → high:{" "}
                  <span className="font-black text-white">{notes.join(" · ")}</span> to lock the
                  voicing by ear.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
