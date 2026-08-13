"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  Download,
  Eraser,
  Minus,
  Music,
  Play,
  Plus,
  RefreshCw,
  Save,
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
import { parseMidi } from "@/lib/music/midi-parser";

type InstrumentType = "Steel" | "Nylon" | "Bass" | "Overdrive";

interface StringFreq {
  label: string;
  base: number;
}

type GridRow = {
  label: string;
  cells: string[];
};

const GUITAR_STRINGS: StringFreq[] = [
  { label: "e", base: 329.63 },
  { label: "B", base: 246.94 },
  { label: "G", base: 196.0 },
  { label: "D", base: 146.83 },
  { label: "A", base: 110.0 },
  { label: "E", base: 82.41 },
];

const BASS_STRINGS: StringFreq[] = [
  { label: "G", base: 98.0 },
  { label: "D", base: 73.42 },
  { label: "A", base: 55.0 },
  { label: "E", base: 41.2 },
];

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
      const match = line.match(/^([A-Ga-g])\s*\|(.+)\|$/);
      if (!match) return null;
      const label = match[1].toLowerCase();
      const cells = match[2].split("-").map((cell) => (cell.trim() === "" ? "-" : cell.trim()));
      return { label, cells };
    })
    .filter((row): row is GridRow => Boolean(row));

  if (parsed.length === 0) return null;

  const columnCount = Math.max(...parsed.map((row) => row.cells.length));
  return strings.map((string) => {
    const found = parsed.find((row) => row.label === string.label.toLowerCase());
    if (!found) {
      return { label: string.label, cells: Array.from({ length: columnCount }, () => "-") };
    }
    while (found.cells.length < columnCount) found.cells.push("-");
    return found;
  });
}

function gridToAscii(grid: GridRow[], instrument: string, bpm: number) {
  const lines = grid.map((row) => {
    const content = row.cells.map((cell) => (cell === "-" || cell === "" ? "-" : cell)).join("-");
    return `${row.label.toUpperCase()} |${content}|`;
  });
  return [`Tab Studio Export (${instrument})`, `Tempo: ${bpm} BPM`, "", ...lines, ""].join("\n");
}

