"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Spinner } from "@heroui/react";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createPartiture, deletePartiture, fetchPartitures, fetchSongDetail, fetchSongs, updatePartiture } from "@/lib/music/client";
import type { MusicSongDetail, MusicSongSummary } from "@/lib/music/types";

type EditablePartiture = {
  id?: string;
  instrument: string;
  slot: number;
  title: string;
  content: string;
  format: string;
};

export function LyricsLibraryClient() {
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSong, setSelectedSong] = useState<MusicSongDetail | null>(null);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [partitures, setPartitures] = useState<EditablePartiture[]>([]);
  const [loading, setLoading] = useState(true);

  const guitarSlots = useMemo(() => {
    const bySlot = new Map<number, EditablePartiture>();
    partitures.forEach((partiture) => {
      if (partiture.instrument === "guitar") {
        bySlot.set(partiture.slot, partiture);
      }
    });

    return [1, 2].map((slot) => bySlot.get(slot) || {
      instrument: "guitar",
      slot,
      title: `Guitar ${slot}`,
      content: "",
      format: "text-tab",
    });
  }, [partitures]);

  async function loadSong(songId: string) {
    setLoading(true);
    try {
      const [songPayload, partiturePayload] = await Promise.all([
        fetchSongDetail(songId),
        fetchPartitures(songId),
      ]);
      setSelectedSong(songPayload.song);
      setPartitures(partiturePayload.partitures.map((item) => ({
        id: item.id,
        instrument: item.instrument,
        slot: item.slot,
        title: item.title,
        content: item.content,
        format: item.format || "text-tab",
      })));
      setSelectedSongId(songId);
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
        if (payload.songs[0]) {
          await loadSong(payload.songs[0].id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        toast.error((error as Error).message);
        setLoading(false);
      }
    })();
  }, []);

  async function persistPartiture(partiture: EditablePartiture) {
    if (!selectedSongId) {
      return;
    }

    try {
      if (partiture.id) {
        await updatePartiture(partiture.id, partiture);
      } else {
        await createPartiture(selectedSongId, partiture);
      }
      toast.success("Partiture saved");
      await loadSong(selectedSongId);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function removePartiture(partitureId?: string) {
    if (!partitureId || !selectedSongId) {
      return;
    }

    try {
      await deletePartiture(partitureId);
      toast.success("Partiture deleted");
      await loadSong(selectedSongId);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="page-grid">
      <aside className="panel rounded-[1.75rem] p-4">
        <div className="eyebrow">Songs</div>
        <div className="mt-4 space-y-2">
          {songs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => void loadSong(song.id)}
              className={`w-full rounded-[1.25rem] border px-4 py-4 text-left transition ${song.id === selectedSongId ? "border-[var(--color-berry)] bg-white/8" : "border-white/8 bg-white/3"}`}
            >
              <div className="font-bold text-[var(--color-sand-1)]">{song.title}</div>
              <div className="mt-1 text-xs text-[var(--color-sand-2)]">{song.genre || "No genre"}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        {loading ? (
          <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6"><Spinner color="danger" /></div>
        ) : selectedSong ? (
          <>
            <div className="panel rounded-[1.75rem] p-5">
              <div className="eyebrow">Lyrics focus</div>
              <h2 className="mt-2 text-3xl font-black">{selectedSong.song.title}</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <textarea className="field min-h-72" value={selectedSong.song.lyrics_text ?? ""} readOnly />
                <textarea className="field min-h-72" value={selectedSong.song.structure_text ?? ""} readOnly />
              </div>
            </div>

            <div className="panel rounded-[1.75rem] p-5">
              <div className="eyebrow">Partitures</div>
              <h3 className="mt-2 text-2xl font-black">Two guitar slots by default</h3>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--color-sand-2)]">
                Each song can store multiple partitures. The interface reserves two guitar-focused slots now, but the underlying table supports more instruments later.
              </p>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {guitarSlots.map((slotRecord) => (
                  <div key={`${slotRecord.instrument}-${slotRecord.slot}`} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="eyebrow">{slotRecord.instrument}</div>
                        <h4 className="mt-2 text-xl font-black">Slot {slotRecord.slot}</h4>
                      </div>
                      {slotRecord.id ? (
                        <Button radius="full" variant="bordered" color="danger" onPress={() => void removePartiture(slotRecord.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      ) : null}
                    </div>
                    <input
                      className="field mb-3"
                      value={slotRecord.title}
                      onChange={(event) => setPartitures((current) => {
                        const next = current.filter((item) => !(item.instrument === slotRecord.instrument && item.slot === slotRecord.slot));
                        return [...next, { ...slotRecord, title: event.target.value }];
                      })}
                    />
                    <input
                      className="field mb-3"
                      value={slotRecord.format}
                      onChange={(event) => setPartitures((current) => {
                        const next = current.filter((item) => !(item.instrument === slotRecord.instrument && item.slot === slotRecord.slot));
                        return [...next, { ...slotRecord, format: event.target.value }];
                      })}
                    />
                    <textarea
                      className="field min-h-72 font-mono text-sm"
                      value={slotRecord.content}
                      onChange={(event) => setPartitures((current) => {
                        const next = current.filter((item) => !(item.instrument === slotRecord.instrument && item.slot === slotRecord.slot));
                        return [...next, { ...slotRecord, content: event.target.value }];
                      })}
                      placeholder="Paste tab, notation, or score text here"
                    />
                    <Button className="mt-3 bg-[var(--color-berry)] text-white" radius="full" onPress={() => void persistPartiture(slotRecord)}>
                      <Save className="h-4 w-4" />
                      Save slot
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-6 text-sm text-[var(--color-sand-2)]">No songs available.</div>
        )}
      </section>
    </div>
  );
}