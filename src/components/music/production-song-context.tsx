"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchSongs } from "@/lib/music/client";

type ProductionSong = { id: string; title: string };

type ProductionSongContextValue = {
  songs: ProductionSong[];
  selectedSongId: string;
  setSelectedSongId: (songId: string) => void;
  loading: boolean;
  refreshSongs: () => Promise<void>;
};

const ProductionSongContext = createContext<ProductionSongContextValue | null>(null);

export function ProductionSongProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<ProductionSong[]>([]);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshSongs = useCallback(async (preferredId?: string) => {
    const payload = await fetchSongs();
    const nextSongs = payload.songs.map((song) => ({ id: song.id, title: song.title }));
    setSongs(nextSongs);

    setSelectedSongId((current) => {
      if (preferredId && nextSongs.some((song) => song.id === preferredId)) {
        return preferredId;
      }
      if (current && nextSongs.some((song) => song.id === current)) {
        return current;
      }
      return nextSongs[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await refreshSongs();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSongs]);

  return (
    <ProductionSongContext
      value={{
        songs,
        selectedSongId,
        setSelectedSongId,
        loading,
        refreshSongs: () => refreshSongs(),
      }}
    >
      {children}
    </ProductionSongContext>
  );
}

export function useProductionSong() {
  const context = useContext(ProductionSongContext);
  if (!context) {
    throw new Error("useProductionSong must be used within ProductionSongProvider");
  }

  return context;
}

export function ProductionSongPicker() {
  const { songs, selectedSongId, setSelectedSongId, loading } = useProductionSong();

  if (loading) {
    return (
      <div className="glass-card-soft animate-fade-up rounded-[1.25rem] px-4 py-3 text-sm text-[var(--color-sand-2)]">
        Loading songs...
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="glass-card-soft animate-fade-up rounded-[1.25rem] px-4 py-3 text-sm text-[var(--color-sand-2)]">
        No songs yet. Create one in the Song tab.
      </div>
    );
  }

  return (
    <div className="glass-card-soft glass-shine animate-fade-up flex flex-wrap items-center gap-3 rounded-[1.25rem] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brass)]">Active song</span>
      <select
        className="field min-w-[220px] flex-1"
        value={selectedSongId}
        onChange={(event) => setSelectedSongId(event.target.value)}
      >
        {songs.map((song) => (
          <option key={song.id} value={song.id}>{song.title}</option>
        ))}
      </select>
    </div>
  );
}
