"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Copy,
  Download,
  Eraser,
  Layers,
  Minus,
  Music,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sliders,
  Square,
  Timer,
  Upload,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { useAudio } from "@/components/music/audio-provider";
import { useProductionSong } from "@/components/music/production-song-context";
import { createPartiture, downloadBlob, fetchPartitures } from "@/lib/music/client";
import type { MusicPartitureRecord } from "@/lib/music/types";
import { parseMidiFile, type MidiTrackData, type ParsedMidi } from "@/lib/music/midi-parser";
import {
  BASS_TUNINGS,
  GUITAR_TUNINGS,
  type TuningPreset,
  type TuningString,
} from "@/lib/music/tunings";
import { playMetronomeSound } from "@/lib/music/metronome-sound";

type InstrumentType = "Steel" | "Nylon" | "Bass" | "Overdrive";

interface StringFreq {
  label: string;
  base: number;
}

type GridRow = {
  label: string;
  cells: string[];
};

export type MultiTrackItem = {
  index: number;
  name: string;
  notesCount: number;
  grid: GridRow[];
};

function stringsFromTuning(preset: TuningPreset): StringFreq[] {
  return [...preset.strings].reverse().map((s) => ({
    label: s.label,
    base: s.frequency,
  }));
}

function buildEmptyGrid(strings: StringFreq[], columns: number): GridRow[] {
  return strings.map((string) => ({
    label: string.label,
    cells: Array.from({ length: columns }, () => "-"),
  }));
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
  return strings.map((string) => {
    const found = parsed.find((row) => row.label.toLowerCase() === string.label.toLowerCase());
    if (!found) {
      return { label: string.label, cells: Array.from({ length: columnCount }, () => "-") };
    }
    while (found.cells.length < columnCount) found.cells.push("-");
    return found;
  });
}

