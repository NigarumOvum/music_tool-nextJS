import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { FreeAccessBanner } from "@/components/header-bits";
import { MusicToolkitClient } from "@/components/music/music-toolkit-client";
import {
  getAllowedMusicToolkitTabs,
  resolveMusicToolkitTab,
  type MusicToolkitTabId,
} from "@/lib/hub-access";
import { requireCurrentUser } from "@/lib/auth";

type HomePageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const user = await requireCurrentUser();
  const allowedTabs = await getAllowedMusicToolkitTabs(user);

  // Free access: every logged-in user gets the Harmony tab on the root page,
  // even without granted page access. Other pages stay access-gated.
  const isFreeAccess = allowedTabs.length === 0;
  const tabs = isFreeAccess ? [{ id: "harmony" as const, label: "Harmony" }] : allowedTabs;

  const { tab } = await searchParams;
  const initialTab = resolveMusicToolkitTab(tab, tabs);

  if (isFreeAccess && tab && tab !== "harmony") {
    redirect("/?tab=harmony");
  }

  return (
    <AppShell
      title="Music Toolkit"
      eyebrow="Theory and practice"
      description="Scales and chords, progression building, and metronome or tuner utilities in one toolkit. Tabs respect your existing page access settings."
    >
      {isFreeAccess ? <FreeAccessBanner /> : null}
      <MusicToolkitClient
        allowedTabs={tabs.map((entry) => ({
          id: entry.id as MusicToolkitTabId,
          label: entry.label,
        }))}
        initialTab={initialTab}
      />
    </AppShell>
  );
}
