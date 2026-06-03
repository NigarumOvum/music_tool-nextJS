"use client";

import { useEffect, useState } from "react";

import { Button, Spinner } from "@heroui/react";
import { Clock4, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { createSnapshot, fetchSnapshots, fetchSongs, restoreSnapshot } from "@/lib/music/client";
import type { MusicSnapshotRecord, MusicSongSummary } from "@/lib/music/types";

export function SnapshotsClient() {
  const [songs, setSongs] = useState<MusicSongSummary[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [snapshots, setSnapshots] = useState<MusicSnapshotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("Manual checkpoint from Music Tool");

  async function loadSnapshots(songId: string) {
    setLoading(true);
    try {
      const payload = await fetchSnapshots(songId);
      setSnapshots(payload.snapshots);
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
          await loadSnapshots(payload.songs[0].id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        toast.error((error as Error).message);
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreateSnapshot() {
    if (!selectedSongId) {
      return;
    }
    try {
      await createSnapshot(selectedSongId, { note, snapshotType: "manual" });
      toast.success("Snapshot created");
      await loadSnapshots(selectedSongId);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function handleRestore(snapshotId: string) {
    try {
      await restoreSnapshot(snapshotId, { note: "Restored from Snapshots page" });
      toast.success("Snapshot restored");
      if (selectedSongId) {
        await loadSnapshots(selectedSongId);
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="panel rounded-[1.75rem] p-5">
        <div className="eyebrow">Song selection</div>
        <div className="mt-4 space-y-2">
          {songs.map((song) => (
            <button key={song.id} type="button" onClick={() => void loadSnapshots(song.id)} className={`w-full rounded-[1.25rem] border px-4 py-4 text-left ${song.id === selectedSongId ? "border-[var(--color-brass)] bg-white/8" : "border-white/8 bg-white/3"}`}>
              <div className="font-bold">{song.title}</div>
              <div className="mt-1 text-xs text-[var(--color-sand-2)]">{song.saved_at || song.synced_at}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel rounded-[1.75rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Checkpoint timeline</div>
            <h2 className="mt-2 text-3xl font-black">Snapshots</h2>
          </div>
          <div className="flex w-full max-w-xl gap-2">
            <input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Snapshot note" />
            <Button className="bg-[var(--color-brass)] text-[var(--color-ink)]" radius="full" onPress={handleCreateSnapshot}>
              <Save className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="mt-6 flex justify-center"><Spinner color="warning" /></div>
        ) : snapshots.length === 0 ? (
          <div className="mt-6 rounded-[1.25rem] border border-dashed border-white/12 p-6 text-sm text-[var(--color-sand-2)]">No snapshots yet for this song.</div>
        ) : (
          <div className="mt-6 space-y-3">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-[1.25rem] border border-white/8 bg-white/4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="eyebrow">{snapshot.snapshotType}</div>
                    <div className="mt-2 text-lg font-black">{snapshot.note || "No note"}</div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-sand-2)]">
                      <Clock4 className="h-4 w-4" />
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button radius="full" className="bg-[var(--color-berry)] text-white" onPress={() => void handleRestore(snapshot.id)}>
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}