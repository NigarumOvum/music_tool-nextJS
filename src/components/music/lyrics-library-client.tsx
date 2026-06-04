"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { Save, Trash2, FileText, Pickaxe, Book, Layout } from "lucide-react";
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
    if (!selectedSongId) return;
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
    if (!partitureId || !selectedSongId) return;
    try {
      await deletePartiture(partitureId);
      toast.success("Partiture deleted");
      await loadSong(selectedSongId);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel rounded-[1.75rem] p-4">
        <div className="eyebrow">Catalog</div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-col xl:overflow-visible xl:pb-0">
          {songs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => void loadSong(song.id)}
              className={`min-w-[220px] rounded-2xl border px-4 py-4 text-left transition xl:w-full xl:min-w-0 ${song.id === selectedSongId ? "border-[var(--color-copper)] bg-[var(--color-copper)]/10" : "glass-card-soft hover:-translate-y-0.5"}`}
            >
              <div className="font-bold text-[var(--color-foreground)]">{song.title}</div>
              <div className="mt-1 text-[10px] uppercase font-bold tracking-widest text-[var(--color-sand-2)]">{song.genre || "N/A"}</div>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        {loading ? (
          <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6"><Spinner color="danger" /></div>
        ) : selectedSong ? (
          <>
            <div className="panel rounded-[2rem] p-6 border border-white/5 bg-zinc-900/10">
              <div className="flex items-center gap-3 mb-6">
                <Book className="h-5 w-5 text-[var(--color-brass)]" />
                <h2 className="text-3xl font-black tracking-tighter">{selectedSong.song.title}</h2>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="relative">
                   <span className="absolute left-3 top-3 eyebrow text-[8px] opacity-40">Lyrics</span>
                   <textarea className="field min-h-72 pt-8" value={selectedSong.song.lyrics_text ?? ""} readOnly />
                </div>
                <div className="relative">
                   <span className="absolute left-3 top-3 eyebrow text-[8px] opacity-40">Structure</span>
                   <textarea className="field min-h-72 pt-8" value={selectedSong.song.structure_text ?? ""} readOnly />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <Layout className="h-5 w-5 text-[var(--color-berry)]" />
                <h3 className="text-2xl font-black italic tracking-tighter uppercase">Partitures</h3>
              </div>
              
              <div className="grid gap-4 xl:grid-cols-2">
                {guitarSlots.map((slotRecord) => (
                  <div key={`${slotRecord.instrument}-${slotRecord.slot}`} className="panel rounded-3xl p-5 border border-white/5 bg-zinc-900/40 backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      {slotRecord.id && (
                        <button onClick={() => void removePartiture(slotRecord.id)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                      <div className={`p-3 rounded-2xl ${slotRecord.slot === 1 ? "bg-[var(--color-brass)]/10 text-[var(--color-brass)]" : "bg-[var(--color-berry)]/10 text-[var(--color-berry)]"}`}>
                        <Pickaxe className="h-5 w-5" />
                      </div>
                      <div>
                         <div className="eyebrow text-[10px] opacity-40">{slotRecord.instrument} slot {slotRecord.slot}</div>
                         <h4 className="text-lg font-black tracking-tight">{slotRecord.title}</h4>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-[8px] font-black uppercase text-zinc-500">Label</span>
                        <input
                          className="field pt-7 pb-2 px-4 text-xs font-bold"
                          value={slotRecord.title}
                          onChange={(e) => setPartitures(prev => [...prev.filter(i => !(i.instrument === slotRecord.instrument && i.slot === slotRecord.slot)), { ...slotRecord, title: e.target.value }])}
                        />
                      </div>
                      
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-[8px] font-black uppercase text-zinc-500">Format</span>
                        <input
                          className="field pt-7 pb-2 px-4 text-xs font-bold"
                          value={slotRecord.format}
                          onChange={(e) => setPartitures(prev => [...prev.filter(i => !(i.instrument === slotRecord.instrument && i.slot === slotRecord.slot)), { ...slotRecord, format: e.target.value }])}
                        />
                      </div>

                      <div className="relative">
                        <span className="absolute left-4 top-3 text-[8px] font-black uppercase text-zinc-500">Content</span>
                        <textarea
                          className="field pt-10 pb-4 px-4 min-h-72 font-mono text-sm leading-loose"
                          value={slotRecord.content}
                          onChange={(e) => setPartitures(prev => [...prev.filter(i => !(i.instrument === slotRecord.instrument && i.slot === slotRecord.slot)), { ...slotRecord, content: e.target.value }])}
                          placeholder="0-3-5 on E string..."
                        />
                      </div>

                      <button 
                        onClick={() => void persistPartiture(slotRecord)}
                        className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                          slotRecord.id 
                            ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700" 
                            : "bg-[var(--color-copper)] text-white shadow-lg hover:scale-105 active:scale-95"
                        }`}
                      >
                        <Save className="h-4 w-4" />
                        {slotRecord.id ? "Update Partiture" : "Save to Database"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="panel rounded-[1.75rem] p-6 text-sm text-[var(--color-sand-2)]">No songs selected.</div>
        )}
      </section>
    </div>
  );
}