function gridToAscii(grid: GridRow[], instrument: string, bpm: number, tuningName: string) {
  const lines = grid.map((row) => {
    const chunks: string[] = [];
    for (let i = 0; i < row.cells.length; i += 4) {
      chunks.push(
        row.cells.slice(i, i + 4).map((cell) => (cell === "-" || cell === "" ? "-" : cell)).join("-"),
      );
    }
    return `${row.label.padEnd(2, " ")} |${chunks.join("|")}|`;
  });
  return [
    `Tab Studio Export (${instrument})`,
    `Tuning: ${tuningName}`,
    `Tempo: ${bpm} BPM`,
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const playingRef = useRef(false);
  const schedulerRef = useRef<number | null>(null);

  const [instrument, setInstrument] = useState<InstrumentType>("Steel");
  const [tuningId, setTuningId] = useState<string>("guitar-standard");
  const [columnCount, setColumnCount] = useState(16);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playhead, setPlayhead] = useState(-1);
  const [metronome, setMetronome] = useState(false);
  const [savedPartitures, setSavedPartitures] = useState<MusicPartitureRecord[]>([]);
  const [loadingPartitures, setLoadingPartitures] = useState(false);

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

  const asciiPreview = useMemo(() => gridToAscii(grid, instrument, bpm, activeTuning.name), [grid, instrument, bpm, activeTuning.name]);

  // Adjust tuning selection when instrument changes
  useEffect(() => {
    if (instrument === "Bass") {
      if (!BASS_TUNINGS.some((t) => t.id === tuningId)) {
        setTuningId(BASS_TUNINGS[0].id);
      }
    } else {
      if (!GUITAR_TUNINGS.some((t) => t.id === tuningId)) {
        setTuningId(GUITAR_TUNINGS[0].id);
      }
    }
  }, [instrument, tuningId]);

  // Update grid strings if tuning changes
  useEffect(() => {
    setGrid((current) => {
      const cols = current[0]?.cells.length || columnCount;
      if (current.length === strings.length) {
        return strings.map((s, idx) => ({
          label: s.label,
          cells: current[idx]?.cells || Array.from({ length: cols }, () => "-"),
        }));
      }
      return buildEmptyGrid(strings, cols);
    });
  }, [strings, columnCount]);

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

  const playPluck = useCallback((fret: number, stringIdx: number, time: number) => {
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

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (instrument === "Nylon") {
      osc.type = "sine";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
    } else if (instrument === "Bass") {
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 2.0);

      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(freq / 2, time);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.1, time);
      subGain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
      sub.connect(subGain);
      subGain.connect(masterGain);
      sub.start(time);
      sub.stop(time + 1.5);
    } else {
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 1.5);
    }

    osc.frequency.setValueAtTime(freq, time);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 2.0);
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
    const stepDuration = 60 / bpm / 4;
    const LOOKAHEAD_SECONDS = 0.2;
    let currentStep = Math.max(0, playhead);
    let nextStepTime = ctx.currentTime + 0.1;

    const scheduleStep = (step: number, time: number) => {
      setPlayhead(step);
      if (metronome) {
        playMetronomeClick(time, step % 4 === 0);
      }
      grid.forEach((row, stringIdx) => {
        const cell = row.cells[step];
        if (cell !== "-" && cell !== "") {
          playPluck(parseInt(cell, 10), stringIdx, time);
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
  }, [isPlaying, bpm, grid, loopPlayback, metronome, getAudioContext, playMetronomeClick, playPluck, playhead]);

  useEffect(() => () => {
    if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
    schedulerRef.current = null;
  }, []);

  useEffect(() => {
    if (!selectedSongId) {
      setSavedPartitures([]);
      return;
    }

    let cancelled = false;
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

  function addColumns(count = 4) {
    setGrid((current) => current.map((row) => ({
      ...row,
      cells: [...row.cells, ...Array.from({ length: count }, () => "-")],
    })));
    setColumnCount((current) => current + count);
  }

  function removeColumns(count = 4) {
    setGrid((current) => current.map((row) => ({
      ...row,
      cells: row.cells.slice(0, Math.max(4, row.cells.length - count)),
    })));
    setColumnCount((current) => Math.max(4, current - count));
  }

  function clearGrid() {
    setGrid((current) => current.map((row) => ({
      ...row,
      cells: row.cells.map(() => "-"),
    })));
    toast.message("Grid cleared");
  }

  function duplicateMeasure() {
    if (playhead < 0) {
      toast.error("Move playhead to a measure first by playing or scrubbing");
      return;
    }
    setGrid((current) => current.map((row) => {
      const value = row.cells[playhead] ?? "-";
      const cells = [...row.cells];
      cells.splice(playhead + 1, 0, value);
      return { ...row, cells };
    }));
    setColumnCount((current) => current + 1);
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
    const parsed = parseAsciiTab(partiture.content, strings);
    if (!parsed) {
      toast.error("Could not parse this partiture as ASCII tab");
      return;
    }
    setGrid(parsed);
    setColumnCount(parsed[0]?.cells.length || 16);
    toast.success(`Loaded "${partiture.title}"`);
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

    try {
      await createPartiture(selectedSongId, {
        instrument: instrument === "Bass" ? "bass" : "guitar",
        slot: instrument === "Bass" ? 2 : 1,
        title: `${instrument} tab (${activeTuning.name}) ${new Date().toLocaleDateString()}`,
        content: asciiPreview,
        format: "text-tab",
      });
      toast.success("Tab saved to song partitures");
      const payload = await fetchPartitures(selectedSongId);
      setSavedPartitures(payload.partitures);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const handleTrackSelect = (trackIdx: number) => {
    const selected = multiTracks[trackIdx];
    if (!selected) return;
    setActiveTrackIndex(trackIdx);
    setGrid(selected.grid);
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
          const trackStrings = isBassTrack
            ? stringsFromTuning(BASS_TUNINGS[0])
            : stringsFromTuning(GUITAR_TUNINGS[0]);
          
          const trackGrid = convertTrackToGrid(t, trackStrings, parsedMidi.ppq);
          return {
            index: idx,
            name: t.name || `Track ${idx + 1}`,
            notesCount: t.notes.length,
            grid: trackGrid,
          };
        });

        setMultiTracks(convertedTracks);
        setActiveTrackIndex(0);
        setGrid(convertedTracks[0].grid);
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

          {/* Instrument Selector */}
          <div className="field-group">
            <span className="field-label">Instrument</span>
            <select
              value={instrument}
              onChange={(event) => setInstrument(event.target.value as InstrumentType)}
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
              onChange={(event) => setTuningId(event.target.value)}
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
              onChange={(event) => setBpm(Number(event.target.value) || 120)}
              className="field w-16 py-1.5 text-center text-xs font-black"
            />
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
          <button onClick={() => addColumns(4)} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Plus className="mr-1 inline h-3 w-3" />
            Bars
          </button>
          <button onClick={() => removeColumns(4)} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Minus className="mr-1 inline h-3 w-3" />
            Trim
          </button>
          <button onClick={clearGrid} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Eraser className="mr-1 inline h-3 w-3" />
            Clear
          </button>
          <button onClick={duplicateMeasure} className="glass-pill px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Copy className="mr-1 inline h-3 w-3" />
            Dup
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".mid,.midi,.txt,.tab"
            onChange={(event) => void handleImport(event.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-mint)]"
            type="button"
          >
            <Upload className="mr-1 inline h-3.5 w-3.5 text-[var(--color-mint)]" />
            Import MIDI/Tab
          </button>
          <button onClick={exportAsciiTab} className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Export
          </button>
          <button onClick={() => void saveToSongPartiture()} className="glass-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-widest" type="button">
            <Save className="mr-1 inline h-3.5 w-3.5 text-[var(--color-brass)]" />
            Save Partiture
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
      <div className="page-grid !grid-cols-1 xl:!grid-cols-[minmax(0,1fr)_280px]">
        <div className="panel glass-shine overflow-hidden rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow">Interactive Fretboard Grid</div>
              <h3 className="text-xl font-black">
                {columnCount} steps · {strings.length} strings · {activeTuning.name}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-sand-2)]">
                Techniques: 3h5 hammer-on · 5p3 pull-off · 7s9 slide · 5b7 bend · ~ vibrato · x dead note
              </p>
            </div>
            <Volume2 className="h-4 w-4 text-[var(--color-brass)] opacity-70" />
          </div>

          <div className="relative overflow-x-auto rounded-[1.25rem] border border-white/8 bg-black/20 p-3">
            {/* Step / Measure Headers */}
            <div className="mb-2 flex min-w-max pl-10">
              {grid[0]?.cells.map((_, columnIdx) => (
                <button
                  key={columnIdx}
                  className={`w-10 text-center text-[10px] font-black uppercase tracking-wider transition ${
                    playhead === columnIdx
                      ? "scale-110 font-bold text-[var(--color-mint)]"
                      : columnIdx % 4 === 0
                      ? "text-white"
                      : "text-[var(--color-sand-2)]"
                  }`}
                  onClick={() => setPlayhead(columnIdx)}
                  type="button"
                >
                  {columnIdx + 1}
                </button>
              ))}
            </div>

            <div className="relative min-w-max">
              {/* String Labels column */}
              <div className="absolute inset-y-0 left-0 z-20 flex w-10 flex-col justify-between rounded-l-lg border-r border-white/10 bg-zinc-900/80 py-[2px] backdrop-blur-md">
                {strings.map((stringRef) => (
                  <span
                    key={stringRef.label}
                    className="flex h-9 items-center justify-center text-xs font-black text-[var(--color-sand-1)]"
                  >
                    {stringRef.label}
                  </span>
                ))}
              </div>

              {/* String horizontal wire lines */}
              {strings.slice(0, -1).map((stringRef, idx) => (
                <div
                  key={stringRef.label}
                  className="notation-string-line"
                  style={{ top: `${(idx + 1) * 36 - 18}px` }}
                />
              ))}

              {/* Grid cell inputs */}
              <div className="flex min-w-max pl-10">
                {grid[0]?.cells.map((_, columnIdx) => (
                  <div
                    key={columnIdx}
                    className={`relative w-10 transition-colors ${
                      playhead === columnIdx ? "bg-[var(--color-mint)]/15" : "hover:bg-white/5"
                    }`}
                  >
                    {columnIdx % 4 === 0 && columnIdx > 0 ? (
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-[var(--color-brass)]/40" />
                    ) : null}
                    {grid.map((row, rowIdx) => (
                      <div key={row.label} className="flex h-9 items-center justify-center">
                        <input
                          className={`h-7 w-7 rounded-md border text-center text-xs font-black outline-none transition ${
                            row.cells[columnIdx] === "-"
                              ? "border-transparent bg-transparent text-zinc-600 focus:border-white/30 focus:bg-zinc-800"
                              : "border-white bg-white text-black shadow-md"
                          }`}
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
                    style={{ left: `${40 + playhead * 40}px` }}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Sidebar for ASCII Preview & Saved Song Partitures */}
        <aside className="space-y-4">
          <div className="panel glass-shine rounded-[1.75rem] p-4">
            <div className="eyebrow">ASCII Preview</div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-[1rem] border border-white/8 bg-black/25 p-3 font-mono text-[11px] leading-5 text-[var(--color-sand-1)]">
              {asciiPreview}
            </pre>
          </div>

          <div className="panel glass-shine rounded-[1.75rem] p-4">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Song Partitures</div>
              <Music className="h-4 w-4 text-[var(--color-brass)]" />
            </div>
            {loadingPartitures ? (
              <p className="mt-3 text-sm text-[var(--color-sand-2)]">Loading...</p>
            ) : !selectedSongId ? (
              <p className="mt-3 text-sm text-[var(--color-sand-2)]">Pick an active song above to load saved tabs.</p>
            ) : savedPartitures.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-sand-2)]">No saved partitures for this song yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {savedPartitures.map((partiture) => (
                  <button
                    key={partiture.id}
                    className="song-list-item w-full rounded-[1rem] px-3 py-2.5 text-left"
                    onClick={() => loadPartiture(partiture)}
                    type="button"
                  >
                    <div className="text-sm font-bold">{partiture.title}</div>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
                      {partiture.instrument} · slot {partiture.slot}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

