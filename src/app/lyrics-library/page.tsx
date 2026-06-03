import { AppShell } from "@/components/app-shell";
import { LyricsLibraryClient } from "@/components/music/lyrics-library-client";

export default function LyricsLibraryPage() {
  return (
    <AppShell
      title="Lyrics Library"
      eyebrow="Catalog + Partitures"
      description="Browse songs as a lyrics-first library and attach multiple partitures per song, with two guitar slots surfaced as the default working setup."
      pageKey="lyrics-library"
    >
      <LyricsLibraryClient />
    </AppShell>
  );
}