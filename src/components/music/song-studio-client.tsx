"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StudioSidebar } from "@/components/music/studio-sidebar";

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  ChevronUp,
  Disc3,
  Guitar,
  Layout,
  Mic2,
  Minus,
  Music2,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { useProductionSong } from "@/components/music/production-song-context";
import {
  createPartiture,
  createSong,
  deletePartiture,
  deleteSong,
  deleteSongPart,
  fetchPartitures,
  fetchSongDetail,
  fetchSongs,
  saveSongPart,
  updatePartiture,
  updateSong,
} from "@/lib/music/client";
import {
  PARTITURE_INSTRUMENTS,
  defaultPartitureTitle,
  nextPartitureSlot,
  partitureInstrumentLabel,
  partitureKey,
  type PartitureInstrumentId,
} from "@/lib/music/partitures";
import type { MusicSongDetail, MusicSongSummary, MusicTaskTemplateRecord } from "@/lib/music/types";
import { opaqueModalProps } from "@/lib/ui/modal-styles";

type EditablePartiture = {
  id?: string;
  instrument: string;
  slot: number;
  title: string;
  content: string;
  format: string;
};

const INSTRUMENT_ICONS: Record<string, typeof Guitar> = {
  guitar: Guitar,
  bass: Music2,
  drums: Layout,
  keys: Music2,
  vocals: Mic2,
  other: Disc3,
};

const PARTITURE_FORMATS = ["text-tab", "grid", "lyrics", "notation", "ascii"] as const;

const DRUM_KITS = ["Kick", "Snare", "Hi-hat", "Open HH", "Crash", "Ride", "Tom L", "Tom M", "Tom H"] as const;

function parseDrumContent(content: string): boolean[][] {
  const matrix = DRUM_KITS.map(() => [] as boolean[]);
  for (const line of content.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const namePart = line.slice(0, idx).trim().toLowerCase();
    const cellsPart = line.slice(idx + 1).trim();
    const kitIndex = DRUM_KITS.findIndex((name) => name.toLowerCase() === namePart);
    if (kitIndex === -1) continue;
    matrix[kitIndex] = cellsPart.split("").map((char) => char === "x" || char === "X");
  }
  return matrix;
}

function serializeDrumContent(matrix: boolean[][]): string {
  return matrix
    .map((cells, index) => `${DRUM_KITS[index]}: ${cells.map((on) => (on ? "x" : "-")).join("")}`)
    .join("\n");
}

