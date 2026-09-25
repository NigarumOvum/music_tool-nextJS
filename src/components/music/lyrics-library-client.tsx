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
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useProductionSong } from "@/components/music/production-song-context";
import {
  createSong,
  deleteSong,
  fetchSongDetail,
  fetchSongs,
  saveSongPart,
  updateSong,
} from "@/lib/music/client";
import type { MusicSongDetail, MusicSongSummary } from "@/lib/music/types";
import { opaqueModalProps } from "@/lib/ui/modal-styles";

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
  const [loading, setLoading] = useState(true);
  const [savingLyrics, setSavingLyrics] = useState(false);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
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
      const songPayload = await fetchSongDetail(songId);
      setSelectedSong(songPayload.song);
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

  // persistSectionText function - Kept for reuse later (Song Sections moved to Song Studio)
  // async function persistSectionText(index: number, text: string) {
  //   if (!selectedSong) return;
  //   const section = selectedSong.sections[index];
  //   if (!section) return;
  //   try {
  //     const payload = await saveSongPart(selectedSong.song.id, {
  //       kind: "section",
  //       name: section.name,
  //       text,
  //       json: section.json,
  //     });
  //     setSelectedSong(payload.song);
  //     savedSnapshotRef.current = snapshotLyrics(payload.song);
  //     setDirty(false);
  //     toast.success(`Section "${section.name}" saved`);
  //   } catch (error) {
  //     toast.error((error as Error).message);
  //   }
  // }

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

            {/* Song sections moved to Song Studio - Sections tab */}
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
                  Lyrics and structure will be removed.
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
