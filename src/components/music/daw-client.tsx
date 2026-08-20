"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Magnet,
  Maximize2,
  Music2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { useAudio } from "@/components/music/audio-provider";
import { useProductionSong } from "@/components/music/production-song-context";
import { createPartiture } from "@/lib/music/client";
import {
  midiNoteName,
  parseMidiFile,
  restoreMidiClip,
  serializeMidiClip,
  type MidiNote,
  type ParsedMidi,
  type StoredMidiClip,
} from "@/lib/music/midi-parser";
import { scheduleMidiNotes } from "@/lib/music/midi-playback";

type AssetKind = "audio" | "midi" | "project" | "other";

type AssetRecord = {
  id: string;
  name: string;
  kind: AssetKind;
  format: string;
  size: number;
  file?: File;
};

type LayerRecord = {
  id: string;
  name: string;
  kind: "audio" | "midi" | "instrument" | "aux";
  assetId: string;
  midiTrackIndex: number;
  gain: number;
  pan: number;
  mute: boolean;
  solo: boolean;
};

const DAW_STORAGE_KEY = "music-tool-daw-session-v2";
const PIXELS_PER_SECOND = 60;
const PIANO_ROLL_MIN_NOTE = 36;
const PIANO_ROLL_MAX_NOTE = 84;

type StoredDawSession = {
  layers: LayerRecord[];
  assets: Array<Omit<AssetRecord, "file">>;
  midiClips: Record<string, StoredMidiClip>;
  selectedAssetId: string | null;
  bpm?: number;
};

function classifyKind(file: File): AssetKind {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) return "midi";
  if ([".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"].some((ext) => lower.endsWith(ext))) return "audio";
  if (lower.endsWith(".json")) return "project";
  return "other";
}

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
}

function getLayerNotes(clip: ParsedMidi | undefined, trackIndex: number): MidiNote[] {
  if (!clip) return [];
  return clip.tracks.find((track) => track.index === trackIndex)?.notes
    ?? clip.tracks[trackIndex]?.notes
    ?? [];
}

const SNAP_STEPS_PER_BEAT = 4;
const DEFAULT_NOTE_DURATION = 0.5;

let decoderContext: AudioContext | null = null;
function getDecoderContext() {
  if (!decoderContext) {
    const AudioContextCtor: typeof AudioContext = window.AudioContext
      ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    decoderContext = new AudioContextCtor();
  }
  return decoderContext;
}

function quantizeNote(note: MidiNote, gridSeconds: number): MidiNote {
  const start = Math.round(note.startTime / gridSeconds) * gridSeconds;
  const end = Math.max(start + gridSeconds, Math.round(note.endTime / gridSeconds) * gridSeconds);
  return { ...note, startTime: start, endTime: end };
}

function AudioWaveform({ file }: { file: File }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = getDecoderContext();
        const decoded = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const g = canvas.getContext("2d");
        if (!g) return;
        const channel = decoded.getChannelData(0);
        const buckets = 220;
        const step = Math.max(1, Math.floor(channel.length / buckets));
        g.clearRect(0, 0, canvas.width, canvas.height);
        const midY = canvas.height / 2;
        for (let i = 0; i < buckets; i += 1) {
          let min = 0;
          let max = 0;
          for (let j = 0; j < step; j += 1) {
            const value = channel[i * step + j] ?? 0;
            if (value < min) min = value;
            if (value > max) max = value;
          }
          const h = Math.max(1, (max - min) * midY * 0.9);
          g.fillStyle = "rgba(52,211,153,0.85)";
          g.fillRect(i, midY - h / 2, 1, h);
        }
      } catch {
        // Unsupported audio format — leave the canvas empty.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  return <canvas ref={canvasRef} width={440} height={56} className="h-14 w-full" />;
}

