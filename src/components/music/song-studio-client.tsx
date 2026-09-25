"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  Button,
  Chip,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import {
  CheckCircle2,
  ChevronUp,
  Disc3,
  Guitar,
  Layers3,
  Layout,
  Mic2,
  Minus,
  Music2,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import { useProductionSong } from "@/components/music/production-song-context";
// import { PromptRunnerPanel } from "@/components/music/prompt-runner-panel"; // Kept for reuse later
import {
  createPartiture,
  createSong,
  deletePartiture,
  deleteSong,
  deleteSongPart,
  fetchPartitures,
  fetchSongDetail,
  fetchSongs,
  fetchTemplates,
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

type EditorTab = "overview" | "lyrics" | "sections";
type PartKind = "section" | "layer";

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

function emptyPart() {
  return { name: "", text: "", json: "{}" };
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

// JsonField function - Kept for reuse later
// function JsonField({
//   label,
//   value,
//   onChange,
// }: {
//   label: string;
//   value: string;
//   onChange: (next: string) => void;
// }) {
//   const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

//   return (
//     <div>
//       <div className="mb-1 flex items-center justify-between gap-2">
//         <span className="field-label">{label}</span>
//         <div className="flex gap-1">
//           <Button size="sm" variant="flat" radius="full" onPress={() => {
//             const result = validateJson(value);
//             setStatus(result.ok ? "ok" : "error");
//             toast[result.ok ? "success" : "error"](result.ok ? `${label} is valid JSON` : `${label}: ${result.error}`);
//           }}>
//             <CheckCircle2 className="h-3 w-3" />
//             Validate
//           </Button>
//           <Button size="sm" variant="flat" radius="full" onPress={() => {
//             try {
//               onChange(formatJson(value));
//               setStatus("ok");
//               toast.success(`${label} formatted`);
//             } catch (error) {
//               setStatus("error");
//               toast.error((error as Error).message);
//             }
//           }}>
//             <Wand2 className="h-3 w-3" />
//             Format
//           </Button>
//         </div>
//       </div>
//       <textarea
//         className={`field min-h-52 font-mono text-xs ${status === "error" ? "!border-red-500/60" : ""}`}
//         value={value}
//         onChange={(event) => onChange(event.target.value)}
//         spellCheck={false}
//       />
//     </div>
//   );
// }

export function SongStudioClient() {
  const { selectedSongId: hubSongId, setSelectedSongId: setHubSongId, refreshSongs } = useProductionSong();

  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editorTab, setEditorTab] = useState<EditorTab>("overview");
  const [newSection, setNewSection] = useState(emptyPart());
  const [newLayer, setNewLayer] = useState(emptyPart());
  const [partitures, setPartitures] = useState<EditablePartiture[]>([]);
  const [addInstrument, setAddInstrument] = useState<PartitureInstrumentId>("guitar");
  // const [promptTemplates, setPromptTemplates] = useState<MusicTaskTemplateRecord[]>([]); // Kept for reuse later
  // const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState(""); // Kept for reuse later
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const bootedRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLength, setHistoryLength] = useState(0);
  const sectionOriginalNamesRef = useRef<string[]>([]);
  const layerOriginalNamesRef = useRef<string[]>([]);
  const skipConfirmRef = useRef(false);
  const { isOpen: deleteOpen, onOpen: openDelete, onOpenChange: onDeleteOpenChange, onClose: closeDelete } = useDisclosure();

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter((song) =>
      [song.title, song.genre, song.language, song.emotion, song.topic]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [search, songs]);

  const isDirty = useMemo(() => {
    if (!selectedSong) return false;
    return JSON.stringify(selectedSong) !== savedSnapshot;
  }, [savedSnapshot, selectedSong]);

  // const activePromptTemplate = useMemo(
  //   () => promptTemplates.find((template) => template.id === selectedPromptTemplateId) || null,
  //   [promptTemplates, selectedPromptTemplateId],
  // ); // Kept for reuse later

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
      layerOriginalNamesRef.current = payload.song.layers.map((layer) => layer.name);
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

  async function persistPart(kind: PartKind, part: { name: string; text: string | null; json: string }, originalName?: string) {
    if (!selectedSong) return;
    pushHistory();
    const previousName = originalName && originalName !== part.name ? originalName : null;
    try {
      let result: { song: MusicSongDetail };
      if (previousName) {
        await deleteSongPart(selectedSong.song.id, { kind, name: previousName });
        result = await saveSongPart(selectedSong.song.id, {
          kind,
          name: part.name,
          text: part.text,
          json: part.json,
        });
      } else {
        result = await saveSongPart(selectedSong.song.id, {
          kind,
          name: part.name,
          text: part.text,
          json: part.json,
        });
      }
      setSelectedSong(result.song);
      setSavedSnapshot(JSON.stringify(result.song));
      if (kind === "section") {
        sectionOriginalNamesRef.current = result.song.sections.map((section) => section.name);
      } else {
        layerOriginalNamesRef.current = result.song.layers.map((layer) => layer.name);
      }
      toast.success(`${kind} saved`);
      await refreshSongs();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removePart(kind: PartKind, name: string) {
    if (!selectedSong) return;
    pushHistory();
    try {
      const payload = await deleteSongPart(selectedSong.song.id, { kind, name });
      setSelectedSong(payload.song);
      setSavedSnapshot(JSON.stringify(payload.song));
      toast.success(`${kind} deleted`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const editorTabs: Array<{ id: EditorTab; label: string; icon: typeof Music2 }> = [
    { id: "overview", label: "Overview", icon: Music2 },
    { id: "lyrics", label: "Lyrics", icon: Type },
    { id: "sections", label: "Sections", icon: Layers3 },
  ];

  return (
    <div className="page-grid animate-fade-up">
      <aside className="panel glass-shine rounded-[1.75rem] p-4">
        <div className="space-y-4">
          <div>
            <div className="eyebrow">Library</div>
            <h2 className="mt-2 text-2xl font-black">Songs</h2>
            <p className="mt-1 text-xs text-[var(--color-sand-2)]">{songs.length} in workspace</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-sand-2)]" />
            <input
              className="field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadLibrary();
              }}
              placeholder="Search title, genre, mood..."
            />
          </div>

          <div className="flex gap-2">
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={() => void loadLibrary()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="bordered" radius="full" onPress={() => void createDraftSong()}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>

          <div className="max-h-[68vh] space-y-2 overflow-auto pr-1 stagger-children">
            {filteredSongs.map((song) => (
              <div
                key={song.id}
                className={`song-list-item group flex items-start gap-2 rounded-[1.25rem] px-3 py-3 ${
                  selectedSongId === song.id ? "song-list-item-active" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void selectSong(song.id)}
                  type="button"
                >
                  <div className="truncate text-sm font-black text-[var(--color-sand-1)]">{song.title}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {song.genre ? <Chip size="sm" variant="flat">{song.genre}</Chip> : null}
                    {song.bpm ? <Chip size="sm" variant="flat">{song.bpm} BPM</Chip> : null}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-sand-2)]">
                    {song.section_count} sections · {song.layer_count} layers
                  </div>
                </button>
                <button
                  aria-label={`Delete ${song.title}`}
                  className="glass-pill mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-[var(--color-sand-2)] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  onClick={() => confirmDeleteSong(song)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {filteredSongs.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6 text-center text-sm text-[var(--color-sand-2)]">
                No songs match your search.
              </div>
            ) : null}
          </div>
        </div>
      </aside>

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

              <div className="mt-3 flex flex-wrap gap-1.5">
                {editorTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`tab-editor-pill inline-flex items-center gap-2 ${editorTab === tab.id ? "tab-editor-pill-active" : ""}`}
                      onClick={() => setEditorTab(tab.id)}
                      type="button"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={editorTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="panel glass-shine rounded-[1.75rem] p-5"
              >
                {editorTab === "overview" ? (
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
                ) : null}

                {editorTab === "lyrics" ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FieldGroup label="Lyrics">
                      <textarea
                        className="field min-h-80 font-mono text-sm leading-6"
                        value={selectedSong.song.lyrics_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { lyrics_text: event.target.value }))}
                        placeholder="Write or paste lyrics here..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Structure notes">
                      <textarea
                        className="field min-h-80"
                        value={selectedSong.song.structure_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { structure_text: event.target.value }))}
                        placeholder="Intro → Verse → Chorus → Bridge..."
                      />
                    </FieldGroup>
                    <FieldGroup label="Reference text" className="lg:col-span-2">
                      <textarea
                        className="field min-h-32"
                        value={selectedSong.song.reference_text ?? ""}
                        onChange={(event) => setSelectedSong((current) => patchSong(current, { reference_text: event.target.value }))}
                        placeholder="Reference track notes, inspiration..."
                      />
                    </FieldGroup>
                  </div>
                ) : null}

                {editorTab === "sections" ? (
                  <div className="grid gap-6 xl:grid-cols-2">
                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Disc3 className="h-4 w-4 text-[var(--color-brass)]" />
                        <h3 className="text-xl font-black">Sections</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSong.sections.map((section, sectionIdx) => (
                          <div key={section.name} className="glass-card-soft rounded-[1.25rem] p-4">
                            <FieldGroup label="Section name">
                              <input
                                className="field"
                                value={section.name}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  sections: current.sections.map((item) => item.name === section.name ? { ...item, name: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <FieldGroup label="Notes" className="mt-3">
                              <textarea
                                className="field min-h-24"
                                value={section.text ?? ""}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  sections: current.sections.map((item) => item.name === section.name ? { ...item, text: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <div className="mt-3 flex gap-2">
                              <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("section", section, sectionOriginalNamesRef.current[sectionIdx])}>Save</Button>
                              <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("section", section.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                          <div className="mb-3 text-sm font-semibold">Add section</div>
                          <input className="field mb-3" value={newSection.name} onChange={(event) => setNewSection((current) => ({ ...current, name: event.target.value }))} placeholder="verse_1" />
                          <textarea className="field mb-3 min-h-20" value={newSection.text} onChange={(event) => setNewSection((current) => ({ ...current, text: event.target.value }))} placeholder="Section notes" />
                          <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                            await persistPart("section", newSection);
                            setNewSection(emptyPart());
                          }}>
                            <Plus className="h-4 w-4" />
                            Add section
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-4 flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-[var(--color-brass)]" />
                        <h3 className="text-xl font-black">Layers</h3>
                      </div>
                      <div className="space-y-3">
                        {selectedSong.layers.map((layer, layerIdx) => (
                          <div key={layer.name} className="glass-card-soft rounded-[1.25rem] p-4">
                            <FieldGroup label="Layer name">
                              <input
                                className="field"
                                value={layer.name}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  layers: current.layers.map((item) => item.name === layer.name ? { ...item, name: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <FieldGroup label="Notes" className="mt-3">
                              <textarea
                                className="field min-h-24"
                                value={layer.text ?? ""}
                                onChange={(event) => setSelectedSong((current) => current ? {
                                  ...current,
                                  layers: current.layers.map((item) => item.name === layer.name ? { ...item, text: event.target.value } : item),
                                } : current)}
                              />
                            </FieldGroup>
                            <div className="mt-3 flex gap-2">
                              <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("layer", layer, layerOriginalNamesRef.current[layerIdx])}>Save</Button>
                              <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("layer", layer.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                          <div className="mb-3 text-sm font-semibold">Add layer</div>
                          <input className="field mb-3" value={newLayer.name} onChange={(event) => setNewLayer((current) => ({ ...current, name: event.target.value }))} placeholder="drums" />
                          <textarea className="field mb-3 min-h-20" value={newLayer.text} onChange={(event) => setNewLayer((current) => ({ ...current, text: event.target.value }))} placeholder="Layer notes" />
                          <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                            await persistPart("layer", newLayer);
                            setNewLayer(emptyPart());
                          }}>
                            <Plus className="h-4 w-4" />
                            Add layer
                          </Button>
                        </div>
                      </div>

                      {/* Partitures Section */}
                      <div className="mt-8 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
                          <div className="flex items-center gap-3">
                            <Layout className="h-5 w-5 text-[var(--color-berry)]" />
                            <div>
                              <h3 className="text-2xl font-black uppercase italic tracking-tighter">Partitures</h3>
                              <p className="text-xs text-[var(--color-sand-2)]">
                                {partitures.length === 0
                                  ? "No partitures yet — add guitar, bass, drums, or keys."
                                  : `${partitures.length} saved slot${partitures.length === 1 ? "" : "s"}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={addInstrument}
                              onChange={(event) => setAddInstrument(event.target.value as PartitureInstrumentId)}
                              className="field w-auto min-w-[140px] py-2 text-xs font-bold"
                            >
                              {PARTITURE_INSTRUMENTS.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                              ))}
                            </select>
                            <Button
                              radius="full"
                              className="bg-[var(--color-copper)] text-white"
                              startContent={<Plus className="h-4 w-4" />}
                              onPress={addPartitureRow}
                            >
                              Add partiture
                            </Button>
                          </div>
                        </div>

                        {partitures.length === 0 ? (
                          <div className="panel rounded-3xl border border-dashed border-[var(--color-border)] p-10 text-center">
                            <Music2 className="mx-auto h-8 w-8 text-[var(--color-sand-2)]" />
                            <p className="mt-3 text-sm text-[var(--color-sand-2)]">
                              Start with zero partitures. Add guitar, bass, drums, keys, or vocals when you need them.
                            </p>
                          </div>
                        ) : (
                          <div className="grid gap-4 xl:grid-cols-2">
                            {partitures.map((slotRecord) => {
                              const key = partitureKey(slotRecord.instrument, slotRecord.slot);
                              const Icon = INSTRUMENT_ICONS[slotRecord.instrument] || Disc3;
                              return (
                                <div
                                  key={key}
                                  className="panel group relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 p-5 backdrop-blur-sm"
                                >
                                  <div className="absolute right-0 top-0 p-4 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => void removePartiture(slotRecord)}
                                      className="rounded-xl bg-red-500/10 p-2 text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                      aria-label="Delete partiture"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="mb-4 flex items-center gap-4">
                                    <div className="rounded-2xl bg-[var(--color-brass)]/10 p-3 text-[var(--color-brass)]">
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <div className="eyebrow text-[10px] opacity-40">
                                        {partitureInstrumentLabel(slotRecord.instrument)} · slot {slotRecord.slot}
                                      </div>
                                      <h4 className="text-lg font-black tracking-tight">{slotRecord.title}</h4>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <FieldGroup label="Title">
                                      <input
                                        className="field py-2 text-xs font-bold"
                                        value={slotRecord.title}
                                        onChange={(e) => updatePartitureField(key, { title: e.target.value })}
                                      />
                                    </FieldGroup>
                                    <FieldGroup label="Format">
                                      <select
                                        className="field py-2 text-xs font-bold"
                                        value={slotRecord.format}
                                        onChange={(e) => updatePartitureField(key, { format: e.target.value })}
                                      >
                                        {PARTITURE_FORMATS.map((format) => (
                                          <option key={format} value={format}>{format}</option>
                                        ))}
                                      </select>
                                    </FieldGroup>
                                    <FieldGroup label="Content">
                                      {slotRecord.format === "grid" ? (
                                        <div className="space-y-3">
                                          <DrumGridEditor
                                            content={slotRecord.content}
                                            onChange={(next) => updatePartitureField(key, { content: next })}
                                          />
                                          <textarea
                                            className="field min-h-20 font-mono text-sm leading-loose"
                                            value={slotRecord.content}
                                            onChange={(e) => updatePartitureField(key, { content: e.target.value })}
                                            placeholder="Raw drum grid text..."
                                          />
                                        </div>
                                      ) : (
                                        <textarea
                                          className="field min-h-56 font-mono text-sm leading-loose"
                                          value={slotRecord.content}
                                          onChange={(e) => updatePartitureField(key, { content: e.target.value })}
                                          placeholder={
                                            slotRecord.instrument === "drums"
                                              ? "Kick · Snare · Hi-hat grid..."
                                              : "Tab, notation, or chart content..."
                                          }
                                        />
                                      )}
                                    </FieldGroup>
                                    <Button
                                      radius="full"
                                      className={slotRecord.id ? "" : "bg-[var(--color-copper)] text-white"}
                                      variant={slotRecord.id ? "bordered" : "solid"}
                                      startContent={<Save className="h-4 w-4" />}
                                      onPress={() => void persistPartiture(slotRecord)}
                                    >
                                      {slotRecord.id ? "Update partiture" : "Save to database"}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>

            {/* AI Prompts section - Kept for reuse later
            {promptTemplates.length > 0 && activePromptTemplate ? (
              <details className="panel glass-shine animate-fade-up rounded-[1.25rem] group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2">
                    <span className="eyebrow">AI prompts</span>
                    <span className="text-xs text-[var(--color-sand-2)]">Enhance this song with Ollama</span>
                  </span>
                  <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-sand-2)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-[var(--color-stroke)] px-4 pb-4 pt-3">
                  <select
                    className="field"
                    value={selectedPromptTemplateId}
                    onChange={(event) => setSelectedPromptTemplateId(event.target.value)}
                  >
                    {promptTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <PromptRunnerPanel
                    templateId={activePromptTemplate.id}
                    templateName={activePromptTemplate.name}
                    targetLabel={activePromptTemplate.targetField || "song field"}
                    defaultSongId={selectedSongId}
                    onApplied={() => void selectSong(selectedSongId)}
                  />
                </div>
              </details>
            ) : null
            */}
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
