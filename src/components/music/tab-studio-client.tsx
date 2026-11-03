"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Download,
  Eraser,
  FastForward,
  Layers,
  Minus,
  Music,
  Play,
  Plus,
  RefreshCw,
  Rewind,
  Save,
  SkipBack,
  Sliders,
  Square,
  Timer,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { useAudio } from "@/components/music/audio-provider";
import { useProductionSong } from "@/components/music/production-song-context";
import { FileUploadButton } from "@/components/music/file-upload-button";
import { createPartiture, deletePartiture, downloadBlob, fetchPartitures, updatePartiture } from "@/lib/music/client";
import { readStoredRaw, useCurrentUserId, userKey, writeStored } from "@/lib/persist";
import type { MusicPartitureRecord } from "@/lib/music/types";
import {
  NOTE_DIVISIONS,
  reconcileTabGridRows,
  secondsPerStep,
  stepsPerBar,
  stepsPerBeat,
  type NoteDivision,
  type TimeSignature,
} from "@/lib/music/tab-grid";
import { parseMidiFile, type MidiTrackData, type ParsedMidi } from "@/lib/music/midi-parser";
import {
  BASS_TUNINGS,
  GUITAR_TUNINGS,
  type TuningPreset,
  type TuningString,
} from "@/lib/music/tunings";
import { playReferencePluck, preloadPluck, type PluckInstrument } from "@/lib/music/instrument-synth";
import { playMetronomeSound } from "@/lib/music/metronome-sound";

type InstrumentType = "Steel" | "Nylon" | "Bass" | "Overdrive";

const TAB_DRAFT_KEY = "tab_studio_draft_v1";

interface StringFreq {
  label: string;
  note: string;
  base: number;
}

type GridRow = {
  label: string;
  cells: string[];
};

type FretboardComposition = {
  version: 1 | 2;
  instrument: InstrumentType;
  tuningId: string;
  bpm: number;
  timeSignature: TimeSignature;
  noteDivision: NoteDivision;
  noteLength: number;
  columnCount: number;
  grid: GridRow[];
};

const TIME_SIGNATURES: TimeSignature[] = [
  { numerator: 2, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 4, denominator: 4 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 7, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 12, denominator: 8 },
];

const INSTRUMENT_TYPES: InstrumentType[] = ["Steel", "Nylon", "Bass", "Overdrive"];
const FRETBOARD_COMPOSITION_FORMAT = "fretboard-grid-v1";

export type MultiTrackItem = {
  index: number;
  name: string;
  notesCount: number;
  instrument: InstrumentType;
  tuningId: string;
  grid: GridRow[];
};

function stringsFromTuning(preset: TuningPreset): StringFreq[] {
  return [...preset.strings].reverse().map((s) => ({
    label: s.label,
    note: s.note,
    base: s.frequency,
  }));
}

function buildEmptyGrid(strings: StringFreq[], columns: number): GridRow[] {
  return strings.map((string) => ({
    label: string.label,
    cells: Array.from({ length: columns }, () => "-"),
  }));
}

function parseFretboardComposition(content: string): FretboardComposition | null {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;

    const candidate = parsed as Partial<FretboardComposition>;
    const meter = candidate.timeSignature ?? { numerator: 4, denominator: 4 as const };
    if (
      (candidate.version !== 1 && candidate.version !== 2) ||
      !INSTRUMENT_TYPES.includes(candidate.instrument as InstrumentType) ||
      typeof candidate.tuningId !== "string" ||
      typeof candidate.bpm !== "number" ||
      candidate.bpm < 40 ||
      candidate.bpm > 260 ||
      !TIME_SIGNATURES.some((signature) =>
        signature.numerator === meter.numerator && signature.denominator === meter.denominator
      ) ||
      (candidate.noteDivision !== undefined &&
        !NOTE_DIVISIONS.includes(candidate.noteDivision as NoteDivision)) ||
      (candidate.noteLength !== undefined &&
        ![50, 75, 100].includes(candidate.noteLength)) ||
      !Number.isInteger(candidate.columnCount) ||
      (candidate.columnCount ?? 0) < 1 ||
      !Array.isArray(candidate.grid) ||
      candidate.grid.length === 0 ||
      candidate.grid.some((row) =>
        !row ||
        typeof row.label !== "string" ||
        !Array.isArray(row.cells) ||
        row.cells.length !== candidate.columnCount ||
        row.cells.some((cell) => typeof cell !== "string")
      )
    ) {
      return null;
    }

    return {
      ...candidate,
      version: 2,
      timeSignature: meter,
      noteDivision: candidate.noteDivision ?? 16,
      noteLength: candidate.noteLength ?? 100,
    } as FretboardComposition;
  } catch {
    return null;
  }
}