function PianoRoll({
  notes,
  duration,
  currentTime,
  selectedNoteId,
  onSelectNote,
  onCreateNote,
  onUpdateNote,
  onEditStart,
}: {
  notes: MidiNote[];
  duration: number;
  currentTime: number;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (note: number, startTime: number) => void;
  onUpdateNote: (noteId: string, patch: Partial<Pick<MidiNote, "note" | "startTime" | "endTime" | "velocity">>) => void;
  onEditStart: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    noteId: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origStart: number;
    origPitch: number;
    origEnd: number;
    pitchPx: number;
  } | null>(null);

  const noteRange = PIANO_ROLL_MAX_NOTE - PIANO_ROLL_MIN_NOTE;
  const width = Math.max(duration * PIXELS_PER_SECOND, 600);

  const snapTime = (value: number) => Math.max(0, Math.round(value * 100) / 100);

  function pitchFromPointerY(y: number, rect: DOMRect) {
    return Math.max(0, Math.min(127, PIANO_ROLL_MAX_NOTE - Math.round(((y - rect.top) / rect.height) * noteRange)));
  }

  function timeFromPointerX(x: number, rect: DOMRect) {
    return snapTime((x - rect.left) / PIXELS_PER_SECOND);
  }

  function handleNotePointerDown(event: React.PointerEvent, note: MidiNote, mode: "move" | "resize") {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onEditStart();
    onSelectNote(note.id);
    const rect = containerRef.current!.getBoundingClientRect();
    dragRef.current = {
      noteId: note.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origStart: note.startTime,
      origPitch: note.note,
      origEnd: note.endTime,
      pitchPx: rect.height / noteRange,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / PIXELS_PER_SECOND;
    const dy = Math.round((event.clientY - drag.startY) / drag.pitchPx);
    if (drag.mode === "move") {
      const start = snapTime(Math.max(0, drag.origStart + dx));
      const durationMs = drag.origEnd - drag.origStart;
      const pitch = Math.max(0, Math.min(127, drag.origPitch - dy));
      onUpdateNote(drag.noteId, { note: pitch, startTime: start, endTime: start + durationMs });
    } else {
      const end = snapTime(Math.max(drag.origStart + 0.05, drag.origEnd + dx));
      onUpdateNote(drag.noteId, { endTime: end });
    }
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleBackgroundPointerDown(event: React.PointerEvent) {
    if (dragRef.current || !containerRef.current) return;
    if (event.target !== event.currentTarget) return;
    if (event.button !== 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    onCreateNote(pitchFromPointerY(event.clientY, rect), timeFromPointerX(event.clientX, rect));
  }

  return (
    <div className="overflow-x-auto rounded-[1rem] border border-[var(--color-border)] bg-black/30">
      <div
        ref={containerRef}
        className="relative select-none"
        style={{ width: `${width}px`, height: "220px", touchAction: "none" }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {Array.from({ length: Math.ceil(duration) + 1 }, (_, second) => (
          <div
            key={second}
            className="absolute bottom-0 top-0 border-l border-white/5"
            style={{ left: `${second * PIXELS_PER_SECOND}px` }}
          />
        ))}
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] bg-[var(--color-copper)] shadow-[0_0_10px_var(--color-copper)]"
          style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
        />
        {notes.map((note) => {
          const top = ((PIANO_ROLL_MAX_NOTE - note.note) / noteRange) * 100;
          const height = Math.max(4, (1 / noteRange) * 100 * 0.85);
          const left = note.startTime * PIXELS_PER_SECOND;
          const noteWidth = Math.max(6, (note.endTime - note.startTime) * PIXELS_PER_SECOND);
          return (
            <button
              key={note.id}
              type="button"
              onPointerDown={(event) => handleNotePointerDown(event, note, "move")}
              className={`absolute cursor-move rounded-sm border text-[8px] font-black transition ${
                selectedNoteId === note.id
                  ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-black"
                  : "border-[var(--color-copper)]/50 bg-[var(--color-copper)]/70 text-white hover:bg-[var(--color-copper)]"
              }`}
              style={{
                top: `${top}%`,
                height: `${height}%`,
                left: `${left}px`,
                width: `${noteWidth}px`,
              }}
              title={`${midiNoteName(note.note)} · vel ${note.velocity} · drag to move`}
            >
              {noteWidth > 28 ? midiNoteName(note.note) : ""}
              {noteWidth > 40 ? (
                <span
                  role="button"
                  aria-label="Resize note"
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                  onPointerDown={(event) => handleNotePointerDown(event, note, "resize")}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DawClient() {
  const { getAudioContext } = useAudio();
  const { selectedSongId } = useProductionSong();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const manifestRef = useRef<HTMLInputElement | null>(null);
  const stopPlaybackRef = useRef<(() => void) | null>(null);
  const playbackStartedAtRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const midiHistoryRef = useRef<ParsedMidi[]>([]);

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [layers, setLayers] = useState<LayerRecord[]>([]);
  const [midiClips, setMidiClips] = useState<Record<string, ParsedMidi>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionBpm, setSessionBpm] = useState(120);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});

  const sessionDuration = useMemo(() => {
    let max = 8;
    for (const layer of layers) {
      const clip = midiClips[layer.assetId];
      if (clip) max = Math.max(max, clip.duration * (sessionBpm / clip.bpm));
      const audioDuration = audioDurations[layer.assetId];
      if (audioDuration) max = Math.max(max, audioDuration);
    }
    return max;
  }, [layers, midiClips, audioDurations, sessionBpm]);

  const pushMidiHistory = useCallback(() => {
    midiHistoryRef.current.push(selectedAssetId && midiClips[selectedAssetId]
      ? midiClips[selectedAssetId]
      : ({} as ParsedMidi));
    if (midiHistoryRef.current.length > 100) midiHistoryRef.current.shift();
  }, [midiClips, selectedAssetId]);

  const undoMidi = useCallback(() => {
    if (midiHistoryRef.current.length === 0) return;
    const previous = midiHistoryRef.current.pop();
    if (!selectedAssetId || !previous) return;
    setMidiClips((current) => (current[selectedAssetId] ? { ...current, [selectedAssetId]: previous } : current));
    toast.success("Undo last MIDI edit");
  }, [selectedAssetId]);

  const decodeAudio = useCallback(async (assetId: string, file: File): Promise<AudioBuffer> => {
    const cached = audioBuffersRef.current[assetId];
    if (cached) return cached;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await getDecoderContext().decodeAudioData(arrayBuffer);
    audioBuffersRef.current[assetId] = buffer;
    setAudioDurations((current) => ({ ...current, [assetId]: buffer.duration }));
    return buffer;
  }, []);

  const selectedClip = selectedAssetId ? midiClips[selectedAssetId] : undefined;
  const selectedTrackIndex = layers.find((layer) => layer.assetId === selectedAssetId)?.midiTrackIndex ?? 0;
  const selectedNotes = useMemo(
    () => getLayerNotes(selectedClip, selectedTrackIndex),
    [selectedClip, selectedTrackIndex],
  );
  const selectedNote = selectedNotes.find((note) => note.id === selectedNoteId) ?? null;

  const updateLayer = useCallback((layerId: string, patch: Partial<LayerRecord>) => {
    setLayers((current) => current.map((layer) => (
      layer.id === layerId ? { ...layer, ...patch } : layer
    )));
  }, []);

  const updateMidiClip = useCallback((assetId: string, updater: (clip: ParsedMidi) => ParsedMidi) => {
    setMidiClips((current) => {
      const clip = current[assetId];
      if (!clip) return current;
      return { ...current, [assetId]: updater(clip) };
    });
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DAW_STORAGE_KEY) || localStorage.getItem("music-tool-daw-session-v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredDawSession;
      if (Array.isArray(parsed.layers)) {
        setLayers(parsed.layers.map((layer) => ({
          ...layer,
          midiTrackIndex: layer.midiTrackIndex ?? 0,
        })));
      }
      if (Array.isArray(parsed.assets)) {
        setAssets(parsed.assets.map((asset) => ({ ...asset })));
      }
      if (parsed.midiClips) {
        const restored: Record<string, ParsedMidi> = {};
        for (const [assetId, stored] of Object.entries(parsed.midiClips)) {
          restored[assetId] = restoreMidiClip(stored);
        }
        setMidiClips(restored);
      }
      if (parsed.selectedAssetId) {
        setSelectedAssetId(parsed.selectedAssetId);
      }
      if (parsed.bpm) {
        setSessionBpm(parsed.bpm);
      }
    } catch {
      // Ignore invalid stored sessions.
    } finally {
      hydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const payload: StoredDawSession = {
      layers,
      assets: assets.map(({ id, name, kind, format, size }) => ({ id, name, kind, format, size })),
      midiClips: Object.fromEntries(
        Object.entries(midiClips).map(([assetId, clip]) => [assetId, serializeMidiClip(clip)]),
      ),
      selectedAssetId,
      bpm: sessionBpm,
    };
    localStorage.setItem(DAW_STORAGE_KEY, JSON.stringify(payload));
  }, [assets, layers, midiClips, selectedAssetId, sessionBpm]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      undoMidi();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undoMidi]);

  const stopPlayback = useCallback(() => {
    stopPlaybackRef.current?.();
    stopPlaybackRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsPlaying(false);
  }, []);

  const startPlayback = useCallback(async (fromTime = currentTime) => {
    const ctx = getAudioContext();
    await ctx.resume();
    playbackStartedAtRef.current = ctx.currentTime;
    playbackOffsetRef.current = fromTime;

    const soloLayer = layers.find((layer) => layer.solo);
    const audibleLayers = layers.filter((layer) => {
      if (layer.mute || !layer.assetId) return false;
      if (soloLayer) return layer.solo;
      return true;
    });

    const stops: Array<() => void> = [];
    for (const layer of audibleLayers) {
      const clip = midiClips[layer.assetId];
      const asset = assets.find((item) => item.id === layer.assetId);
      if (clip) {
        const tempoRatio = sessionBpm / clip.bpm;
        const notes = getLayerNotes(clip, layer.midiTrackIndex).map((note) => ({
          ...note,
          startTime: note.startTime * tempoRatio,
          endTime: note.endTime * tempoRatio,
        }));
        if (notes.length === 0) continue;
        const stop = scheduleMidiNotes(ctx, notes, {
          startAt: ctx.currentTime + 0.05,
          offsetSeconds: fromTime,
          gain: layer.gain,
          pan: layer.pan,
          mute: layer.mute,
        });
        stops.push(stop);
      } else if (layer.kind === "audio" && asset?.file) {
        try {
          const buffer = await decodeAudio(asset.id, asset.file);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gainNode = ctx.createGain();
          gainNode.gain.value = layer.gain / 100;
          const panner = ctx.createStereoPanner();
          panner.pan.value = layer.pan / 100;
          source.connect(gainNode);
          gainNode.connect(panner);
          panner.connect(ctx.destination);
          source.start(ctx.currentTime + 0.05, fromTime);
          stops.push(() => {
            try {
              source.stop();
            } catch {
              // Already stopped.
            }
          });
        } catch {
          toast.error(`Could not decode audio for ${asset.name}`);
        }
      }
    }

    stopPlaybackRef.current = () => stops.forEach((stop) => stop());
    setIsPlaying(true);

    const tick = () => {
      const elapsed = ctx.currentTime - playbackStartedAtRef.current + fromTime;
      setCurrentTime(elapsed);
      if (elapsed >= sessionDuration) {
        stopPlayback();
        setCurrentTime(0);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [assets, currentTime, decodeAudio, getAudioContext, layers, midiClips, sessionBpm, sessionDuration, stopPlayback]);

  const togglePlayback = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback(currentTime >= sessionDuration ? 0 : currentTime);
    }
  };

  const importFiles = async (files: FileList | null) => {
    if (!files) return;

    for (const file of Array.from(files)) {
      const asset: AssetRecord = {
        id: crypto.randomUUID(),
        name: file.name,
        kind: classifyKind(file),
        format: file.name.split(".").pop()?.toLowerCase() || "",
        size: file.size,
        file,
      };

      setAssets((current) => [...current, asset]);

      if (asset.kind !== "midi") continue;

      try {
        const parsed = parseMidiFile(await file.arrayBuffer());
        setMidiClips((current) => ({ ...current, [asset.id]: parsed }));
        setSelectedAssetId(asset.id);

        const tracksWithNotes = parsed.tracks.filter((track) => track.notes.length > 0);
        const newLayers: LayerRecord[] = tracksWithNotes.map((track) => ({
          id: crypto.randomUUID(),
          name: track.name,
          kind: "midi",
          assetId: asset.id,
          midiTrackIndex: track.index,
          gain: 80,
          pan: 0,
          mute: false,
          solo: false,
        }));

        if (newLayers.length === 0) {
          newLayers.push({
            id: crypto.randomUUID(),
            name: file.name.replace(/\.(mid|midi)$/i, ""),
            kind: "midi",
            assetId: asset.id,
            midiTrackIndex: 0,
            gain: 80,
            pan: 0,
            mute: false,
            solo: false,
          });
        }

        setLayers((current) => [...current, ...newLayers]);
        toast.success(`Imported MIDI: ${parsed.tracks.reduce((sum, track) => sum + track.notes.length, 0)} notes @ ${parsed.bpm} BPM`);
      } catch (error) {
        toast.error(`Failed to parse ${file.name}: ${(error as Error).message}`);
      }
    }
  };

  const addTrack = (kind: LayerRecord["kind"]) => {
    setLayers((current) => [...current, {
      id: crypto.randomUUID(),
      name: `New ${kind} track`,
      kind,
      assetId: "",
      midiTrackIndex: 0,
      gain: 80,
      pan: 0,
      mute: false,
      solo: false,
    }]);
  };

  const deleteNote = (noteId: string) => {
    if (!selectedAssetId) return;
    pushMidiHistory();
    updateMidiClip(selectedAssetId, (clip) => ({
      ...clip,
      tracks: clip.tracks.map((track) => (
        track.index === selectedTrackIndex
          ? { ...track, notes: track.notes.filter((note) => note.id !== noteId) }
          : track
      )),
    }));
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const updateNote = (noteId: string, patch: Partial<Pick<MidiNote, "velocity" | "note" | "startTime" | "endTime">>) => {
    if (!selectedAssetId) return;
    updateMidiClip(selectedAssetId, (clip) => ({
      ...clip,
      tracks: clip.tracks.map((track) => (
        track.index === selectedTrackIndex
          ? {
              ...track,
              notes: track.notes.map((note) => (
                note.id === noteId ? { ...note, ...patch } : note
              )),
            }
          : track
      )),
    }));
  };

  const transposeClip = (semitones: number) => {
    if (!selectedAssetId || semitones === 0) return;
    pushMidiHistory();
    updateMidiClip(selectedAssetId, (clip) => ({
      ...clip,
      tracks: clip.tracks.map((track) => (
        track.index === selectedTrackIndex
          ? {
              ...track,
              notes: track.notes.map((note) => ({
                ...note,
                note: Math.max(0, Math.min(127, note.note + semitones)),
              })),
            }
          : track
      )),
    }));
    toast.success(`Transposed ${semitones > 0 ? "+" : ""}${semitones} semitones`);
  };

  const quantizeSelected = () => {
    if (!selectedAssetId) return;
    pushMidiHistory();
    const gridSeconds = 60 / sessionBpm / SNAP_STEPS_PER_BEAT;
    updateMidiClip(selectedAssetId, (clip) => ({
      ...clip,
      tracks: clip.tracks.map((track) => (
        track.index === selectedTrackIndex
          ? { ...track, notes: track.notes.map((note) => quantizeNote(note, gridSeconds)) }
          : track
      )),
    }));
    toast.success(`Quantized to 1/${SNAP_STEPS_PER_BEAT} notes @ ${sessionBpm} BPM`);
  };

  const createNote = (note: number, startTime: number) => {
    if (!selectedAssetId) return;
    pushMidiHistory();
    updateMidiClip(selectedAssetId, (clip) => ({
      ...clip,
      tracks: clip.tracks.map((track) => (
        track.index === selectedTrackIndex
? {
                ...track,
                notes: [
                  ...track.notes,
                  {
                    id: crypto.randomUUID(),
                    note,
                    velocity: 100,
                    startTick: 0,
                    endTick: 0,
                    startTime,
                    endTime: startTime + DEFAULT_NOTE_DURATION,
                    channel: 0,
                  },
                ].sort((a, b) => a.startTime - b.startTime),
              }
          : track
      )),
    }));
    toast.success(`Added ${midiNoteName(note)}`);
  };

  const importManifest = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as StoredDawSession;
        if (!Array.isArray(parsed.layers)) throw new Error("Not a valid DAW session file");
        setLayers(parsed.layers.map((layer) => ({
          ...layer,
          midiTrackIndex: layer.midiTrackIndex ?? 0,
        })));
        if (Array.isArray(parsed.assets)) setAssets(parsed.assets.map((asset) => ({ ...asset })));
        if (parsed.midiClips) {
          const restored: Record<string, ParsedMidi> = {};
          for (const [assetId, stored] of Object.entries(parsed.midiClips)) {
            restored[assetId] = restoreMidiClip(stored);
          }
          setMidiClips(restored);
        }
        if (parsed.selectedAssetId) setSelectedAssetId(parsed.selectedAssetId);
        toast.success("Session manifest imported (audio files must be re-imported)");
      } catch (error) {
        toast.error(`Import failed: ${(error as Error).message}`);
      } finally {
        if (manifestRef.current) manifestRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const saveToSong = async () => {
    if (!selectedSongId) {
      toast.error("Open a song in Production Studio first");
      return;
    }
    const manifest = {
      app: "music-tool-daw",
      version: 2,
      exportedAt: new Date().toISOString(),
      duration: sessionDuration,
      bpm: sessionBpm,
      layers: layers.map((layer) => ({
        name: layer.name,
        kind: layer.kind,
        asset: assets.find((asset) => asset.id === layer.assetId)?.name || null,
        midiTrackIndex: layer.midiTrackIndex,
        gain: layer.gain,
        pan: layer.pan,
        mute: layer.mute,
        solo: layer.solo,
      })),
      assets: assets.map((asset) => ({
        name: asset.name,
        kind: asset.kind,
        format: asset.format,
        size: asset.size,
        midi: asset.kind === "midi" && midiClips[asset.id]
          ? serializeMidiClip(midiClips[asset.id])
          : null,
      })),
    };
    try {
      await createPartiture(selectedSongId, {
        instrument: "other",
        slot: 1,
        title: `DAW session ${new Date().toLocaleString()}`,
        content: JSON.stringify(manifest, null, 2),
        format: "daw",
      });
      toast.success("DAW session saved to song");
    } catch (error) {
      toast.error(`Failed to save session: ${(error as Error).message}`);
    }
  };

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const exportManifest = () => {
    const manifest = {
      app: "music-tool-daw",
      version: 2,
      exportedAt: new Date().toISOString(),
      duration: sessionDuration,
      layers: layers.map((layer) => ({
        name: layer.name,
        kind: layer.kind,
        asset: assets.find((asset) => asset.id === layer.assetId)?.name || null,
        midiTrackIndex: layer.midiTrackIndex,
        gain: layer.gain,
        pan: layer.pan,
        mute: layer.mute,
        solo: layer.solo,
      })),
      assets: assets.map((asset) => ({
        name: asset.name,
        kind: asset.kind,
        format: asset.format,
        size: asset.size,
        midi: asset.kind === "midi" && midiClips[asset.id]
          ? serializeMidiClip(midiClips[asset.id])
          : null,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "daw-session.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Session exported with MIDI note data");
  };

  return (
    <div className="animate-fade-up space-y-4">
      <div className="panel glass-shine flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] p-4">
        <div className="flex items-center gap-4">
          <div className="glass-pill flex items-center gap-1 bg-black/40 px-3 py-1.5">
            <button type="button" onClick={() => { stopPlayback(); setCurrentTime(0); }} aria-label="Reset to start" className="p-1 transition-colors hover:text-[var(--color-copper)]">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={togglePlayback} className={`p-1 transition-colors ${isPlaying ? "text-[var(--color-mint)]" : "hover:text-[var(--color-mint)]"}`}>
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>
          </div>
          <div className="font-mono text-xl tabular-nums tracking-tighter text-[var(--color-mint)]">
            {formatClock(currentTime)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
            {sessionDuration.toFixed(1)}s session
          </div>
          <label className="glass-pill flex items-center gap-2 bg-black/40 px-3 py-1.5">
            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">BPM</span>
            <input
              type="number"
              min={40}
              max={300}
              value={sessionBpm}
              onChange={(event) => setSessionBpm(Math.max(40, Math.min(300, Number(event.target.value) || 120)))}
              className="w-12 border-none bg-transparent font-mono text-sm font-bold text-[var(--color-mint)] outline-none"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" multiple accept=".mid,.midi,.wav,.mp3,.ogg,.json,audio/*" className="hidden" onChange={(event) => void importFiles(event.target.files)} />
          <input ref={manifestRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => importManifest(event.target.files)} />
          <button type="button" onClick={() => inputRef.current?.click()} className="glass-pill flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest">
            <Upload className="h-3.5 w-3.5" />
            Import MIDI / Audio
          </button>
          <button type="button" onClick={() => manifestRef.current?.click()} className="glass-pill flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest">
            <Download className="h-3.5 w-3.5" />
            Import Session
          </button>
          <button type="button" onClick={exportManifest} className="glass-pill flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest">
            <Download className="h-3.5 w-3.5" />
            Export Session
          </button>
          <button type="button" onClick={() => void saveToSong()} className="glass-pill flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest">
            <Save className="h-3.5 w-3.5" />
            Save to song
          </button>
          <button type="button" onClick={undoMidi} className="glass-pill px-3 py-2 text-[8px] font-black uppercase text-[var(--color-copper)]">Undo</button>
          <button type="button" onClick={quantizeSelected} className="glass-pill flex items-center gap-1.5 px-3 py-2 text-[8px] font-black uppercase text-[var(--color-brass)]">
            <Magnet className="h-3 w-3" />
            Quantize
          </button>
          <button type="button" onClick={() => addTrack("midi")} className="glass-pill px-3 py-2 text-[8px] font-black uppercase text-[var(--color-brass)]">+ MIDI track</button>
          <button type="button" onClick={() => addTrack("audio")} className="glass-pill px-3 py-2 text-[8px] font-black uppercase text-[var(--color-mint)]">+ Audio track</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          <div className="panel flex h-10 items-center justify-between rounded-xl px-3">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Tracks</span>
            <Maximize2 className="h-3 w-3 opacity-30" />
          </div>
          {layers.map((layer) => {
            const clip = layer.assetId ? midiClips[layer.assetId] : undefined;
            const noteCount = getLayerNotes(clip, layer.midiTrackIndex).length;
            return (
              <div key={layer.id} className="panel flex min-h-[140px] flex-col justify-between gap-3 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className={`h-2 w-2 rounded-full ${layer.kind === "audio" ? "bg-[var(--color-mint)]" : "bg-[var(--color-brass)]"}`} />
                  <input className="w-full border-none bg-transparent text-xs font-bold outline-none focus:text-[var(--color-copper)]" value={layer.name} onChange={(event) => updateLayer(layer.id, { name: event.target.value })} />
                  <button type="button" onClick={() => setLayers((current) => current.filter((item) => item.id !== layer.id))} aria-label={`Delete track ${layer.name}`} className="p-1 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <select
                  className="field py-1.5 text-[10px]"
                  value={layer.assetId}
                  onChange={(event) => {
                    updateLayer(layer.id, { assetId: event.target.value });
                    if (event.target.value) setSelectedAssetId(event.target.value);
                  }}
                >
                  <option value="">Assign asset</option>
                  {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
                {clip ? (
                  <select
                    className="field py-1.5 text-[10px]"
                    value={layer.midiTrackIndex}
                    onChange={(event) => updateLayer(layer.id, { midiTrackIndex: Number(event.target.value) })}
                  >
                    {clip.tracks.map((track) => (
                      <option key={track.index} value={track.index}>{track.name} ({track.notes.length})</option>
                    ))}
                  </select>
                ) : null}
                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-sand-2)]">
                  {noteCount} notes
                </div>
                <label className="block text-[8px] font-black uppercase tracking-widest text-zinc-500">
                  Gain {layer.gain}
                  <input type="range" min={0} max={100} value={layer.gain} onChange={(event) => updateLayer(layer.id, { gain: Number(event.target.value) })} className="mt-1 w-full accent-[var(--color-mint)]" />
                </label>
                <div className="flex gap-1">
                  <button type="button" className={`flex-1 rounded border py-1 text-[8px] font-black ${layer.mute ? "border-red-500/50 bg-red-500/20 text-red-500" : "border-white/10 opacity-50"}`} onClick={() => updateLayer(layer.id, { mute: !layer.mute })}>Mute</button>
                  <button type="button" className={`flex-1 rounded border py-1 text-[8px] font-black ${layer.solo ? "border-yellow-500/50 bg-yellow-500/20 text-yellow-500" : "border-white/10 opacity-50"}`} onClick={() => updateLayer(layer.id, { solo: !layer.solo })}>Solo</button>
                </div>
              </div>
            );
          })}
          {layers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-[10px] font-bold uppercase text-zinc-600">No tracks — import a MIDI file</div>
          ) : null}
        </div>

        <div className="panel flex min-h-[600px] flex-col overflow-hidden rounded-[1.25rem] bg-black/40">
          <div className="relative flex h-10 overflow-x-auto border-b border-white/5">
            {Array.from({ length: Math.ceil(sessionDuration) + 2 }, (_, second) => (
              <div key={second} className="w-[60px] flex-none border-r border-white/5 pl-1 pt-1 font-mono text-[9px] tabular-nums text-zinc-600">
                {second}s
              </div>
            ))}
            <div className="absolute bottom-0 top-0 z-10 w-[2px] bg-[var(--color-copper)] shadow-[0_0_10px_var(--color-copper)]" style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }} />
          </div>
          <div className="flex-1 overflow-auto">
            <div className="space-y-2 py-2">
              {layers.map((layer) => {
                const clip = layer.assetId ? midiClips[layer.assetId] : undefined;
                const notes = getLayerNotes(clip, layer.midiTrackIndex);
                const asset = assets.find((item) => item.id === layer.assetId);
                const regionWidth = Math.max((clip?.duration ?? audioDurations[layer.assetId] ?? 4) * PIXELS_PER_SECOND, 120);
                const isAudio = layer.kind === "audio";
                return (
                  <div key={layer.id} className="relative h-[100px] border-b border-white/5 bg-zinc-900/10">
                    {isAudio && asset?.file ? (
                      <button
                        type="button"
                        onClick={() => setSelectedAssetId(layer.assetId)}
                        className="absolute inset-y-2 left-0 overflow-hidden rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 p-2 text-left"
                        style={{ width: `${regionWidth}px` }}
                      >
                        <div className="text-[10px] font-black text-[var(--color-mint)]">{asset.name}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Volume2 className="h-3.5 w-3.5 shrink-0 text-[var(--color-mint)]" />
                          <div className="min-w-0 flex-1"><AudioWaveform file={asset.file} /></div>
                        </div>
                      </button>
                    ) : clip && notes.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedAssetId(layer.assetId)}
                        className="absolute inset-y-2 left-0 overflow-hidden rounded-lg border border-[var(--color-copper)]/40 bg-[var(--color-copper)]/15 p-2 text-left"
                        style={{ width: `${regionWidth}px` }}
                      >
                        <div className="text-[10px] font-black">{asset?.name}</div>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {notes.slice(0, 24).map((note) => (
                            <span
                              key={note.id}
                              className="rounded bg-[var(--color-copper)]/50 px-1 text-[7px] font-bold"
                              style={{
                                marginLeft: `${note.startTime * 2}px`,
                                opacity: 0.5 + (note.velocity / 127) * 0.5,
                              }}
                            >
                              {midiNoteName(note.note)}
                            </span>
                          ))}
                        </div>
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {layer.assetId
                          ? isAudio
                            ? "Audio file unavailable after reload — re-import to hear it"
                            : "No notes in this MIDI track"
                          : "Assign an asset"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedClip ? (
        <div className="panel glass-shine space-y-4 rounded-[1.75rem] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Music2 className="h-5 w-5 text-[var(--color-brass)]" />
              <div>
                <div className="eyebrow">MIDI inspector</div>
                <h3 className="text-lg font-black">{assets.find((asset) => asset.id === selectedAssetId)?.name}</h3>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
              <span className="glass-pill px-3 py-1.5">{selectedClip.bpm} BPM</span>
              <span className="glass-pill px-3 py-1.5">{selectedNotes.length} notes</span>
              <span className="glass-pill px-3 py-1.5">{selectedClip.duration.toFixed(1)}s</span>
              <button type="button" className="glass-pill px-3 py-1.5" onClick={() => transposeClip(-1)}>-1 st</button>
              <button type="button" className="glass-pill px-3 py-1.5" onClick={() => transposeClip(1)}>+1 st</button>
              <button type="button" className="glass-pill px-3 py-1.5" onClick={quantizeSelected}>
                <Magnet className="mr-1 inline h-3 w-3" />
                Quantize
              </button>
              <button type="button" className="glass-pill px-3 py-1.5" onClick={() => void startPlayback(0)}>
                <Play className="mr-1 inline h-3 w-3" />
                Audition
              </button>
            </div>
          </div>

          <PianoRoll
            notes={selectedNotes}
            duration={selectedClip.duration * (sessionBpm / selectedClip.bpm)}
            currentTime={currentTime}
            selectedNoteId={selectedNoteId}
            onSelectNote={setSelectedNoteId}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onEditStart={pushMidiHistory}
          />

          {selectedNote ? (
            <div className="modal-inset-panel flex flex-wrap items-end gap-4 rounded-[1rem] p-4">
              <div>
                <div className="field-label">Note</div>
                <div className="text-2xl font-black">{midiNoteName(selectedNote.note)}</div>
              </div>
              <label className="field-group min-w-[180px]">
                <span className="field-label">Pitch</span>
                <input type="number" min={0} max={127} className="field py-2" value={selectedNote.note} onChange={(event) => updateNote(selectedNote.id, { note: Number(event.target.value) })} />
              </label>
              <label className="field-group min-w-[180px]">
                <span className="field-label">Velocity ({selectedNote.velocity})</span>
                <input type="range" min={1} max={127} value={selectedNote.velocity} onChange={(event) => updateNote(selectedNote.id, { velocity: Number(event.target.value) })} className="w-full accent-[var(--color-copper)]" />
              </label>
              <label className="field-group min-w-[120px]">
                <span className="field-label">Start</span>
                <div className="field py-2 text-sm">{selectedNote.startTime.toFixed(2)}s</div>
              </label>
              <label className="field-group min-w-[120px]">
                <span className="field-label">Duration</span>
                <div className="field py-2 text-sm">{(selectedNote.endTime - selectedNote.startTime).toFixed(2)}s</div>
              </label>
              <button type="button" onClick={() => deleteNote(selectedNote.id)} className="glass-pill flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
                Delete note
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-sand-2)]">
              <Pencil className="mr-1 inline h-3.5 w-3.5" />
              Click empty space to add a note, drag notes to move, drag the right edge to resize.
            </p>
          )}

          <div className="max-h-48 overflow-auto rounded-[1rem] border border-[var(--color-border)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--color-modal-surface)] text-[10px] uppercase tracking-widest text-[var(--color-brass)]">
                <tr>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Start</th>
                  <th className="px-3 py-2">Dur</th>
                  <th className="px-3 py-2">Vel</th>
                  <th className="px-3 py-2">Ch</th>
                </tr>
              </thead>
              <tbody>
                {selectedNotes.slice(0, 200).map((note) => (
                  <tr
                    key={note.id}
                    className={`cursor-pointer border-t border-white/5 ${selectedNoteId === note.id ? "bg-[var(--color-info-surface)]" : "hover:bg-white/5"}`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <td className="px-3 py-1.5 font-bold">{midiNoteName(note.note)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{note.startTime.toFixed(2)}s</td>
                    <td className="px-3 py-1.5 tabular-nums">{(note.endTime - note.startTime).toFixed(2)}s</td>
                    <td className="px-3 py-1.5">{note.velocity}</td>
                    <td className="px-3 py-1.5">{note.channel + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="panel rounded-[1.75rem] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest opacity-60">Asset browser</h3>
          <span className="text-[10px] font-bold text-zinc-500">{assets.length} items</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {assets.map((asset) => {
            const clip = midiClips[asset.id];
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAssetId(asset.id)}
                className={`glass-pill rounded-2xl p-3 text-left transition ${selectedAssetId === asset.id ? "glass-pill-active" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/40">
                    {asset.kind === "audio" ? <Volume2 className="h-4 w-4 text-[var(--color-mint)]" /> : <Music2 className="h-4 w-4 text-[var(--color-brass)]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black">{asset.name}</div>
                    <div className="text-[9px] font-bold uppercase opacity-60">
                      {asset.format} · {(asset.size / 1024).toFixed(0)}KB
                      {clip ? ` · ${clip.tracks.reduce((sum, track) => sum + track.notes.length, 0)} notes` : ""}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
