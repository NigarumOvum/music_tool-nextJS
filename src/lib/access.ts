export const MANAGEABLE_PAGES = [
  { key: "prompt-library", label: "Prompt Library", href: "/prompt-library" },
  { key: "lyrics-library", label: "Lyrics Library", href: "/lyrics-library" },
  { key: "song-studio", label: "Song Studio", href: "/song-studio" },
  { key: "daw", label: "DAW", href: "/daw" },
  { key: "tab-studio", label: "Tab Studio", href: "/tab-studio" },
  { key: "snapshots", label: "Snapshots", href: "/snapshots" },
  { key: "templates", label: "Templates", href: "/templates" },
] as const;

export type ManagedPageKey = (typeof MANAGEABLE_PAGES)[number]["key"];

export function isManagedPageKey(value: string): value is ManagedPageKey {
  return MANAGEABLE_PAGES.some((page) => page.key === value);
}