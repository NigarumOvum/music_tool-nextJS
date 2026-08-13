export const MANAGEABLE_PAGES = [
  { key: "prompt-library", label: "Prompt Library", href: "/prompt-library" },
  { key: "lyrics-library", label: "Lyrics Library", href: "/lyrics-library" },
  { key: "song-studio", label: "Song Studio", href: "/song-studio" },
  { key: "daw", label: "DAW", href: "/daw" },
  { key: "tab-studio", label: "Tab Studio", href: "/tab-studio" },
  { key: "musician-helpers", label: "Musician Helpers", href: "/musician-helpers" },
  { key: "theory-lab", label: "Theory Lab", href: "/theory-lab" },
  { key: "progressions", label: "Progressions", href: "/progressions" },
] as const;

export type ManagedPageKey = (typeof MANAGEABLE_PAGES)[number]["key"];

export function isManagedPageKey(value: string): value is ManagedPageKey {
  return MANAGEABLE_PAGES.some((page) => page.key === value);
}

/** Every page is accessible (used for admins). */
export const ALL_ACCESS_PAGE_MAP: Record<ManagedPageKey, boolean> = Object.fromEntries(
  MANAGEABLE_PAGES.map((page) => [page.key, true]),
) as Record<ManagedPageKey, boolean>;
