"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button, Chip } from "@heroui/react";
import type { MusicSongSummary } from "@/lib/music/types";

const SIDEBAR_COLLAPSED_KEY = "studio_sidebar_collapsed";

type StudioSidebarProps = {
  songs: MusicSongSummary[];
  selectedSongId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onSelectSong: (id: string) => void;
  onDeleteSong: (song: MusicSongSummary) => void;
  // Optional catalog mode props (for Lyrics & Rhymes)
  catalogMode?: boolean;
  genre?: string;
  onGenreChange?: (value: string) => void;
  language?: string;
  onLanguageChange?: (value: string) => void;
};

export function StudioSidebar({
  songs,
  selectedSongId,
  search,
  onSearchChange,
  onSearchSubmit,
  onRefresh,
  onNew,
  onSelectSong,
  onDeleteSong,
  catalogMode = false,
  genre = "",
  onGenreChange,
  language = "",
  onLanguageChange,
}: StudioSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved) {
      setCollapsed(saved === "true");
    }
  }, []);

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const filteredSongs = songs.filter((song) => {
    const query = search.trim().toLowerCase();
    const genreQuery = genre.trim().toLowerCase();
    const languageQuery = language.trim().toLowerCase();

    if (query && ![song.title, song.genre, song.language, song.emotion, song.topic]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))) {
      return false;
    }
    if (genreQuery && !(song.genre || "").toLowerCase().includes(genreQuery)) return false;
    if (languageQuery && !(song.language || "").toLowerCase().includes(languageQuery)) return false;
    return true;
  });

  const genres = catalogMode
    ? Array.from(new Set(songs.map((s) => s.genre).filter((g): g is string => Boolean(g)))).sort()
    : [];
  const languages = catalogMode
    ? Array.from(new Set(songs.map((s) => s.language).filter((l): l is string => Boolean(l)))).sort()
    : [];

  if (collapsed) {
    return (
      <aside className="panel glass-shine flex w-16 flex-col items-center rounded-[1.75rem] p-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="glass-pill mb-4 flex h-8 w-8 items-center justify-center"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!catalogMode && (
          <>
            <button
              type="button"
              onClick={onNew}
              className="glass-pill mb-2 flex h-8 w-8 items-center justify-center"
              aria-label="New song"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="glass-pill mb-4 flex h-8 w-8 items-center justify-center"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </>
        )}
        <div className="flex-1 space-y-2 overflow-auto">
          {filteredSongs.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => onSelectSong(song.id)}
              className={`glass-pill flex h-8 w-8 items-center justify-center ${
                selectedSongId === song.id ? "bg-[var(--color-copper)] text-white" : ""
              }`}
              aria-label={song.title}
            >
              <div className="h-2 w-2 rounded-full bg-current" />
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="panel glass-shine rounded-[1.75rem] p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Library</div>
            <h2 className="mt-2 text-2xl font-black">Songs</h2>
            <p className="mt-1 text-xs text-[var(--color-sand-2)]">{songs.length} in workspace</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="glass-pill flex h-8 w-8 items-center justify-center"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-sand-2)]" />
          <input
            className="field pl-10"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchSubmit();
            }}
            placeholder={catalogMode ? "Search title..." : "Search title, genre, mood..."}
          />
        </div>

        {catalogMode && onGenreChange && onLanguageChange ? (
          <div className="grid grid-cols-2 gap-2">
            <select value={genre} onChange={(e) => onGenreChange(e.target.value)} className="field">
              <option value="">All genres</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={language} onChange={(e) => onLanguageChange(e.target.value)} className="field">
              <option value="">All languages</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button className="bg-[var(--color-copper)] text-white" radius="full" onPress={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="bordered" radius="full" onPress={onNew}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>

        <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-sand-2)]">
          {filteredSongs.length} of {songs.length} songs
        </div>
        <div className={`mt-2 ${catalogMode ? "flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-col xl:overflow-visible xl:pb-0" : "max-h-[68vh] space-y-2 overflow-auto pr-1 stagger-children"}`}>
          {filteredSongs.map((song) => (
            catalogMode ? (
              <button
                key={song.id}
                type="button"
                onClick={() => onSelectSong(song.id)}
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
            ) : (
              <div
                key={song.id}
                className={`song-list-item group flex items-start gap-2 rounded-[1.25rem] px-3 py-3 ${
                  selectedSongId === song.id ? "song-list-item-active" : ""
                }`}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectSong(song.id)}
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
                  onClick={() => onDeleteSong(song)}
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          ))}
          {filteredSongs.length === 0 ? (
            <div className={`py-4 text-sm text-[var(--color-sand-2)] ${catalogMode ? "" : "rounded-[1.25rem] border border-dashed border-white/10 px-4 py-6 text-center"}`}>
              No songs match the filters.
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
