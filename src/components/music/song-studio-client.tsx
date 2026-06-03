"use client";

import { useEffect, useState } from "react";

import { Button, Chip, Spinner } from "@heroui/react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { fetchSongDetail, fetchSongs, saveSongPart, updateSong, deleteSongPart, createSong } from "@/lib/music/client";
import type { MusicSongDetail, MusicSongSummary } from "@/lib/music/types";

function emptyPart() {
  return { name: "", text: "", json: "{}" };
}

export function SongStudioClient() {
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newSection, setNewSection] = useState(emptyPart());
  const [newLayer, setNewLayer] = useState(emptyPart());

  async function loadLibrary(nextSelectedId?: string, showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const payload = await fetchSongs(search);
      setSongs(payload.songs);
      const preferredId = nextSelectedId || selectedSongId || payload.songs[0]?.id || "";
      if (preferredId) {
        const detail = await fetchSongDetail(preferredId);
        setSelectedSong(detail.song);
        setSelectedSongId(preferredId);
      } else {
        setSelectedSong(null);
        setSelectedSongId("");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const payload = await fetchSongs();
        if (cancelled) {
          return;
        }

        setSongs(payload.songs);
        const preferredId = payload.songs[0]?.id || "";
        if (!preferredId) {
          setSelectedSong(null);
          setSelectedSongId("");
          return;
        }

        const detail = await fetchSongDetail(preferredId);
        if (cancelled) {
          return;
        }

        setSelectedSong(detail.song);
        setSelectedSongId(preferredId);
      } catch (error) {
        if (!cancelled) {
          toast.error((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  async function selectSong(songId: string) {
    setLoading(true);
    try {
      const payload = await fetchSongDetail(songId);
      setSelectedSong(payload.song);
      setSelectedSongId(songId);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSongFields() {
    if (!selectedSong) {
      return;
    }

    try {
      const payload = await updateSong(selectedSong.song.id, selectedSong.song as unknown as Record<string, unknown>);
      setSelectedSong(payload.song);
      toast.success("Song saved");
      await loadLibrary(selectedSong.song.id);
    } catch (error) {
      toast.error((error as Error).message);
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

  async function persistPart(kind: "section" | "layer", part: { name: string; text: string | null; json: string }) {
    if (!selectedSong) {
      return;
    }

    try {
      const payload = await saveSongPart(selectedSong.song.id, {
        kind,
        name: part.name,
        text: part.text,
        json: part.json,
      });
      setSelectedSong(payload.song);
      toast.success(`${kind} saved`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removePart(kind: "section" | "layer", name: string) {
    if (!selectedSong) {
      return;
    }

    try {
      const payload = await deleteSongPart(selectedSong.song.id, { kind, name });
      setSelectedSong(payload.song);
      toast.success(`${kind} deleted`);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="page-grid">
      <aside className="panel rounded-[1.75rem] p-4">
        <div className="space-y-4">
          <div>
            <div className="eyebrow">Library</div>
            <h2 className="mt-2 text-2xl font-black">Songs</h2>
          </div>
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, genre, language" />
          <div className="flex gap-2">
            <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={() => void loadLibrary()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="bordered" radius="full" onPress={createDraftSong}>
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {songs.map((song) => (
              <button
                key={song.id}
                className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${selectedSongId === song.id ? "border-[var(--color-copper)] bg-white/8" : "border-white/8 bg-white/3 hover:border-white/15"}`}
                onClick={() => void selectSong(song.id)}
                type="button"
              >
                <div className="text-sm font-black text-[var(--color-sand-1)]">{song.title}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {song.genre ? <Chip size="sm" variant="flat">{song.genre}</Chip> : null}
                  {song.language ? <Chip size="sm" variant="flat">{song.language}</Chip> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="space-y-6">
        {loading ? (
          <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6">
            <Spinner color="warning" />
          </div>
        ) : selectedSong ? (
          <>
            <div className="panel rounded-[1.75rem] p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="eyebrow">Song detail</div>
                  <h2 className="mt-2 text-3xl font-black">{selectedSong.song.title}</h2>
                </div>
                <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={saveSongFields}>
                  <Save className="h-4 w-4" />
                  Save song
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input className="field" value={selectedSong.song.title} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, title: event.target.value } } : current)} placeholder="Title" />
                <input className="field" value={selectedSong.song.genre ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, genre: event.target.value } } : current)} placeholder="Genre" />
                <input className="field" value={selectedSong.song.language ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, language: event.target.value } } : current)} placeholder="Language" />
                <input className="field" value={selectedSong.song.emotion ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, emotion: event.target.value } } : current)} placeholder="Emotion" />
                <input className="field" value={String(selectedSong.song.bpm ?? "")} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, bpm: Number(event.target.value) || null } } : current)} placeholder="BPM" type="number" />
                <input className="field" value={selectedSong.song.musical_key ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, musical_key: event.target.value } } : current)} placeholder="Musical key" />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <textarea className="field min-h-52" value={selectedSong.song.lyrics_text ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, lyrics_text: event.target.value } } : current)} placeholder="Lyrics" />
                <textarea className="field min-h-52" value={selectedSong.song.structure_text ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, structure_text: event.target.value } } : current)} placeholder="Structure" />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <textarea className="field min-h-72 font-mono text-xs" value={selectedSong.song.song_json} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, song_json: event.target.value } } : current)} placeholder="song_json" />
                <textarea className="field min-h-72 font-mono text-xs" value={selectedSong.song.production_json ?? "{}"} onChange={(event) => setSelectedSong((current) => current ? { ...current, song: { ...current.song, production_json: event.target.value } } : current)} placeholder="production_json" />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="panel rounded-[1.75rem] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="eyebrow">Arrangement</div>
                    <h3 className="mt-2 text-2xl font-black">Sections</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedSong.sections.map((section) => (
                    <div key={section.name} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                      <input className="field mb-3" value={section.name} onChange={(event) => setSelectedSong((current) => current ? { ...current, sections: current.sections.map((item) => item.name === section.name ? { ...item, name: event.target.value } : item) } : current)} />
                      <textarea className="field mb-3 min-h-28" value={section.text ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, sections: current.sections.map((item) => item.name === section.name ? { ...item, text: event.target.value } : item) } : current)} />
                      <textarea className="field min-h-28 font-mono text-xs" value={section.json} onChange={(event) => setSelectedSong((current) => current ? { ...current, sections: current.sections.map((item) => item.name === section.name ? { ...item, json: event.target.value } : item) } : current)} />
                      <div className="mt-3 flex gap-2">
                        <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("section", section)}>Save</Button>
                        <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("section", section.name)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                    <div className="mb-3 text-sm font-semibold">Add section</div>
                    <input className="field mb-3" value={newSection.name} onChange={(event) => setNewSection((current) => ({ ...current, name: event.target.value }))} placeholder="verse_1" />
                    <textarea className="field mb-3 min-h-24" value={newSection.text} onChange={(event) => setNewSection((current) => ({ ...current, text: event.target.value }))} placeholder="Section notes" />
                    <textarea className="field min-h-24 font-mono text-xs" value={newSection.json} onChange={(event) => setNewSection((current) => ({ ...current, json: event.target.value }))} placeholder="{}" />
                    <Button className="mt-3 bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                      await persistPart("section", newSection);
                      setNewSection(emptyPart());
                    }}>
                      <Plus className="h-4 w-4" />
                      Add section
                    </Button>
                  </div>
                </div>
              </div>

              <div className="panel rounded-[1.75rem] p-5">
                <div>
                  <div className="eyebrow">Production</div>
                  <h3 className="mt-2 text-2xl font-black">Layers</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {selectedSong.layers.map((layer) => (
                    <div key={layer.name} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                      <input className="field mb-3" value={layer.name} onChange={(event) => setSelectedSong((current) => current ? { ...current, layers: current.layers.map((item) => item.name === layer.name ? { ...item, name: event.target.value } : item) } : current)} />
                      <textarea className="field mb-3 min-h-28" value={layer.text ?? ""} onChange={(event) => setSelectedSong((current) => current ? { ...current, layers: current.layers.map((item) => item.name === layer.name ? { ...item, text: event.target.value } : item) } : current)} />
                      <textarea className="field min-h-28 font-mono text-xs" value={layer.json} onChange={(event) => setSelectedSong((current) => current ? { ...current, layers: current.layers.map((item) => item.name === layer.name ? { ...item, json: event.target.value } : item) } : current)} />
                      <div className="mt-3 flex gap-2">
                        <Button radius="full" className="bg-[var(--color-copper)] text-white" onPress={() => void persistPart("layer", layer)}>Save</Button>
                        <Button radius="full" variant="bordered" color="danger" onPress={() => void removePart("layer", layer.name)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[1.25rem] border border-dashed border-white/12 p-4">
                    <div className="mb-3 text-sm font-semibold">Add layer</div>
                    <input className="field mb-3" value={newLayer.name} onChange={(event) => setNewLayer((current) => ({ ...current, name: event.target.value }))} placeholder="drums" />
                    <textarea className="field mb-3 min-h-24" value={newLayer.text} onChange={(event) => setNewLayer((current) => ({ ...current, text: event.target.value }))} placeholder="Layer notes" />
                    <textarea className="field min-h-24 font-mono text-xs" value={newLayer.json} onChange={(event) => setNewLayer((current) => ({ ...current, json: event.target.value }))} placeholder="{}" />
                    <Button className="mt-3 bg-[var(--color-copper)] text-white" radius="full" onPress={async () => {
                      await persistPart("layer", newLayer);
                      setNewLayer(emptyPart());
                    }}>
                      <Plus className="h-4 w-4" />
                      Add layer
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-6 text-sm text-[var(--color-sand-2)]">No songs found in the connected database yet.</div>
        )}
      </section>
    </div>
  );
}