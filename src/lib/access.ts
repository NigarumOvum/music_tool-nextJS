export const MANAGEABLE_PAGES = [
  { key: "prompt-library", label: "Prompt Library", href: "/prompt-library" },
  { key: "lyrics-library", label: "Lyrics Library", href: "/production-studio?tab=lyrics" },
  { key: "song-studio", label: "Song Studio", href: "/production-studio?tab=song" },
  { key: "daw", label: "DAW", href: "/production-studio?tab=audio" },
  { key: "tab-studio", label: "Tab Studio", href: "/production-studio?tab=notation" },
  { key: "musician-helpers", label: "Musician Helpers", href: "/music-toolkit?tab=practice" },
  { key: "theory-lab", label: "Theory Lab", href: "/music-toolkit?tab=harmony" },
  { key: "progressions", label: "Progressions", href: "/music-toolkit?tab=progressions" },
] as const;

export type ManagedPageKey = (typeof MANAGEABLE_PAGES)[number]["key"];

export function isManagedPageKey(value: string): value is ManagedPageKey {
  return MANAGEABLE_PAGES.some((page) => page.key === value);
}

/** Every page is accessible (used for admins). */
export const ALL_ACCESS_PAGE_MAP: Record<ManagedPageKey, boolean> = Object.fromEntries(
  MANAGEABLE_PAGES.map((page) => [page.key, true]),
) as Record<ManagedPageKey, boolean>;
