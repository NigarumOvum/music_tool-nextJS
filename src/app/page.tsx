import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { FreeAccessBanner } from "@/components/header-bits";
import { MusicToolkitClient } from "@/components/music/music-toolkit-client";
import { ToolkitNavLinks } from "@/components/toolkit-nav-links";
import { FullscreenTitleButton } from "@/components/fullscreen-context";
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

  // Tuner is now embedded inside the Harmony tab — filter it from nav tabs.
  const rawTabs = isFreeAccess ? [{ id: "harmony" as const, label: "Harmony" }] : allowedTabs;
  const navTabs = rawTabs.filter((t) => t.id !== "tuner");
  const tabs = navTabs;

  const { tab } = await searchParams;

  // Redirect tuner URL to harmony (tuner is now inside harmony).
  const resolvedTab = tab === "tuner" ? "harmony" : tab;
  const initialTab = resolveMusicToolkitTab(resolvedTab, tabs);

  if (isFreeAccess && resolvedTab && resolvedTab !== "harmony") {
    redirect("/?tab=harmony");
  }

  return (
    <AppShell
      title="Music Toolkit"
      eyebrow="Theory and practice"
      description="Scales and chords, progression building, and metronome or tuner utilities."
      toolkitLinks={<ToolkitNavLinks tabs={tabs.map((t) => ({ id: t.id as MusicToolkitTabId, label: t.label }))} />}
      titleSlot={<FullscreenTitleButton />}
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