function DrumGridEditor({ content, onChange }: { content: string; onChange: (next: string) => void }) {
  const parsed = useMemo(() => parseDrumContent(content), [content]);
  const [stepCount, setStepCount] = useState(Math.max(16, Math.max(...parsed.map((row) => row.length), 16)));

  const cellAt = (kitIndex: number, step: number) => parsed[kitIndex]?.[step] ?? false;

  const toggle = (kitIndex: number, step: number) => {
    const next = parsed.map((row, index) => {
      if (index !== kitIndex) return Array.from({ length: stepCount }, (_, s) => row[s] ?? false);
      return Array.from({ length: stepCount }, (_, s) => (s === step ? !(row[s] ?? false) : (row[s] ?? false)));
    });
    onChange(serializeDrumContent(next));
  };

  const resize = (count: number) => {
    const clamped = Math.max(8, Math.min(64, count));
    setStepCount(clamped);
    onChange(serializeDrumContent(parsed.map((row) => Array.from({ length: clamped }, (_, s) => row[s] ?? false))));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="field-label">Drum grid</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Remove steps" className="glass-pill px-2 py-1 text-[10px] font-black" onClick={() => resize(stepCount - 4)}>-4</button>
          <span className="text-[10px] font-bold text-[var(--color-sand-2)]">{stepCount} steps</span>
          <button type="button" aria-label="Add steps" className="glass-pill px-2 py-1 text-[10px] font-black" onClick={() => resize(stepCount + 4)}>+4</button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto rounded-[1rem] border border-white/8 bg-black/25 p-2">
        <div className="flex gap-1 pl-20">
          {Array.from({ length: stepCount }, (_, step) => (
            <span key={step} className="w-5 flex-none text-center text-[8px] font-bold uppercase text-[var(--color-sand-2)]">
              {(step % 4) + 1}
            </span>
          ))}
        </div>
        {DRUM_KITS.map((kit, kitIndex) => (
          <div key={kit} className="mt-1 flex items-center gap-1">
            <span className="w-20 flex-none truncate text-[9px] font-black uppercase tracking-wider text-[var(--color-sand-2)]">{kit}</span>
            {Array.from({ length: stepCount }, (_, step) => (
              <button
                key={step}
                type="button"
                aria-label={`${kit} step ${step + 1}`}
                onClick={() => toggle(kitIndex, step)}
                className={`h-5 w-5 flex-none rounded border text-[8px] font-black transition ${
                  cellAt(kitIndex, step)
                    ? step % 4 === 0
                      ? "border-[var(--color-copper)] bg-[var(--color-copper)] text-white"
                      : "border-[var(--color-mint)] bg-[var(--color-mint)]/80 text-black"
                    : "border-white/10 bg-white/5"
                }`}
              >
                {cellAt(kitIndex, step) ? "x" : ""}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const KEY_OPTIONS = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Am", "A#m", "Bm", "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m",
] as const;

function validateJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

function formatJson(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2);
}

function formatSavedAt(value: string | null) {
  if (!value) return "Not saved";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function FieldGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`field-group ${className}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function patchSong(
  current: MusicSongDetail | null,
  patch: Partial<MusicSongDetail["song"]>,
): MusicSongDetail | null {
  if (!current) return current;
  return { ...current, song: { ...current.song, ...patch } };
}

export function SongStudioClient() {
  const { selectedSongId: hubSongId, setSelectedSongId: setHubSongId, refreshSongs } = useProductionSong();

  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [partitures, setPartitures] = useState<EditablePartiture[]>([]);
  const [addInstrument, setAddInstrument] = useState<PartitureInstrumentId>("guitar");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const bootedRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);
  const sectionOriginalNamesRef = useRef<string[]>([]);
  const skipConfirmRef = useRef(false);
  const { isOpen: deleteOpen, onOpen: openDelete, onOpenChange: onDeleteOpenChange, onClose: closeDelete } = useDisclosure();

  const isDirty = useMemo(() => {
    if (!selectedSong) return false;
    return JSON.stringify(selectedSong) !== savedSnapshot;
  }, [savedSnapshot, selectedSong]);

  async function loadLibrary(nextSelectedId?: string, showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const payload = await fetchSongs(search);
      setSongs(payload.songs);
      const preferredId = nextSelectedId || selectedSongId || hubSongId || payload.songs[0]?.id || "";
      if (preferredId) {
        await selectSong(preferredId, false);
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
        setSavedSnapshot("");
      }
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function selectSong(songId: string, showSpinner = true) {
    if (!skipConfirmRef.current && songId !== selectedSongId && isDirty) {
      const proceed = window.confirm("You have unsaved changes. Discard them and switch songs?");
      if (!proceed) return;
    }
    if (showSpinner) setLoading(true);
    try {
      const [payload, partiturePayload] = await Promise.all([
        fetchSongDetail(songId),
        fetchPartitures(songId),
      ]);
      setSelectedSong(payload.song);
      setPartitures(
        partiturePayload.partitures.map((item) => ({
          id: item.id,
          instrument: item.instrument,
          slot: item.slot,
          title: item.title,
          content: item.content,
          format: item.format || "ascii",
        })),
      );
      setSelectedSongId(songId);
      setSavedSnapshot(JSON.stringify(payload.song));
      setHubSongId(songId);
      sectionOriginalNamesRef.current = payload.song.sections.map((section) => section.name);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  function pushHistory() {
    if (!selectedSong) return;
    const snapshot = JSON.stringify(selectedSong);
    const history = historyRef.current;
    if (history[historyIndex] === snapshot) return;
    history.splice(historyIndex + 1);
    history.push(snapshot);
    if (history.length > 100) history.shift();
    setHistoryLength(history.length);
    setHistoryIndex(history.length - 1);
  }

  function undo() {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const restored = historyRef.current[nextIndex];
    if (restored) {
      setHistoryIndex(nextIndex);
      setSelectedSong(JSON.parse(restored) as MusicSongDetail);
    }
  }

  function redo() {
    if (historyIndex >= historyRef.current.length - 1) return;
    const nextIndex = historyIndex + 1;
    const restored = historyRef.current[nextIndex];
    if (restored) {
      setHistoryIndex(nextIndex);
      setSelectedSong(JSON.parse(restored) as MusicSongDetail);
    }
  }

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const payload = await fetchSongs();
        if (cancelled) return;
        setSongs(payload.songs);
        const preferredId = hubSongId || payload.songs[0]?.id || "";
        if (preferredId) {
          const detail = await fetchSongDetail(preferredId);
          if (cancelled) return;
          setSelectedSong(detail.song);
          setSelectedSongId(preferredId);
          setSavedSnapshot(JSON.stringify(detail.song));
        }
      } catch (error) {
        if (!cancelled) toast.error((error as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // void fetchTemplates() // Kept for reuse later
    //   .then((payload) => {
    //     if (cancelled) return;
    //     setPromptTemplates(payload.templates);
    //     if (payload.templates[0]) setSelectedPromptTemplateId(payload.templates[0].id);
    //   })
    //   .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [hubSongId]);

  useEffect(() => {
    if (!hubSongId || hubSongId === selectedSongId || loading) return;
    void selectSong(hubSongId, false);
  }, [hubSongId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  async function saveSongFields() {
    if (!selectedSong) return;
    pushHistory();
    setSaving(true);
    try {
      const payload = await updateSong(selectedSong.song.id, selectedSong.song as unknown as Record<string, unknown>);
      setSelectedSong(payload.song);
      setSavedSnapshot(JSON.stringify(payload.song));
      setSongs((current) => current.map((song) =>
        song.id === payload.song.song.id ? { ...song, title: payload.song.song.title } : song,
      ));
      toast.success("Song saved");
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function createDraftSong() {
    try {
      const payload = await createSong({ title: `Untitled sketch ${new Date().toLocaleDateString()}` });
      toast.success("Song created");
      await loadLibrary(payload.song?.song.id);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveSongFields();
      } else if (event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSong, isDirty]);

  function confirmDeleteSong(song: { id: string; title: string }) {
    setDeleteTarget(song);
    openDelete();
  }

  async function removeSong() {
    if (!deleteTarget) return;
    try {
      await deleteSong(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.title}"`);
      closeDelete();
      setDeleteTarget(null);
      const remaining = songs.filter((song) => song.id !== deleteTarget.id);
      setSongs(remaining);
      const nextId = remaining[0]?.id || "";
      if (nextId) {
        skipConfirmRef.current = true;
        await selectSong(nextId);
        skipConfirmRef.current = false;
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
        setSavedSnapshot("");
        setPartitures([]);
      }
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function updatePartitureField(
    key: string,
    patch: Partial<EditablePartiture>,
  ) {
    setPartitures((current) =>
      current.map((item) => (partitureKey(item.instrument, item.slot) === key ? { ...item, ...patch } : item)),
    );
  }

  function addPartitureRow() {
    const slot = nextPartitureSlot(partitures, addInstrument);
    setPartitures((current) => [
      ...current,
      {
        instrument: addInstrument,
        slot,
        title: defaultPartitureTitle(addInstrument, slot),
        content: "",
        format: addInstrument === "drums" ? "grid" : addInstrument === "vocals" ? "lyrics" : "ascii",
      },
    ]);
  }

  async function persistPartiture(partiture: EditablePartiture) {
    if (!selectedSongId) return;
    try {
      if (partiture.id) {
        await updatePartiture(partiture.id, partiture);
      } else {
        await createPartiture(selectedSongId, partiture);
      }
      toast.success("Partiture saved");
      const partiturePayload = await fetchPartitures(selectedSongId);
      setPartitures(
        partiturePayload.partitures.map((item) => ({
          id: item.id,
          instrument: item.instrument,
          slot: item.slot,
          title: item.title,
          content: item.content,
          format: item.format || "ascii",
        })),
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removePartiture(partiture: EditablePartiture) {
    const key = partitureKey(partiture.instrument, partiture.slot);
    if (partiture.id) {
      try {
        await deletePartiture(partiture.id);
        toast.success("Partiture removed");
        const partiturePayload = await fetchPartitures(selectedSongId);
        setPartitures(
          partiturePayload.partitures.map((item) => ({
            id: item.id,
            instrument: item.instrument,
            slot: item.slot,
            title: item.title,
            content: item.content,
            format: item.format || "ascii",
          })),
        );
      } catch (error) {
        toast.error((error as Error).message);
      }
      return;
    }
    setPartitures((current) => current.filter((item) => partitureKey(item.instrument, item.slot) !== key));
  }



  return (
    <div className="page-grid animate-fade-up">
      <StudioSidebar
        songs={songs}
        selectedSongId={selectedSongId}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={() => void loadLibrary()}
        onRefresh={() => void loadLibrary()}
        onNew={() => void createDraftSong()}
        onSelectSong={(id) => void selectSong(id)}
        onDeleteSong={confirmDeleteSong}
      />

      <section className="space-y-5">
        {loading ? (
          <div className="panel flex min-h-[360px] items-center justify-center rounded-[1.75rem] p-6">
            <Spinner color="warning" />
          </div>
        ) : selectedSong ? (
          <>
            <div className="panel glass-shine rounded-[1.25rem] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Song editor</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">{selectedSong.song.title}</h2>
                  <p className="mt-0.5 text-[11px] text-[var(--color-sand-2)]">
                    Last saved {formatSavedAt(selectedSong.song.saved_at)}
                    {isDirty ? " · Unsaved changes" : " · Up to date"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    radius="full"
                    variant="bordered"
                    isDisabled={historyIndex <= 0}
                    onPress={undo}
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    radius="full"
                    variant="bordered"
                    isDisabled={historyIndex >= historyLength - 1}
                    onPress={redo}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <Button
                    radius="full"
                    variant="bordered"
                    color="danger"
                    onPress={() => confirmDeleteSong({ id: selectedSong.song.id, title: selectedSong.song.title })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    className={`bg-[var(--color-copper)] text-white ${isDirty ? "animate-[glow-pulse_2s_ease-in-out_infinite]" : ""}`}
                    radius="full"
                    isLoading={saving}
                    onPress={() => void saveSongFields()}
                  >
                    <Save className="h-4 w-4" />
                    Save song
                  </Button>
                </div>
              </div>


            </div>

            <div className="panel glass-shine rounded-[1.75rem] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldGroup label="Title">
                  <input
                    className="field"
                    value={selectedSong.song.title}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { title: event.target.value }))}
                    placeholder="Song title"
                  />
                </FieldGroup>
                <FieldGroup label="Genre">
                  <input
                    className="field"
                    value={selectedSong.song.genre ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { genre: event.target.value }))}
                    placeholder="Pop, Rock, Cumbia..."
                  />
                </FieldGroup>
                <FieldGroup label="Language">
                  <input
                    className="field"
                    value={selectedSong.song.language ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { language: event.target.value }))}
                    placeholder="Spanish, English..."
                  />
                </FieldGroup>
                <FieldGroup label="Emotion / mood">
                  <input
                    className="field"
                    value={selectedSong.song.emotion ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { emotion: event.target.value }))}
                    placeholder="Nostalgic, energetic..."
                  />
                </FieldGroup>
                <FieldGroup label="BPM">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Decrease BPM"
                      className="glass-pill flex h-8 w-8 items-center justify-center"
                      onClick={() => setSelectedSong((current) => patchSong(current, { bpm: Math.max(40, (current?.song.bpm ?? 120) - 1) }))}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      className="field text-center"
                      value={String(selectedSong.song.bpm ?? "")}
                      onChange={(event) => setSelectedSong((current) => patchSong(current, { bpm: Number(event.target.value) || null }))}
                      placeholder="120"
                      type="number"
                      min={40}
                      max={240}
                    />
                    <button
                      type="button"
                      aria-label="Increase BPM"
                      className="glass-pill flex h-8 w-8 items-center justify-center"
                      onClick={() => setSelectedSong((current) => patchSong(current, { bpm: Math.min(240, (current?.song.bpm ?? 120) + 1) }))}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </FieldGroup>
                <FieldGroup label="Musical key">
                  <select
                    className="field"
                    value={selectedSong.song.musical_key ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { musical_key: event.target.value || null }))}
                  >
                    <option value="">—</option>
                    {KEY_OPTIONS.map((key) => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                </FieldGroup>
                <FieldGroup label="Topic" className="md:col-span-2">
                  <input
                    className="field"
                    value={selectedSong.song.topic ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { topic: event.target.value }))}
                    placeholder="What is this song about?"
                  />
                </FieldGroup>
                <FieldGroup label="Hook summary" className="md:col-span-2">
                  <textarea
                    className="field min-h-24"
                    value={selectedSong.song.hook_summary ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { hook_summary: event.target.value }))}
                    placeholder="One-line hook or chorus idea"
                  />
                </FieldGroup>
                <FieldGroup label="Vocal style">
                  <input
                    className="field"
                    value={selectedSong.song.vocal_style ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { vocal_style: event.target.value }))}
                    placeholder="Breathy, belted, rap..."
                  />
                </FieldGroup>
                <FieldGroup label="Instrumentation">
                  <input
                    className="field"
                    value={selectedSong.song.instrumentation ?? ""}
                    onChange={(event) => setSelectedSong((current) => patchSong(current, { instrumentation: event.target.value }))}
                    placeholder="Acoustic guitar, synth pads..."
                  />
                </FieldGroup>
              </div>
            </div>
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-8 text-center">
            <Music2 className="mx-auto h-10 w-10 text-[var(--color-brass)] opacity-60" />
            <p className="mt-4 text-sm text-[var(--color-sand-2)]">No songs in your library yet.</p>
            <Button className="mt-4 bg-[var(--color-copper)] text-white" radius="full" onPress={() => void createDraftSong()}>
              <Plus className="h-4 w-4" />
              Create first song
            </Button>
          </div>
        )}
      </section>

      <Modal isOpen={deleteOpen} onOpenChange={onDeleteOpenChange} placement="center" {...opaqueModalProps}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Delete song</ModalHeader>
              <ModalBody>
                <p className="text-sm text-[var(--color-sand-2)]">
                  Permanently delete <strong className="text-[var(--color-foreground)]">{deleteTarget?.title}</strong>?
                  Sections, layers, and partitures linked to this song will also be removed.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>Cancel</Button>
                <Button color="danger" onPress={() => void removeSong()}>Delete song</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