function parseAsciiTab(content: string, strings: StringFreq[]): GridRow[] | null {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const parsed = lines
    .map((line) => {
      const match = line.match(/^([A-Ga-g#b]+)\s*\|(.+)\|$/);
      if (!match) return null;
      const label = match[1].toLowerCase();
      const cells = match[2]
        .replace(/\|/g, "")
        .split("-")
        .map((cell) => (cell.trim() === "" ? "-" : cell.trim()));
      return { label, cells };
    })
    .filter((row): row is GridRow => Boolean(row));

  if (parsed.length === 0) return null;

  const columnCount = Math.max(...parsed.map((row) => row.cells.length));
  const usedRows = new Set<number>();
  return strings.map((string, stringIndex) => {
    let foundIndex = parsed.findIndex(
      (row, index) => !usedRows.has(index) && row.label.toLowerCase() === string.label.toLowerCase(),
    );
    if (foundIndex < 0 && stringIndex < parsed.length && !usedRows.has(stringIndex)) {
      foundIndex = stringIndex;
    }
    if (foundIndex < 0) {
      return { label: string.label, cells: Array.from({ length: columnCount }, () => "-") };
    }

    usedRows.add(foundIndex);
    const found = parsed[foundIndex];
    if (!found) {
      return { label: string.label, cells: Array.from({ length: columnCount }, () => "-") };
    }
    const cells = found.cells.slice(0, columnCount);
    while (cells.length < columnCount) cells.push("-");
    return { label: string.label, cells };
  });
}

function gridToAscii(
  grid: GridRow[],
  instrument: string,
  bpm: number,
  tuningName: string,
  timeSignature: TimeSignature,
  noteDivision: NoteDivision,
  noteLength: number,
) {
  const barSteps = stepsPerBar(timeSignature, noteDivision);
  const lines = grid.map((row) => {
    const chunks: string[] = [];
    for (let i = 0; i < row.cells.length; i += barSteps) {
      chunks.push(
        row.cells.slice(i, i + barSteps).map((cell) => (cell === "-" || cell === "" ? "-" : cell)).join("-"),
      );
    }
    return `${row.label.padEnd(2, " ")} |${chunks.join("|")}|`;
  });
  return [
    `Tab Studio Export (${instrument})`,
    `Tuning: ${tuningName}`,
    `Tempo: ${bpm} BPM`,
    `Time signature: ${timeSignature.numerator}/${timeSignature.denominator}`,
    `Grid: 1/${noteDivision} notes · Note length: ${noteLength}%`,
    "",
    ...lines,
    "",
  ].join("\n");
}

function convertTrackToGrid(track: MidiTrackData, strings: StringFreq[], ppq = 480): GridRow[] {
  const stepsPerQuarter = 4; // 16th-note grid resolution
  const ticksPerStep = Math.max(1, Math.round(ppq / stepsPerQuarter));
  const maxTick = track.notes.reduce((max, n) => Math.max(max, n.endTick), 0);
  const calculatedColumns = Math.max(32, Math.ceil(maxTick / ticksPerStep) + 8);
  const newGrid = buildEmptyGrid(strings, calculatedColumns);

  const stepGroups = new Map<number, number[]>();
  for (const note of track.notes) {
    const step = Math.floor(note.startTick / ticksPerStep);
    if (!stepGroups.has(step)) stepGroups.set(step, []);
    stepGroups.get(step)!.push(note.note);
  }

  for (const [step, notes] of stepGroups) {
    if (step < 0 || step >= newGrid[0].cells.length) continue;
    const usedStrings = new Set<number>();
    notes.sort((a, b) => a - b);

    for (const midiNote of notes) {
      let bestStringIdx = -1;
      let bestFret = 25;

      strings.forEach((stringRef, stringIdx) => {
        if (usedStrings.has(stringIdx)) return;
        const openPitch = Math.round(69 + 12 * Math.log2(stringRef.base / 440));
        const fret = midiNote - openPitch;
        if (fret >= 0 && fret <= 24 && fret < bestFret) {
          bestFret = fret;
          bestStringIdx = stringIdx;
        }
      });

      if (bestStringIdx >= 0) {
        usedStrings.add(bestStringIdx);
        newGrid[bestStringIdx].cells[step] = String(bestFret);
      }
    }
  }

  return newGrid;
}

const GUITAR_CHORD_SHAPES: Record<string, number[]> = {
  A: [0, 2, 2, 2, 0, -1],
  Am: [0, 1, 2, 2, 0, -1],
  C: [0, 1, 0, 2, 3, -1],
  D: [2, 3, 2, 0, -1, -1],
  E: [0, 0, 1, 2, 2, 0],
  Em: [0, 0, 0, 2, 2, 0],
  F: [1, 1, 2, 3, 3, -1],
  G: [3, 3, 0, 0, 0, 3],
  A5: [-1, -1, 2, 2, 0, -1],
  E5: [-1, -1, 2, 2, 0, 0],
};

const BASS_CHORD_SHAPES: Record<string, number[]> = {
  A: [-1, -1, 7, 5],
  Am: [-1, -1, 7, 5],
  C: [-1, -1, 5, 3],
  D: [-1, -1, 7, 5],
  E: [-1, -1, 9, 7],
  Em: [-1, -1, 9, 7],
  F: [-1, -1, 3, 1],
  G: [-1, -1, 5, 3],
};

function getChordShape(chord: string, bass: boolean) {
  return bass ? BASS_CHORD_SHAPES[chord] : GUITAR_CHORD_SHAPES[chord];
}

export function TabStudioClient() {
  const { getAudioContext } = useAudio();
  const { selectedSongId } = useProductionSong();
  const playingRef = useRef(false);
  const schedulerRef = useRef<number | null>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);

  const [instrument, setInstrument] = useState<InstrumentType>("Steel");
  const [tuningId, setTuningId] = useState<string>("guitar-standard");
  const [columnCount, setColumnCount] = useState(16);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [noteDivision, setNoteDivision] = useState<NoteDivision>(16);
  const [noteLength, setNoteLength] = useState(100);
  const [playhead, setPlayhead] = useState(-1);
  const [metronome, setMetronome] = useState(false);
  const [savedPartitures, setSavedPartitures] = useState<MusicPartitureRecord[]>([]);
  const [activePartitureId, setActivePartitureId] = useState<string | null>(null);
  const [compositionTitle, setCompositionTitle] = useState("");
  const [savingComposition, setSavingComposition] = useState(false);
  const [loadingPartitures, setLoadingPartitures] = useState(false);
  const [pastedAscii, setPastedAscii] = useState("");
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [gridViewportWidth, setGridViewportWidth] = useState(0);
  const userId = useCurrentUserId();
  const draftKey = userId && selectedSongId
    ? userKey(userId, `tab_studio_draft:${selectedSongId}`)
    : TAB_DRAFT_KEY;
  const lastWrittenDraftRef = useRef<string | null>(null);

  // Multi-track MIDI separation state
  const [multiTracks, setMultiTracks] = useState<MultiTrackItem[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState<number>(0);

  const tuningOptions = useMemo(() => {
    return instrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
  }, [instrument]);

  const activeTuning = useMemo(() => {
    return tuningOptions.find((t) => t.id === tuningId) || tuningOptions[0];
  }, [tuningId, tuningOptions]);

  const strings = useMemo(() => stringsFromTuning(activeTuning), [activeTuning]);

  const [grid, setGrid] = useState<GridRow[]>(() => buildEmptyGrid(stringsFromTuning(GUITAR_TUNINGS[0]), 16));
  const measureSteps = stepsPerBar(timeSignature, noteDivision);
  const beatSteps = stepsPerBeat(timeSignature, noteDivision);

  function changeInstrument(nextInstrument: InstrumentType) {
    const nextOptions = nextInstrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
    const nextTuning = nextOptions.find((preset) => preset.id === tuningId) ?? nextOptions[0];
    const nextStrings = stringsFromTuning(nextTuning);

    setInstrument(nextInstrument);
    setTuningId(nextTuning.id);
    setGrid((current) => reconcileTabGridRows(
      current,
      nextStrings.map((string) => string.label),
      current[0]?.cells.length || columnCount,
    ));
  }

  function changeTuning(nextTuningId: string) {
    const nextTuning = tuningOptions.find((preset) => preset.id === nextTuningId);
    if (!nextTuning) return;

    const nextStrings = stringsFromTuning(nextTuning);
    setTuningId(nextTuning.id);
    setGrid((current) => reconcileTabGridRows(
      current,
      nextStrings.map((string) => string.label),
      current[0]?.cells.length || columnCount,
    ));
  }

  const asciiPreview = useMemo(
    () => gridToAscii(grid, instrument, bpm, activeTuning.name, timeSignature, noteDivision, noteLength),
    [grid, instrument, bpm, activeTuning.name, timeSignature, noteDivision, noteLength],
  );
  const gridStepCount = grid[0]?.cells.length ?? columnCount;
  const barCount = Math.ceil(gridStepCount / measureSteps);
  const stepWidth = Math.max(34, Math.min(48, (gridViewportWidth - 64) / gridStepCount));

  useEffect(() => {
    const viewport = gridViewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setGridViewportWidth(entry.contentRect.width);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Preload real string samples in the background; grid keeps playing live regardless.
  useEffect(() => {
    const pluck: PluckInstrument =
      instrument === "Nylon" ? "guitar-nylon" : instrument === "Bass" ? "bass" : "guitar-steel";
    void preloadPluck(getAudioContext(), pluck).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument]);

  // Keyboard shortcut: Space to play/pause
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      setIsPlaying((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const createOverdriveCurve = useCallback(() => {
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; i += 1) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + 20) * x * 20 * deg) / (Math.PI + 20 * Math.abs(x));
    }
    return curve;
  }, []);

  const playPluck = useCallback((fret: number, stringIdx: number, time: number, duration: number) => {
    if (fret < 0 || Number.isNaN(fret) || stringIdx >= strings.length) return;
    const ctx = getAudioContext();
    const freq = strings[stringIdx].base * 2 ** (fret / 12);
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.3, time);

    if (instrument === "Overdrive") {
      const shaper = ctx.createWaveShaper();
      shaper.curve = createOverdriveCurve();
      shaper.oversample = "4x";
      masterGain.connect(shaper);
      shaper.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    // Shared pluck engine: real samples when loaded, Karplus-Strong string otherwise.
    const pluck: PluckInstrument =
      instrument === "Nylon" ? "guitar-nylon" : instrument === "Bass" ? "bass" : "guitar-steel";
    playReferencePluck(ctx, freq, pluck, time, 0.9, masterGain, duration);
  }, [createOverdriveCurve, getAudioContext, instrument, strings]);

  const playMetronomeClick = useCallback((time: number, accent: boolean) => {
    const ctx = getAudioContext();
    playMetronomeSound(ctx, "woodblock", accent, 0.75, time, !accent);
  }, [getAudioContext]);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const ctx = getAudioContext();
    void ctx.resume();
    const stepDuration = secondsPerStep(bpm, noteDivision);
    const LOOKAHEAD_SECONDS = 0.2;
    let currentStep = Math.max(0, playhead);
    let nextStepTime = ctx.currentTime + 0.1;

    const scheduleStep = (step: number, time: number) => {
      setPlayhead(step);
      if (metronome && step % beatSteps === 0) {
        playMetronomeClick(time, step % measureSteps === 0);
      }
      grid.forEach((row, stringIdx) => {
        const cell = row.cells[step];
        if (cell !== "-" && cell !== "") {
          playPluck(parseInt(cell, 10), stringIdx, time, stepDuration * (noteLength / 100));
        }
      });
    };

    const schedulerLoop = () => {
      if (!playingRef.current) return;
      const now = getAudioContext().currentTime;
      if (nextStepTime < now - LOOKAHEAD_SECONDS) {
        nextStepTime = now + 0.05;
      }
      while (nextStepTime < now + LOOKAHEAD_SECONDS) {
        if (currentStep >= grid[0].cells.length) {
          if (!loopPlayback) {
            setIsPlaying(false);
            setPlayhead(-1);
            return;
          }
          currentStep = 0;
          nextStepTime += stepDuration;
        }
        scheduleStep(currentStep, nextStepTime);
        currentStep += 1;
        nextStepTime += stepDuration;
      }
    };

    schedulerRef.current = window.setInterval(schedulerLoop, 25);
    return () => {
      if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    };
  }, [
    isPlaying,
    bpm,
    noteDivision,
    noteLength,
    beatSteps,
    measureSteps,
    grid,
    loopPlayback,
    metronome,
    getAudioContext,
    playMetronomeClick,
    playPluck,
    playhead,
  ]);

  useEffect(() => () => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
  }, []);

  useEffect(() => {
    if (!selectedSongId) {
      setSavedPartitures([]);
      setActivePartitureId(null);
      setCompositionTitle("");
      return;
    }

    let cancelled = false;
    setActivePartitureId(null);
    setCompositionTitle("");
    setLoadingPartitures(true);
    void fetchPartitures(selectedSongId)
      .then((payload) => {
        if (!cancelled) setSavedPartitures(payload.partitures);
      })
      .catch(() => {
        if (!cancelled) setSavedPartitures([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPartitures(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSongId]);

  useEffect(() => {
    const raw = readStoredRaw(draftKey);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as {
        grid?: GridRow[];
        bpm?: number;
        instrument?: InstrumentType;
        tuningId?: string;
        timeSignature?: TimeSignature;
        noteDivision?: number;
        noteLength?: number;
      };
      if (
        !Array.isArray(draft.grid) ||
        draft.grid.length === 0 ||
        draft.grid.some((row) =>
          !row ||
          typeof row.label !== "string" ||
          !Array.isArray(row.cells) ||
          row.cells.some((cell) => typeof cell !== "string")
        )
      ) {
        toast.error("Could not restore the local tab draft");
        return;
      }

      const restoredInstrument = draft.instrument && INSTRUMENT_TYPES.includes(draft.instrument)
        ? draft.instrument
        : "Steel";
      const tuningOptions = restoredInstrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
      const tuning = tuningOptions.find((preset) => preset.id === draft.tuningId) ?? tuningOptions[0];
      const restoredStrings = stringsFromTuning(tuning);
      const cols = Math.max(1, ...draft.grid.map((row) => row.cells.length));
      const restoredMeter = TIME_SIGNATURES.find((signature) =>
        signature.numerator === draft.timeSignature?.numerator &&
        signature.denominator === draft.timeSignature?.denominator
      ) ?? { numerator: 4, denominator: 4 as const };
      const restoredDivision = NOTE_DIVISIONS.includes(draft.noteDivision as NoteDivision)
        ? draft.noteDivision as NoteDivision
        : 16;

      // Local recovery is silent so opening the studio does not interrupt editing.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstrument(restoredInstrument);
      setTuningId(tuning.id);
      setGrid(reconcileTabGridRows(
        draft.grid,
        restoredStrings.map((string) => string.label),
        cols,
      ));
      setColumnCount(cols);
      if (typeof draft.bpm === "number" && draft.bpm >= 40 && draft.bpm <= 260) setBpm(draft.bpm);
      setTimeSignature(restoredMeter);
      setNoteDivision(restoredDivision);
      if (draft.noteLength && [50, 75, 100].includes(draft.noteLength)) setNoteLength(draft.noteLength);
    } catch {
      toast.error("Could not restore the local tab draft");
    }
  }, [draftKey]);

  // Keep a quiet local recovery copy without interrupting the workspace.
  useEffect(() => {
    lastWrittenDraftRef.current = null;
  }, [draftKey]);

  const draftSnapshot = useMemo(
    () => JSON.stringify({
      grid,
      columnCount,
      instrument,
      tuningId,
      bpm,
      timeSignature,
      noteDivision,
      noteLength,
    }),
    [grid, columnCount, instrument, tuningId, bpm, timeSignature, noteDivision, noteLength],
  );

  useEffect(() => {
    if (lastWrittenDraftRef.current === draftSnapshot) return;
    const timer = window.setTimeout(() => {
      writeStored(draftKey, JSON.parse(draftSnapshot));
      lastWrittenDraftRef.current = draftSnapshot;
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draftSnapshot, draftKey]);

  // Studio exit confirmation ("Save & exit") flushes a local draft of the grid.
  useEffect(() => {
    const flushDraft = () => {
      writeStored(draftKey, JSON.parse(draftSnapshot));
      lastWrittenDraftRef.current = draftSnapshot;
      toast.success("Tab draft saved locally");
    };
    window.addEventListener("production-studio:save-request", flushDraft);
    return () => window.removeEventListener("production-studio:save-request", flushDraft);
  }, [draftSnapshot, draftKey]);

  function addBar() {
    setGrid((current) => current.map((row) => ({
      ...row,
      cells: [...row.cells, ...Array.from({ length: measureSteps }, () => "-")],
    })));
    setColumnCount((current) => current + measureSteps);
  }

  function removeBar() {
    const targetSteps = Math.max(
      measureSteps,
      (Math.ceil(gridStepCount / measureSteps) - 1) * measureSteps,
    );
    setGrid((current) => current.map((row) => ({ ...row, cells: row.cells.slice(0, targetSteps) })));
    setColumnCount(targetSteps);
  }

  function clearGrid() {
    setGrid((current) => current.map((row) => ({
      ...row,
      cells: row.cells.map(() => "-"),
    })));
    toast.message("Grid cleared");
  }

  function restartFromBeginning() {
    setPlayhead(0);
    if (!isPlaying) {
      setIsPlaying(true);
    }
  }

  function jumpPlayhead(delta: number) {
    const total = grid[0]?.cells.length ?? columnCount;
    setPlayhead((current) => {
      const base = current < 0 ? 0 : current;
      return Math.max(0, Math.min(total - 1, base + delta));
    });
  }

  function duplicateMeasure() {
    if (playhead < 0) {
      toast.error("Move playhead to a measure first by playing or scrubbing");
      return;
    }
    const measureStart = Math.floor(playhead / measureSteps) * measureSteps;
    setGrid((current) => current.map((row) => {
      const cells = [...row.cells];
      const measure = cells.slice(measureStart, measureStart + measureSteps);
      while (measure.length < measureSteps) measure.push("-");
      cells.splice(measureStart + measureSteps, 0, ...measure);
      return { ...row, cells };
    }));
    setColumnCount((current) => current + measureSteps);
    toast.success(`Duplicated bar ${Math.floor(playhead / measureSteps) + 1}`);
  }

  function insertChord(chord: string) {
    const shape = getChordShape(chord, instrument === "Bass");
    if (!shape) {
      toast.error(`No ${instrument === "Bass" ? "bass" : "guitar"} shape for ${chord}`);
      return;
    }
    const start = playhead >= 0 ? playhead : 0;
    if (playhead < 0) {
      toast.message(`No playhead — inserting ${chord} at step 1`);
    }
    setGrid((current) => current.map((row, rowIdx) => {
      const fret = shape[rowIdx];
      if (fret === undefined || fret < 0) return row;
      const cells = [...row.cells];
      cells[start] = String(fret);
      return { ...row, cells };
    }));
    toast.success(`Inserted ${chord} at step ${start + 1}`);
  }

  function loadPartiture(partiture: MusicPartitureRecord) {
    const composition = partiture.format === FRETBOARD_COMPOSITION_FORMAT
      ? parseFretboardComposition(partiture.content)
      : null;

    if (partiture.format === FRETBOARD_COMPOSITION_FORMAT && !composition) {
      toast.error(`Could not load "${partiture.title}" — its composition data is invalid`);
      return;
    }

    if (composition) {
      const tuningOptions = composition.instrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
      const tuning = tuningOptions.find((option) => option.id === composition.tuningId);
      if (!tuning) {
        toast.error(`Could not load "${partiture.title}" — its tuning is unavailable`);
        return;
      }

      const targetStrings = stringsFromTuning(tuning);

      setInstrument(composition.instrument);
      setTuningId(composition.tuningId);
      setBpm(composition.bpm);
      setTimeSignature(composition.timeSignature);
      setNoteDivision(composition.noteDivision);
      setNoteLength(composition.noteLength);
      setGrid(reconcileTabGridRows(
        composition.grid,
        targetStrings.map((string) => string.label),
        composition.columnCount,
      ));
      setColumnCount(composition.columnCount);
    } else {
      const legacyInstrument = partiture.instrument === "bass" ? "Bass" : "Steel";
      const legacyTuningOptions = legacyInstrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
      const legacyTuning = legacyTuningOptions[0];
      const parsed = parseAsciiTab(partiture.content, stringsFromTuning(legacyTuning));
      if (!parsed) {
        toast.error("Could not parse this partiture as ASCII tab");
        return;
      }
      setInstrument(legacyInstrument);
      setTuningId(legacyTuning.id);
      setTimeSignature({ numerator: 4, denominator: 4 });
      setNoteDivision(16);
      setNoteLength(100);
      setGrid(parsed);
      setColumnCount(parsed[0]?.cells.length || 16);
    }

    setActivePartitureId(partiture.id);
    setCompositionTitle(partiture.title);
    toast.success(`Loaded "${partiture.title}"`);
  }

  async function removePartiture(partiture: MusicPartitureRecord) {
    if (!confirm(`Delete "${partiture.title}"?`)) return;
    try {
      await deletePartiture(partiture.id);
      if (activePartitureId === partiture.id) {
        setActivePartitureId(null);
        setCompositionTitle("");
      }
      toast.success(`Deleted "${partiture.title}"`);
      if (selectedSongId) {
        const payload = await fetchPartitures(selectedSongId);
        setSavedPartitures(payload.partitures);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function copyAsciiPreview() {
    try {
      await navigator.clipboard.writeText(asciiPreview);
      toast.success("ASCII tab copied to clipboard");
    } catch {
      toast.error("Could not copy — select the preview text manually");
    }
  }

  function importPastedAscii() {
    if (!pastedAscii.trim()) {
      toast.error("Paste ASCII tab text first");
      return;
    }
    const parsed = parseAsciiTab(pastedAscii, strings);
    if (!parsed) {
      toast.error("Could not parse pasted text as ASCII tab (expected e.g. 'e |...|')");
      return;
    }
    setGrid(parsed);
    setColumnCount(parsed[0].cells.length);
    setMultiTracks([]);
    setShowPasteImport(false);
    toast.success("Pasted ASCII tab imported");
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setShowPasteImport(true);
        toast.message("Clipboard is empty — paste your ASCII tab below");
        return;
      }
      setPastedAscii(text);
      const parsed = parseAsciiTab(text, strings);
      if (!parsed) {
        setShowPasteImport(true);
        toast.error("Clipboard text is not valid ASCII tab — review it below and import manually");
        return;
      }
      setGrid(parsed);
      setColumnCount(parsed[0].cells.length);
      setMultiTracks([]);
      toast.success("ASCII tab pasted from clipboard");
    } catch {
      setShowPasteImport(true);
      toast.message("Clipboard read blocked — paste your ASCII tab below");
    }
  }

  const exportAsciiTab = () => {
    downloadBlob("tab-export.txt", asciiPreview, "text/plain");
    toast.success("Tab exported as ASCII text");
  };

  async function saveToSongPartiture() {
    if (!selectedSongId) {
      toast.error("Select an active song in Production Studio first");
      return;
    }

    if (savingComposition) return;

    const currentPartiture = savedPartitures.find((partiture) => partiture.id === activePartitureId);
    const partitureInstrument = instrument === "Bass" ? "bass" : "guitar";
    const slot = currentPartiture?.instrument === partitureInstrument
      ? currentPartiture.slot
      : Math.max(0, ...savedPartitures
          .filter((partiture) => partiture.instrument === partitureInstrument)
          .map((partiture) => partiture.slot)) + 1;
    const title = compositionTitle.trim() || currentPartiture?.title || `${instrument} composition ${new Date().toLocaleDateString()}`;
    const composition: FretboardComposition = {
      version: 2,
      instrument,
      tuningId: activeTuning.id,
      bpm,
      timeSignature,
      noteDivision,
      noteLength,
      columnCount: grid[0]?.cells.length ?? columnCount,
      grid,
    };

    setSavingComposition(true);
    try {
      const payload = {
        instrument: partitureInstrument,
        slot,
        title,
        content: JSON.stringify(composition),
        format: FRETBOARD_COMPOSITION_FORMAT,
      };
      const result = currentPartiture
        ? await updatePartiture(currentPartiture.id, payload)
        : await createPartiture(selectedSongId, payload);
      setActivePartitureId(result.partiture.id);
      setCompositionTitle(result.partiture.title);
      const refreshed = await fetchPartitures(selectedSongId);
      setSavedPartitures(refreshed.partitures);
      toast.success(currentPartiture ? "Composition progress saved" : "Composition saved to this song");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingComposition(false);
    }
  }

  const handleTrackSelect = (trackIdx: number) => {
    const selected = multiTracks[trackIdx];
    if (!selected) return;
    setActiveTrackIndex(trackIdx);
    const tuningOptions = selected.instrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
    const tuning = tuningOptions.find((preset) => preset.id === selected.tuningId) ?? tuningOptions[0];
    setInstrument(selected.instrument);
    setTuningId(tuning.id);
    setGrid(reconcileTabGridRows(
      selected.grid,
      stringsFromTuning(tuning).map((string) => string.label),
      selected.grid[0]?.cells.length || 16,
    ));
    setColumnCount(selected.grid[0]?.cells.length || 16);
    toast.info(`Switched to: ${selected.name}`);
  };

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList?.[0]) return;
    const file = fileList[0];

    if (file.name.toLowerCase().endsWith(".gp5")) {
      toast.error("Guitar Pro (.gp5) is binary. Please export to MIDI (.mid) or ASCII tab (.txt) first.");
      return;
    }

    if (file.name.toLowerCase().endsWith(".mid") || file.name.toLowerCase().endsWith(".midi")) {
      try {
        const buffer = await file.arrayBuffer();
        const parsedMidi = parseMidiFile(buffer);
        
        if (parsedMidi.bpm > 0) {
          setBpm(parsedMidi.bpm);
        }

        const validTracks = parsedMidi.tracks.filter((t) => t.notes.length > 0);

        if (validTracks.length === 0) {
          toast.error("No MIDI note events found in file.");
          return;
        }

        const convertedTracks: MultiTrackItem[] = validTracks.map((t, idx) => {
          // Detect if track is bass
          const isBassTrack = t.name.toLowerCase().includes("bass") || t.notes.some((n) => n.note < 40);
          const trackInstrument: InstrumentType = isBassTrack ? "Bass" : "Steel";
          const trackTuning = isBassTrack ? BASS_TUNINGS[0] : GUITAR_TUNINGS[0];
          const trackStrings = stringsFromTuning(trackTuning);
          
          const trackGrid = convertTrackToGrid(t, trackStrings, parsedMidi.ppq);
          return {
            index: idx,
            name: t.name || `Track ${idx + 1}`,
            notesCount: t.notes.length,
            instrument: trackInstrument,
            tuningId: trackTuning.id,
            grid: trackGrid,
          };
        });

        setMultiTracks(convertedTracks);
        setActiveTrackIndex(0);
        const firstTrack = convertedTracks[0];
        const firstTrackTuningOptions = firstTrack.instrument === "Bass" ? BASS_TUNINGS : GUITAR_TUNINGS;
        const firstTrackTuning = firstTrackTuningOptions.find((preset) => preset.id === firstTrack.tuningId)
          ?? firstTrackTuningOptions[0];
        setInstrument(firstTrack.instrument);
        setTuningId(firstTrackTuning.id);
        setGrid(reconcileTabGridRows(
          firstTrack.grid,
          stringsFromTuning(firstTrackTuning).map((string) => string.label),
          firstTrack.grid[0]?.cells.length || 64,
        ));
        setColumnCount(convertedTracks[0].grid[0]?.cells.length || 64);

        toast.success(
          `MIDI imported! Separated ${convertedTracks.length} instrument track${
            convertedTracks.length > 1 ? "s" : ""
          } · ${parsedMidi.bpm} BPM`
        );
        return;
      } catch (err) {
        toast.error(`MIDI parse failed: ${(err as Error).message}`);
        return;
      }
    }

    const text = await file.text();
    const parsed = parseAsciiTab(text, strings);
    if (parsed) {
      setGrid(parsed);
      setColumnCount(parsed[0].cells.length);
      setMultiTracks([]);
      toast.success("ASCII tab imported");
    } else {
      toast.error("Unsupported tab format. Please upload MIDI (.mid) or ASCII text tab.");
    }
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Top Header & Playback Panel */}
      <div className="panel glass-shine flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={restartFromBeginning}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-[var(--color-sand-1)] transition hover:border-[var(--color-mint)] hover:text-white"
              type="button"
              title="Play from beginning"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              onClick={() => jumpPlayhead(-beatSteps)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-[var(--color-sand-1)] transition hover:border-[var(--color-mint)] hover:text-white"
              type="button"
              title="Jump back one beat"
            >
              <Rewind className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsPlaying((current) => !current)}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
                isPlaying
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "bg-[var(--color-mint)] text-black shadow-lg shadow-emerald-500/20 hover:scale-105"
              }`}
              type="button"
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
            </button>
            <button
              onClick={() => jumpPlayhead(beatSteps)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-[var(--color-sand-1)] transition hover:border-[var(--color-mint)] hover:text-white"
              type="button"
              title="Jump forward one beat"
            >
              <FastForward className="h-4 w-4" />
            </button>
          </div>

          {/* Instrument Selector */}
          <div className="field-group">
            <span className="field-label">Instrument</span>
            <select
              value={instrument}
              onChange={(event) => changeInstrument(event.target.value as InstrumentType)}
              className="field min-w-[140px] py-1.5 text-xs font-bold"
            >
              <option value="Steel">Steel Guitar</option>
              <option value="Nylon">Nylon Guitar</option>
              <option value="Overdrive">Overdrive Electric</option>
              <option value="Bass">Electric Bass</option>
            </select>
          </div>

          {/* Tuning Selector */}
          <div className="field-group">
            <span className="field-label">Tuning</span>
            <select
              value={tuningId}
              onChange={(event) => changeTuning(event.target.value)}
              className="field min-w-[170px] py-1.5 text-xs font-bold"
            >
              {tuningOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          {/* BPM */}
          <div className="field-group">
            <span className="field-label">BPM</span>
            <input
              type="number"
              value={bpm}
              min={40}
              max={260}
              onChange={(event) => setBpm(Math.min(260, Math.max(40, Number(event.target.value) || 120)))}
              className="field w-16 py-1.5 text-center text-xs font-black"
              aria-label="Tempo in beats per minute"
            />
          </div>

          <div className="field-group">
            <span className="field-label">Meter</span>
            <select
              value={`${timeSignature.numerator}/${timeSignature.denominator}`}
              onChange={(event) => {
                const next = TIME_SIGNATURES.find(
                  (signature) => `${signature.numerator}/${signature.denominator}` === event.target.value,
                );
                if (next) setTimeSignature(next);
              }}
              className="field min-w-[92px] py-1.5 text-xs font-bold"
              aria-label="Time signature"
            >
              {TIME_SIGNATURES.map((signature) => (
                <option key={`${signature.numerator}/${signature.denominator}`} value={`${signature.numerator}/${signature.denominator}`}>
                  {signature.numerator}/{signature.denominator}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <span className="field-label">Grid</span>
            <select
              value={noteDivision}
              onChange={(event) => setNoteDivision(Number(event.target.value) as NoteDivision)}
              className="field min-w-[112px] py-1.5 text-xs font-bold"
              aria-label="Note grid division"
            >
              {NOTE_DIVISIONS.map((division) => (
                <option key={division} value={division}>1/{division}</option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <span className="field-label">Note length</span>
            <select
              value={noteLength}
              onChange={(event) => setNoteLength(Number(event.target.value))}
              className="field min-w-[104px] py-1.5 text-xs font-bold"
              aria-label="Note gate length"
            >
              <option value={50}>50% · staccato</option>
              <option value={75}>75% · detached</option>
              <option value={100}>100% · full</option>
            </select>
          </div>

          {/* Quick Metronome and Loop Toggles */}
          <div className="flex gap-1.5">
            <button
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                metronome ? "glass-pill-active text-[var(--color-mint)]" : ""
              }`}
              onClick={() => setMetronome((current) => !current)}
              type="button"
            >
              <Timer className="mr-1 inline h-3.5 w-3.5" />
              Click
            </button>
            <button
              className={`glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                loopPlayback ? "glass-pill-active text-[var(--color-mint)]" : ""
              }`}
              onClick={() => setLoopPlayback((current) => !current)}
              type="button"
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              Loop
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) insertChord(event.target.value);
            }}
            className="field w-28 py-1.5 text-xs font-black uppercase"
            aria-label="Insert chord shape"
          >
            <option value="">+ Chord</option>
            {Object.keys(instrument === "Bass" ? BASS_CHORD_SHAPES : GUITAR_CHORD_SHAPES).map((chord) => (
              <option key={chord} value={chord}>
                {chord}
              </option>
            ))}
          </select>
          <button onClick={addBar} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Plus className="mr-1 inline h-3 w-3" />
            Add bar
          </button>
          <button onClick={removeBar} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Minus className="mr-1 inline h-3 w-3" />
            Remove bar
          </button>
          <button onClick={clearGrid} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Eraser className="mr-1 inline h-3 w-3" />
            Clear
          </button>
          <button onClick={duplicateMeasure} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Copy className="mr-1 inline h-3 w-3" />
            Duplicate bar
          </button>
          <FileUploadButton
            type="tab"
            onFilesSelected={(files) => void handleImport(files)}
            variant="primary"
          />
          <button
            onClick={() => void pasteFromClipboard()}
            className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-brass)]"
            type="button"
            title="Paste ASCII tab from clipboard"
          >
            <ClipboardPaste className="mr-1 inline h-3.5 w-3.5 text-[var(--color-brass)]" />
            Paste ASCII
          </button>
          <button onClick={exportAsciiTab} className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Multi-Track MIDI Separated Channels Toolbar (Shows if multi-track MIDI is loaded) */}
      {multiTracks.length > 0 && (
        <div className="panel glass-shine flex flex-wrap items-center gap-2 rounded-[1.25rem] border border-[var(--color-mint)]/30 bg-black/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-black text-[var(--color-mint)]">
            <Layers className="h-4 w-4" />
            <span>Separated MIDI Tracks ({multiTracks.length}):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {multiTracks.map((track, idx) => (
              <button
                key={track.index}
                type="button"
                onClick={() => handleTrackSelect(idx)}
                className={`rounded-full border px-3 py-1 text-xs font-black transition ${
                  activeTrackIndex === idx
                    ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-black shadow-md shadow-emerald-500/20"
                    : "border-white/10 bg-zinc-900/60 text-[var(--color-sand-2)] hover:border-white/30 hover:text-white"
                }`}
              >
                {track.name} ({track.notesCount} notes)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fretboard Grid & Sidebars */}
      <aside className="grid gap-4">
        <section className="panel glass-shine rounded-[1.75rem] p-4">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Tab Preview</div>
            <button
              onClick={() => void copyAsciiPreview()}
              className="glass-pill px-2.5 py-1 text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-mint)]"
              type="button"
              title="Copy ASCII tab to clipboard"
            >
              <ClipboardCopy className="mr-1 inline h-3 w-3" />
              Copy
            </button>
          </div>
          <pre className="mt-3 max-h-64 select-all overflow-auto rounded-[1rem] border border-white/8 bg-black/25 p-3 font-mono text-[11px] leading-5 text-white">
            {asciiPreview}
          </pre>

          {showPasteImport ? (
            <div className="mt-3 space-y-2 rounded-[1rem] border border-[var(--color-brass)]/30 bg-black/25 p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)]">
                Paste ASCII tab to import
              </div>
              <textarea
                value={pastedAscii}
                onChange={(event) => setPastedAscii(event.target.value)}
                rows={5}
                placeholder={"e |---|---|...|\nB |---|---|...|"}
                className="field font-mono text-[11px]"
              />
              <div className="flex gap-2">
                <button
                  onClick={importPastedAscii}
                  className="glass-pill flex-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
                  type="button"
                >
                  Import pasted tab
                </button>
                <button
                  onClick={() => setShowPasteImport(false)}
                  className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPasteImport(true)}
              className="mt-2 w-full rounded-[1rem] border border-dashed border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-sand-2)] transition hover:border-[var(--color-brass)]/50 hover:text-white"
              type="button"
            >
              <ClipboardPaste className="mr-1 inline h-3 w-3" />
              Or paste ASCII here to import
            </button>
          )}

          <div className="my-3 border-t border-white/8" />

          <div className="flex items-center justify-between">
            <div className="eyebrow">Saved Compositions · {savedPartitures.length}</div>
            <Music className="h-4 w-4 text-[var(--color-brass)]" />
          </div>
          {loadingPartitures ? (
            <p className="mt-2 text-sm text-[var(--color-sand-2)]">Loading...</p>
          ) : !selectedSongId ? (
            <p className="mt-2 text-xs text-[var(--color-sand-2)]">Pick an active song above to load saved tabs.</p>
          ) : savedPartitures.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--color-sand-2)]">No saved partitures for this song yet.</p>
          ) : (
            <div className="mt-2 max-h-56 space-y-1.5 overflow-auto pr-0.5">
              {savedPartitures.map((partiture) => (
                <div
                  key={partiture.id}
                  className={`song-list-item flex items-center gap-2 rounded-[1rem] px-3 py-2 ${
                    activePartitureId === partiture.id ? "border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/5" : ""
                  }`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => loadPartiture(partiture)}
                    type="button"
                    title="Load into grid"
                  >
                    <div className="truncate text-xs font-bold">{partiture.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
                      {partiture.instrument} · slot {partiture.slot}
                    </div>
                  </button>
                  <button
                    onClick={() => void removePartiture(partiture)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 text-[var(--color-sand-2)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                    type="button"
                    title={`Delete "${partiture.title}"`}
                    aria-label={`Delete "${partiture.title}"`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </aside>

      <div className="w-full">
        <div className="panel glass-shine overflow-hidden rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow">Interactive Fretboard Grid</div>
              <h3 className="text-xl font-black">
                {barCount} bars · {timeSignature.numerator}/{timeSignature.denominator} · {gridStepCount} steps
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sand-2)]">
                Add notes on a 1/{noteDivision} grid · {noteLength}% note gate · {strings.length} strings · 3h5 hammer-on · 5p3 pull-off · 7s9 slide · 5b7 bend · ~ vibrato · x dead note
              </p>
            </div>
            <Volume2 className="h-4 w-4 text-[var(--color-brass)] opacity-70" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={compositionTitle}
              onChange={(event) => setCompositionTitle(event.target.value)}
              className="field min-w-48 flex-1 py-2 text-sm"
              maxLength={100}
              placeholder={`${instrument} composition name`}
              aria-label="Composition name"
            />
            {activePartitureId ? (
              <button
                onClick={() => {
                  setActivePartitureId(null);
                  setCompositionTitle("");
                }}
                className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                type="button"
                disabled={!selectedSongId || savingComposition}
              >
                Save as new
              </button>
            ) : null}
            <button
              onClick={() => void saveToSongPartiture()}
              className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!selectedSongId || savingComposition}
              title={selectedSongId ? "Save this instrument composition to the active song" : "Select a song to save this composition"}
            >
              <Save className="mr-1 inline h-3.5 w-3.5 text-[var(--color-brass)]" />
              {savingComposition ? "Saving..." : activePartitureId ? "Save Progress" : "Save Composition"}
            </button>
          </div>

          <div ref={gridViewportRef} className="relative overflow-x-auto rounded-[1.25rem] border border-white/8 bg-black/20 p-3">
            <div className="mb-1 flex min-w-max pl-16" aria-hidden="true">
              {Array.from({ length: barCount }, (_, barIdx) => (
                <div
                  key={barIdx}
                  className="border-l border-[var(--color-brass)]/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--color-brass)]"
                  style={{ width: `${Math.min(measureSteps, gridStepCount - barIdx * measureSteps) * stepWidth}px` }}
                >
                  Bar {barIdx + 1}
                </div>
              ))}
            </div>

            <div className="mb-2 flex min-w-max pl-16">
              {grid[0]?.cells.map((_, columnIdx) => {
                const stepInBar = columnIdx % measureSteps;
                const beatInBar = Math.floor(stepInBar / beatSteps);
                const subdivision = stepInBar % beatSteps;
                const barNumber = Math.floor(columnIdx / measureSteps) + 1;
                const beatNumber = beatInBar + 1;
                const isBeatStart = subdivision === 0;
                const isBarStart = stepInBar === 0;
                return (
                <button
                  key={columnIdx}
                  className={`border-l text-center text-xs font-black transition ${
                    playhead === columnIdx
                      ? "border-[var(--color-mint)] text-[var(--color-mint)]"
                      : isBarStart
                      ? "border-[var(--color-brass)]/50 text-white"
                      : isBeatStart
                      ? "border-white/25 text-[var(--color-sand-1)]"
                      : "border-white/10 text-[var(--color-sand-2)]"
                  }`}
                  style={{ width: `${stepWidth}px` }}
                  onClick={() => setPlayhead(columnIdx)}
                  type="button"
                  aria-label={`Set playhead to bar ${barNumber}, beat ${beatNumber}, subdivision ${subdivision + 1}`}
                  aria-pressed={playhead === columnIdx}
                >
                  {isBeatStart ? beatNumber : `+${subdivision + 1}`}
                </button>
                );
              })}
            </div>

            <div className="relative min-w-max">
              {/* String Labels column (tuning note + pitch) */}
              <div className="absolute inset-y-0 left-0 z-20 flex w-16 flex-col justify-between rounded-l-lg border-r border-white/10 bg-zinc-900/80 py-[2px] backdrop-blur-md">
                {strings.map((stringRef, stringIdx) => (
                  <span
                    key={`${stringRef.label}-${stringRef.note}-${stringIdx}`}
                    title={`${stringRef.label} string · ${stringRef.note} · ${stringRef.base.toFixed(1)} Hz`}
                    className="flex h-9 items-center justify-center gap-1 text-xs font-black text-[var(--color-sand-1)]"
                  >
                    {stringRef.label}
                    <span className="rounded bg-white/10 px-1 py-px font-mono text-[9px] font-bold text-[var(--color-brass)]">
                      {stringRef.note}
                    </span>
                  </span>
                ))}
              </div>

              {/* String horizontal wire lines */}
              {strings.slice(0, -1).map((stringRef, idx) => (
                <div
                  key={`${stringRef.label}-${idx}`}
                  className="notation-string-line"
                  style={{ top: `${(idx + 1) * 36 - 18}px` }}
                />
              ))}

              {/* Grid cell inputs */}
              <div className="flex min-w-max pl-16">
                {grid[0]?.cells.map((_, columnIdx) => (
                  <div
                    key={columnIdx}
                    className={`relative transition-colors ${
                      playhead === columnIdx ? "bg-[var(--color-mint)]/15" : "hover:bg-white/5"
                    }`}
                    style={{ width: `${stepWidth}px` }}
                  >
                    {columnIdx > 0 && columnIdx % measureSteps === 0 ? (
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-[var(--color-brass)]/60" />
                    ) : columnIdx > 0 && columnIdx % beatSteps === 0 ? (
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-white/20" />
                    ) : null}
                    {grid.map((row, rowIdx) => (
                      <div key={`${row.label}-${rowIdx}`} className="flex h-9 items-center justify-center">
                        <input
                          className={`h-8 rounded-md border text-center text-[11px] font-black outline-none transition focus:ring-2 focus:ring-[var(--color-mint)]/60 ${
                            row.cells[columnIdx] === "-"
                              ? "border-white/10 bg-white/[0.03] text-[var(--color-sand-1)] placeholder:text-zinc-600 focus:border-[var(--color-mint)]/50 focus:bg-zinc-800"
                              : "border-[var(--color-mint)]/50 bg-[var(--color-mint)]/10 text-white"
                          }`}
                          style={{ width: `${stepWidth - 4}px` }}
                          value={row.cells[columnIdx] === "-" ? "" : row.cells[columnIdx]}
                          onChange={(event) => {
                            const next = event.target.value.replace(/[^0-9hpsb~x/\\-]/g, "") || "-";
                            setGrid((current) =>
                              current.map((gridRow, gridRowIdx) =>
                                gridRowIdx === rowIdx
                                  ? {
                                      ...gridRow,
                                      cells: gridRow.cells.map((cell, cellIdx) =>
                                        cellIdx === columnIdx ? next : cell
                                      ),
                                    }
                                  : gridRow
                              )
                            );
                          }}
                          placeholder="-"
                          aria-label={`${row.label} string, bar ${Math.floor(columnIdx / measureSteps) + 1}, beat ${Math.floor((columnIdx % measureSteps) / beatSteps) + 1}, subdivision ${(columnIdx % beatSteps) + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Animated Playhead Line */}
              <AnimatePresence>
                {playhead >= 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute bottom-0 top-6 z-30 w-[2px] bg-[var(--color-mint)] shadow-[0_0_14px_var(--color-mint)]"
                    style={{ left: `${64 + playhead * stepWidth}px` }}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
