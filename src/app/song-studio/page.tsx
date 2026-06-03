import { AppShell } from "@/components/app-shell";
import { SongStudioClient } from "@/components/music/song-studio-client";

export default function SongStudioPage() {
  return (
    <AppShell
      title="Song Studio"
      eyebrow="Database Editing"
      description="The low-level editor for song records, metadata, JSON payloads, sections, and layers. Use Lyrics Library when you want a lyrics-first view with partitures."
      pageKey="song-studio"
    >
      <SongStudioClient />
    </AppShell>
  );
}