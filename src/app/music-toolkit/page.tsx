import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MusicToolkitClient } from "@/components/music/music-toolkit-client";
import {
  getAllowedMusicToolkitTabs,
  resolveMusicToolkitTab,
  type MusicToolkitTabId,
} from "@/lib/hub-access";
import { requireCurrentUser } from "@/lib/auth";

type MusicToolkitPageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function MusicToolkitPage({ searchParams }: MusicToolkitPageProps) {
  const user = await requireCurrentUser();
  const allowedTabs = await getAllowedMusicToolkitTabs(user);

  if (allowedTabs.length === 0) {
    redirect("/account?denied=music-toolkit");
  }

  const { tab } = await searchParams;
  const initialTab = resolveMusicToolkitTab(tab, allowedTabs);

  return (
    <AppShell
      title="Music Toolkit"
      eyebrow="Theory and practice"
      description="Scales and chords, progression building, and metronome or tuner utilities in one toolkit. Tabs respect your existing page access settings."
    >
      <MusicToolkitClient
        allowedTabs={allowedTabs.map((entry) => ({
          id: entry.id as MusicToolkitTabId,
          label: entry.label,
        }))}
        initialTab={initialTab}
      />
    </AppShell>
  );
}
