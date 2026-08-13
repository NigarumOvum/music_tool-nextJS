import type { ManagedPageKey } from "@/lib/access";
import type { AuthUser } from "@/lib/auth";
import { ensureUserCanAccessPage } from "@/lib/auth";

export const PRODUCTION_STUDIO_TABS = [
  { id: "lyrics", label: "Lyrics", pageKey: "lyrics-library" },
  { id: "song", label: "Song", pageKey: "song-studio" },
  { id: "audio", label: "Audio", pageKey: "daw" },
  { id: "notation", label: "Notation", pageKey: "tab-studio" },
] as const;

export const MUSIC_TOOLKIT_TABS = [
  { id: "harmony", label: "Harmony", pageKey: "theory-lab" },
  { id: "progressions", label: "Progressions", pageKey: "progressions" },
  { id: "practice", label: "Practice", pageKey: "musician-helpers" },
] as const;

export type ProductionStudioTabId = (typeof PRODUCTION_STUDIO_TABS)[number]["id"];
export type MusicToolkitTabId = (typeof MUSIC_TOOLKIT_TABS)[number]["id"];

type HubTab = {
  id: string;
  label: string;
  pageKey: ManagedPageKey;
};

async function getAllowedTabs(user: AuthUser, tabs: readonly HubTab[]) {
  const results = await Promise.all(
    tabs.map(async (tab) => ({
      id: tab.id,
      label: tab.label,
      pageKey: tab.pageKey,
      allowed: await ensureUserCanAccessPage(user, tab.pageKey),
    })),
  );

  return results.filter((tab) => tab.allowed).map(({ id, label, pageKey }) => ({ id, label, pageKey }));
}

export function isProductionStudioTabId(value: string): value is ProductionStudioTabId {
  return PRODUCTION_STUDIO_TABS.some((tab) => tab.id === value);
}

export function isMusicToolkitTabId(value: string): value is MusicToolkitTabId {
  return MUSIC_TOOLKIT_TABS.some((tab) => tab.id === value);
}

export async function getAllowedProductionStudioTabs(user: AuthUser) {
  return getAllowedTabs(user, PRODUCTION_STUDIO_TABS);
}

export async function getAllowedMusicToolkitTabs(user: AuthUser) {
  return getAllowedTabs(user, MUSIC_TOOLKIT_TABS);
}

export async function canAccessProductionStudio(user: AuthUser) {
  const tabs = await getAllowedProductionStudioTabs(user);
  return tabs.length > 0;
}

export async function canAccessMusicToolkit(user: AuthUser) {
  const tabs = await getAllowedMusicToolkitTabs(user);
  return tabs.length > 0;
}

export function resolveProductionStudioTab(
  tabParam: string | undefined,
  allowedTabs: Array<{ id: string }>,
): ProductionStudioTabId {
  if (tabParam && isProductionStudioTabId(tabParam) && allowedTabs.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }

  const first = allowedTabs[0]?.id;
  if (first && isProductionStudioTabId(first)) {
    return first;
  }

  return "lyrics";
}

export function resolveMusicToolkitTab(
  tabParam: string | undefined,
  allowedTabs: Array<{ id: string }>,
): MusicToolkitTabId {
  if (tabParam && isMusicToolkitTabId(tabParam) && allowedTabs.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }

  const first = allowedTabs[0]?.id;
  if (first && isMusicToolkitTabId(first)) {
    return first;
  }

  return "harmony";
}
