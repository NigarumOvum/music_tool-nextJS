import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
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
      {isFreeAccess ? (
        <div className="panel glass-shine flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] p-4">
          <p className="text-xs text-[var(--color-sand-1)]">
            You&apos;re browsing with <span className="font-black text-[var(--color-brass)]">free access</span> —
            the Harmony tab is open to every member.
          </p>
          <div className="flex gap-2">
            <Link
              href="/membership"
              className="glass-pill px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)] transition hover:brightness-110"
            >
              View plans
            </Link>
            <Link
              href="/account"
              className="glass-pill px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition hover:text-[var(--color-foreground)]"
            >
              Request access
            </Link>
          </div>
        </div>
      ) : null}
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
