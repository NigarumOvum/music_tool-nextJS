import { AppShell } from "@/components/app-shell";
import { SongStudioClient } from "@/components/music/song-studio-client";

export default function SongStudioPage() {
  return (
    <AppShell
      title="Song Studio"
      eyebrow="Database Editing"
      description="Direct access to the music catalog with metadata editing, lyrics updates, JSON payload editing, and section and layer management."
      pageKey="song-studio"
    >
      <SongStudioClient />
    </AppShell>
  );
}