export function TabStudioClient() {
  const { getAudioContext } = useAudio();
  const { selectedSongId } = useProductionSong();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const playingRef = useRef(false);

  const [instrument, setInstrument] = useState<InstrumentType>("Steel");
  const [strings, setStrings] = useState(GUITAR_STRINGS);
  const [columnCount, setColumnCount] = useState(16);
  const [grid, setGrid] = useState(() => buildEmptyGrid(GUITAR_STRINGS, 16));
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [playhead, setPlayhead] = useState(-1);
  const [metronome, setMetronome] = useState(false);
  const [savedPartitures, setSavedPartitures] = useState<MusicPartitureRecord[]>([]);
  const [loadingPartitures, setLoadingPartitures] = useState(false);

  const asciiPreview = useMemo(() => gridToAscii(grid, instrument, bpm), [grid, instrument, bpm]);

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
    if (fret < 0 || Number.isNaN(fret)) return;
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(accent ? 1200 : 800, time);
    gain.gain.setValueAtTime(accent ? 0.08 : 0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
  }, [getAudioContext]);

  useEffect(() => {
    const nextStrings = instrument === "Bass" ? BASS_STRINGS : GUITAR_STRINGS;
    setStrings(nextStrings);
    setGrid((current) => {
      const columns = current[0]?.cells.length || columnCount;
      return buildEmptyGrid(nextStrings, columns);
    });
  }, [instrument]);

  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    let currentStep = 0;
    const stepDuration = 60 / bpm / 4;
    let timeoutId: ReturnType<typeof setTimeout>;

    const playNextStep = () => {
      if (!playingRef.current) return;
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      setPlayhead(currentStep);

      if (metronome) {
        playMetronomeClick(now, currentStep % 4 === 0);
      }

      grid.forEach((row, stringIdx) => {
        const cell = row.cells[currentStep];
        if (cell !== "-" && cell !== "") {
          playPluck(parseInt(cell, 10), stringIdx, now);
        }
      });

      currentStep += 1;
      if (currentStep < grid[0].cells.length) {
        timeoutId = setTimeout(playNextStep, stepDuration * 1000);
        return;
      }

      if (loopPlayback && playingRef.current) {
        currentStep = 0;
        timeoutId = setTimeout(playNextStep, stepDuration * 1000);
        return;
      }

      setIsPlaying(false);
      setPlayhead(-1);
    };

    playNextStep();
    return () => clearTimeout(timeoutId);
  }, [isPlaying, bpm, grid, loopPlayback, metronome, getAudioContext, playMetronomeClick, playPluck]);

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
        title: `${instrument} tab ${new Date().toLocaleDateString()}`,
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

  const handleImport = async (fileList: FileList | null) => {
    if (!fileList?.[0]) return;
    const file = fileList[0];

    if (file.name.toLowerCase().endsWith(".gp5")) {
      toast.error("Guitar Pro 5 (.gp5) is binary. Export to MIDI or ASCII tab first.");
      return;
    }

    if (file.name.toLowerCase().endsWith(".mid") || file.name.toLowerCase().endsWith(".midi")) {
      const buffer = await file.arrayBuffer();
      const events = parseMidi(buffer);
      const newGrid = buildEmptyGrid(strings, Math.max(columnCount, 64));

      events.forEach((ev) => {
        if (ev.type === "noteOn" && ev.note) {
          const tickStep = Math.floor(ev.time / 120);
          if (tickStep < newGrid[0].cells.length) {
            let bestString = 0;
            let minDiff = 100;
            strings.forEach((stringRef, stringIdx) => {
              const fret = ev.note! - (21 + stringIdx * 5);
              if (fret >= 0 && fret < 24 && fret < minDiff) {
                minDiff = fret;
                bestString = stringIdx;
              }
            });
            newGrid[bestString].cells[tickStep] = String(Math.max(0, ev.note - 40));
          }
        }
      });

      setGrid(newGrid);
      setColumnCount(newGrid[0].cells.length);
      toast.success("MIDI imported successfully");
      return;
    }

    const text = await file.text();
    const parsed = parseAsciiTab(text, strings);
    if (parsed) {
      setGrid(parsed);
      setColumnCount(parsed[0].cells.length);
      toast.success("ASCII tab imported");
    } else {
      toast.error("Unsupported tab format");
    }
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="panel glass-shine flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsPlaying((current) => !current)}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all ${
              isPlaying
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-[var(--color-mint)] text-black shadow-lg shadow-emerald-500/20"
            }`}
            type="button"
          >
            {isPlaying ? <Square className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>

          <div className="field-group">
            <span className="field-label">Instrument</span>
            <select
              value={instrument}
              onChange={(event) => setInstrument(event.target.value as InstrumentType)}
              className="field min-w-[160px] py-2"
            >
              <option value="Steel">Steel string</option>
              <option value="Nylon">Nylon string</option>
              <option value="Bass">Electric bass</option>
              <option value="Overdrive">Overdrive electric</option>
            </select>
          </div>

          <div className="field-group">
            <span className="field-label">BPM</span>
            <input
              type="number"
              value={bpm}
              min={40}
              max={240}
              onChange={(event) => setBpm(Number(event.target.value) || 120)}
              className="field w-20 py-2 text-center font-black"
            />
          </div>

          <div className="flex gap-2">
            <button
              className={`glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest ${metronome ? "glass-pill-active" : ""}`}
              onClick={() => setMetronome((current) => !current)}
              type="button"
            >
              <Timer className="mr-1 inline h-3.5 w-3.5" />
              Click
            </button>
            <button
              className={`glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest ${loopPlayback ? "glass-pill-active" : ""}`}
              onClick={() => setLoopPlayback((current) => !current)}
              type="button"
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              Loop
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => addColumns(4)} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Measures
          </button>
          <button onClick={() => removeColumns(4)} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Minus className="mr-1 inline h-3.5 w-3.5" />
            Trim
          </button>
          <button onClick={clearGrid} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Eraser className="mr-1 inline h-3.5 w-3.5" />
            Clear
          </button>
          <button onClick={duplicateMeasure} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Copy className="mr-1 inline h-3.5 w-3.5" />
            Dup step
          </button>
          <input ref={inputRef} type="file" className="hidden" accept=".mid,.midi,.txt,.tab" onChange={(event) => void handleImport(event.target.files)} />
          <button onClick={() => inputRef.current?.click()} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Upload className="mr-1 inline h-3.5 w-3.5" />
            Import
          </button>
          <button onClick={exportAsciiTab} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Download className="mr-1 inline h-3.5 w-3.5" />
            Export
          </button>
          <button onClick={() => void saveToSongPartiture()} className="glass-pill px-3 py-2 text-[10px] font-black uppercase tracking-widest" type="button">
            <Save className="mr-1 inline h-3.5 w-3.5" />
            Save to song
          </button>
        </div>
      </div>

      <div className="page-grid !grid-cols-1 xl:!grid-cols-[minmax(0,1fr)_280px]">
        <div className="panel glass-shine overflow-hidden rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="eyebrow">Fretboard grid</div>
              <h3 className="text-xl font-black">{columnCount} steps · {strings.length} strings</h3>
            </div>
            <Volume2 className="h-4 w-4 text-[var(--color-brass)] opacity-70" />
          </div>

          <div className="relative overflow-x-auto rounded-[1.25rem] border border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex min-w-max pl-8">
              {grid[0]?.cells.map((_, columnIdx) => (
                <button
                  key={columnIdx}
                  className={`w-10 text-center text-[10px] font-black uppercase tracking-wider ${
                    playhead === columnIdx ? "text-[var(--color-mint)]" : "text-[var(--color-sand-2)]"
                  }`}
                  onClick={() => setPlayhead(columnIdx)}
                  type="button"
                >
                  {columnIdx + 1}
                </button>
              ))}
            </div>

            <div className="relative min-w-max">
              <div className="absolute inset-y-0 left-0 z-20 flex w-8 flex-col justify-between rounded-l-lg border-r border-white/10 bg-zinc-900/70 py-[2px] backdrop-blur-md">
                {strings.map((stringRef) => (
                  <span key={stringRef.label} className="flex h-9 items-center justify-center text-xs font-black text-[var(--color-sand-2)]">
                    {stringRef.label}
                  </span>
                ))}
              </div>

              {strings.slice(0, -1).map((stringRef, idx) => (
                <div
                  key={stringRef.label}
                  className="notation-string-line"
                  style={{ top: `${(idx + 1) * 36 - 18}px` }}
                />
              ))}

              <div className="flex min-w-max pl-8">
                {grid[0]?.cells.map((_, columnIdx) => (
                  <div
                    key={columnIdx}
                    className={`relative w-10 transition-colors ${
                      playhead === columnIdx ? "bg-[var(--color-mint)]/15" : "hover:bg-white/5"
                    }`}
                  >
                    {grid.map((row, rowIdx) => (
                      <div key={row.label} className="flex h-9 items-center justify-center">
                        <input
                          className={`h-7 w-7 rounded-md border text-center text-xs font-black outline-none transition ${
                            row.cells[columnIdx] === "-"
                              ? "border-transparent bg-transparent text-zinc-600"
                              : "border-white bg-white text-black shadow-md"
                          }`}
                          value={row.cells[columnIdx] === "-" ? "" : row.cells[columnIdx]}
                          onChange={(event) => {
                            const next = event.target.value.replace(/[^0-9]/g, "") || "-";
                            setGrid((current) => current.map((gridRow, gridRowIdx) => (
                              gridRowIdx === rowIdx
                                ? {
                                    ...gridRow,
                                    cells: gridRow.cells.map((cell, cellIdx) => (cellIdx === columnIdx ? next : cell)),
                                  }
                                : gridRow
                            )));
                          }}
                          placeholder="-"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {playhead >= 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute bottom-0 top-6 z-30 w-[2px] bg-[var(--color-mint)] shadow-[0_0_12px_var(--color-mint)]"
                    style={{ left: `${32 + playhead * 40}px` }}
                  />
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel glass-shine rounded-[1.75rem] p-4">
            <div className="eyebrow">ASCII preview</div>
            <pre className="mt-3 max-h-64 overflow-auto rounded-[1rem] border border-white/8 bg-black/25 p-3 font-mono text-[11px] leading-5 text-[var(--color-sand-1)]">
              {asciiPreview}
            </pre>
          </div>

          <div className="panel glass-shine rounded-[1.75rem] p-4">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Song partitures</div>
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
