"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Book,
  CopyPlus,
  Eraser,
  Guitar,
  Layout,
  ListMusic,
  Mic2,
  Music2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useProductionSong } from "@/components/music/production-song-context";
import {
  createPartiture,
  createSong,
  deletePartiture,
  deleteSong,
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
import type { MusicSongDetail, MusicSongSummary } from "@/lib/music/types";
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
  other: Book,
};

const PARTITURE_FORMATS = ["text-tab", "grid", "lyrics", "notation"] as const;

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

function lyricsStats(text: string) {
  const lines = text.split("\n").filter((line) => line.trim()).length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const syllables = (text.toLowerCase().match(/[aeiouáéíóúü]+/g) || []).length;
  const estSeconds = words > 0 ? Math.max(5, Math.round(syllables / 3.2)) : 0;
  return { lines, words, syllables, estSeconds };
}

export function LyricsLibraryClient() {
  const { selectedSongId: hubSongId, setSelectedSongId: setHubSongId } = useProductionSong();
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [partitures, setPartitures] = useState<EditablePartiture[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [addInstrument, setAddInstrument] = useState<PartitureInstrumentId>("guitar");
  const [dirty, setDirty] = useState(false);
  const savedSnapshotRef = useRef("");

  const { isOpen: deleteOpen, onOpenChange: onDeleteOpenChange, onOpen: openDelete, onClose: closeDelete } = useDisclosure();

  const filteredSongs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const genreQuery = genre.trim().toLowerCase();
    const languageQuery = language.trim().toLowerCase();
    return songs.filter((song) => {
      if (query && !song.title.toLowerCase().includes(query)) return false;
      if (genreQuery && !(song.genre || "").toLowerCase().includes(genreQuery)) return false;
      if (languageQuery && !(song.language || "").toLowerCase().includes(languageQuery)) return false;
      return true;
    });
  }, [songs, search, genre, language]);

  const genres = useMemo(
    () => Array.from(new Set(songs.map((s) => s.genre).filter((g): g is string => Boolean(g)))).sort(),
    [songs],
  );
  const languages = useMemo(
    () => Array.from(new Set(songs.map((s) => s.language).filter((l): l is string => Boolean(l)))).sort(),
    [songs],
  );

  const stats = useMemo(() => lyricsStats(selectedSong?.song.lyrics_text ?? ""), [selectedSong]);

  function snapshotLyrics(song: MusicSongDetail) {
    return JSON.stringify({
      lyrics: song.song.lyrics_text ?? "",
      structure: song.song.structure_text ?? "",
    });
  }

  async function loadSong(songId: string, syncHub = true) {
    if (dirty && songId !== selectedSongId) {
      const proceed = window.confirm("You have unsaved changes. Discard them and switch songs?");
      if (!proceed) return;
    }
    setLoading(true);
    try {
      const [songPayload, partiturePayload] = await Promise.all([
        fetchSongDetail(songId),
        fetchPartitures(songId),
      ]);
      setSelectedSong(songPayload.song);
      setPartitures(
        partiturePayload.partitures.map((item) => ({
          id: item.id,
          instrument: item.instrument,
          slot: item.slot,
          title: item.title,
          content: item.content,
          format: item.format || "text-tab",
        })),
      );
      setSelectedSongId(songId);
      savedSnapshotRef.current = snapshotLyrics(songPayload.song);
      setDirty(false);
      if (syncHub && hubSongId !== songId) {
        setHubSongId(songId);
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const payload = await fetchSongs();
        setSongs(payload.songs);
        const initialId = hubSongId || payload.songs[0]?.id;
        if (initialId) {
          await loadSong(initialId, false);
        } else {
          setLoading(false);
        }
      } catch (error) {
        toast.error((error as Error).message);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hubSongId || hubSongId === selectedSongId) return;
    void loadSong(hubSongId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubSongId]);

  useEffect(() => {
    if (!selectedSong) {
      setDirty(false);
      return;
    }
    setDirty(snapshotLyrics(selectedSong) !== savedSnapshotRef.current);
  }, [selectedSong]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function persistSectionText(index: number, text: string) {
    if (!selectedSong) return;
    const section = selectedSong.sections[index];
    if (!section) return;
    try {
      const payload = await saveSongPart(selectedSong.song.id, {
        kind: "section",
        name: section.name,
        text,
        json: section.json,
      });
      setSelectedSong(payload.song);
      savedSnapshotRef.current = snapshotLyrics(payload.song);
      setDirty(false);
      toast.success(`Section "${section.name}" saved`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function duplicateSong() {
    if (!selectedSong) return;
    try {
      const source = selectedSong;
      const payload = await createSong({
        title: `${source.song.title} (copy)`,
        topic: source.song.topic,
        emotion: source.song.emotion,
        genre: source.song.genre,
        language: source.song.language,
        reference_text: source.song.reference_text,
        lyrics_text: source.song.lyrics_text,
        song_json: source.song.song_json,
        melody_json: source.song.melody_json,
        midi_blueprints_json: source.song.midi_blueprints_json,
        production_json: source.song.production_json,
        metadata_json: source.song.metadata_json,
        bpm: source.song.bpm,
        musical_key: source.song.musical_key,
        structure_text: source.song.structure_text,
        hook_summary: source.song.hook_summary,
        vocal_style: source.song.vocal_style,
        instrumentation: source.song.instrumentation,
        mood_tags_json: source.song.mood_tags_json,
        sections: source.sections.map((item) => ({ name: item.name, text: item.text, json: item.json })),
        layers: source.layers.map((item) => ({ name: item.name, text: item.text, json: item.json })),
      });
      toast.success("Song duplicated");
      const listPayload = await fetchSongs();
      setSongs(listPayload.songs);
      setHubSongId(payload.song.song.id);
      await loadSong(payload.song.song.id, false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function persistLyrics() {
    if (!selectedSong) return;
    setSavingLyrics(true);
    try {
      const payload = await updateSong(selectedSong.song.id, {
        lyrics_text: selectedSong.song.lyrics_text,
        structure_text: selectedSong.song.structure_text,
      });
      setSelectedSong(payload.song);
      savedSnapshotRef.current = snapshotLyrics(payload.song);
      setDirty(false);
      toast.success("Lyrics saved");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSavingLyrics(false);
    }
  }

  async function clearLyrics() {
    if (!selectedSong) return;
    setSelectedSong({
      ...selectedSong,
      song: { ...selectedSong.song, lyrics_text: "", structure_text: "" },
    });
  }

  async function removeSong() {
    if (!selectedSongId) return;
    try {
      await deleteSong(selectedSongId);
      toast.success("Song deleted");
      const payload = await fetchSongs();
      setSongs(payload.songs);
      const nextId = payload.songs.find((song) => song.id !== selectedSongId)?.id ?? "";
      if (nextId) {
        await loadSong(nextId);
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
        setPartitures([]);
        setHubSongId("");
      }
      closeDelete();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  function updateLyricsField(field: "lyrics_text" | "structure_text", value: string) {
    setSelectedSong((current) =>
      current ? { ...current, song: { ...current.song, [field]: value } } : current,
    );
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
        format: addInstrument === "drums" ? "grid" : addInstrument === "vocals" ? "lyrics" : "text-tab",
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
      await loadSong(selectedSongId, false);
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
        await loadSong(selectedSongId, false);
      } catch (error) {
        toast.error((error as Error).message);
      }
      return;
    }
    setPartitures((current) => current.filter((item) => partitureKey(item.instrument, item.slot) !== key));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel rounded-[1.75rem] p-4">
        <div className="eyebrow">Catalog</div>
        <div className="mt-3 space-y-2">
          <input
            className="field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title..."
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="field">
              <option value="">All genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="field">
              <option value="">All languages</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
          {filteredSongs.length} of {songs.length} songs
        </div>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-col xl:overflow-visible xl:pb-0">
          {filteredSongs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => void loadSong(song.id)}
              className={`min-w-[220px] rounded-2xl border px-4 py-4 text-left transition xl:w-full xl:min-w-0 ${
                song.id === selectedSongId
                  ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10"
                  : "glass-card-soft hover:-translate-y-0.5"
              }`}
            >
              <div className="font-bold text-[var(--color-foreground)]">{song.title}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                {song.genre || "N/A"}
              </div>
            </button>
          ))}
          {filteredSongs.length === 0 ? (
            <div className="py-4 text-sm text-[var(--color-sand-2)]">No songs match the filters.</div>
          ) : null}
        </div>
      </aside>

      <section className="space-y-6">
        {loading ? (
          <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6">
            <Spinner color="danger" />
          </div>
        ) : selectedSong ? (
          <>
            <div className="panel rounded-[2rem] border border-white/5 bg-zinc-900/10 p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Book className="h-5 w-5 text-[var(--color-brass)]" />
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter">{selectedSong.song.title}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
                      {selectedSong.song.genre || "No genre"} · {selectedSong.song.language || "No language"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {dirty ? (
                    <span className="rounded-full border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-berry)]">
                      Unsaved
                    </span>
                  ) : null}
                  <Button
                    radius="full"
                    variant="bordered"
                    startContent={<CopyPlus className="h-3.5 w-3.5" />}
                    onPress={() => void duplicateSong()}
                  >
                    Duplicate
                  </Button>
                  <Button
                    radius="full"
                    variant="bordered"
                    startContent={<Eraser className="h-3.5 w-3.5" />}
                    onPress={() => void clearLyrics()}
                  >
                    Clear
                  </Button>
                  <Button
                    radius="full"
                    color="danger"
                    variant="light"
                    startContent={<Trash2 className="h-3.5 w-3.5" />}
                    onPress={openDelete}
                  >
                    Delete song
                  </Button>
                  <Button
                    radius="full"
                    className="bg-[var(--color-copper)] text-white"
                    startContent={<Save className="h-3.5 w-3.5" />}
                    isLoading={savingLyrics}
                    onPress={() => void persistLyrics()}
                  >
                    Save lyrics
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <span className="glass-pill px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{stats.lines} lines</span>
                <span className="glass-pill px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{stats.words} words</span>
                <span className="glass-pill px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{stats.syllables} syllables</span>
                <span className="glass-pill px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                  ~{Math.floor(stats.estSeconds / 60)}:{String(stats.estSeconds % 60).padStart(2, "0")} est. duration
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <label className="field-group relative">
                  <span className="field-label">Lyrics</span>
                  <textarea
                    className="field min-h-72"
                    value={selectedSong.song.lyrics_text ?? ""}
                    onChange={(e) => updateLyricsField("lyrics_text", e.target.value)}
                    placeholder="Verse, chorus, bridge..."
                  />
                </label>
                <label className="field-group relative">
                  <span className="field-label">Structure</span>
                  <textarea
                    className="field min-h-72"
                    value={selectedSong.song.structure_text ?? ""}
                    onChange={(e) => updateLyricsField("structure_text", e.target.value)}
                    placeholder="Intro · Verse · Chorus · Bridge · Outro"
                  />
                </label>
              </div>
            </div>

            <div className="panel rounded-[2rem] border border-white/5 bg-zinc-900/10 p-6">
              <div className="mb-4 flex items-center gap-3">
                <ListMusic className="h-5 w-5 text-[var(--color-copper)]" />
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Song sections</h3>
                  <p className="text-xs text-[var(--color-sand-2)]">
                    Edit section notes in place. Each section saves independently to the song.
                  </p>
                </div>
              </div>
              {selectedSong.sections.length === 0 ? (
                <p className="text-sm text-[var(--color-sand-2)]">
                  No sections yet — add them in the Song tab (Arrangement) and they will appear here.
                </p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {selectedSong.sections.map((section, index) => (
                    <div key={section.name} className="glass-card-soft rounded-[1.25rem] p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-black uppercase tracking-wider text-[var(--color-brass)]">{section.name}</span>
                        <Button size="sm" radius="full" variant="bordered" onPress={() => void persistSectionText(index, section.text ?? "")}>
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </Button>
                      </div>
                      <textarea
                        className="field min-h-24 text-sm"
                        value={section.text ?? ""}
                        onChange={(event) => {
                          setSelectedSong((current) => current ? {
                            ...current,
                            sections: current.sections.map((item, itemIdx) => itemIdx === index ? { ...item, text: event.target.value } : item),
                          } : current);
                        }}
                        placeholder={`Notes for ${section.name}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
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
                    const Icon = INSTRUMENT_ICONS[slotRecord.instrument] || Book;
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
                          <label className="field-group">
                            <span className="field-label">Title</span>
                            <input
                              className="field py-2 text-xs font-bold"
                              value={slotRecord.title}
                              onChange={(e) => updatePartitureField(key, { title: e.target.value })}
                            />
                          </label>
                          <label className="field-group">
                            <span className="field-label">Format</span>
                            <select
                              className="field py-2 text-xs font-bold"
                              value={slotRecord.format}
                              onChange={(e) => updatePartitureField(key, { format: e.target.value })}
                            >
                              {PARTITURE_FORMATS.map((format) => (
                                <option key={format} value={format}>{format}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field-group">
                            <span className="field-label">Content</span>
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
                          </label>
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
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-6 text-sm text-[var(--color-sand-2)]">
            No songs selected. Create one in the Song tab.
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
                  Permanently delete <strong className="text-[var(--color-foreground)]">{selectedSong?.song.title}</strong>?
                  Lyrics, structure, and all partitures will be removed.
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
