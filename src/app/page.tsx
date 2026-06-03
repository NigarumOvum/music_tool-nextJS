import { AppShell } from "@/components/app-shell";
import { DashboardCard } from "@/components/dashboard-card";

const dashboardItems = [
  {
    href: "/prompt-library",
    title: "Prompt Library",
    eyebrow: "Prompting",
    description: "Create, edit, and organize reusable prompts for songwriting passes, arrangement cleanups, and production prep.",
    accent: "var(--color-brass)",
  },
  {
    href: "/lyrics-library",
    title: "Lyrics Library",
    eyebrow: "Catalog",
    description: "Browse lyrics, edit song structure, and manage per-song partitures with two guitar slots ready by default.",
    accent: "var(--color-berry)",
  },
  {
    href: "/song-studio",
    title: "Song Studio",
    eyebrow: "Editing",
    description: "The raw editor for song records, metadata, JSON payloads, sections, and layers when you need full control.",
    accent: "var(--color-copper)",
  },
  {
    href: "/daw",
    title: "DAW Web App",
    eyebrow: "Browser DAW",
    description: "Import audio and MIDI assets, manage layer racks, and export session manifests from the browser.",
    accent: "var(--color-mint)",
  },
  {
    href: "/tab-studio",
    title: "Guitar Pro Like App",
    eyebrow: "Notation",
    description: "Intake tab files, edit a fret grid, inspect markers, and export notation or score metadata.",
    accent: "var(--color-brass)",
  },
  {
    href: "/musician-helpers",
    title: "Musician Helpers",
    eyebrow: "Tools",
    description: "Instrument-specific utilities like tuning standards, fretboard visuals, and advanced metronomes.",
    accent: "var(--color-berry)",
  },
  {
    href: "/theory-lab",
    title: "Theory Lab",
    eyebrow: "Education",
    description: "Interactive references for scales, modes, circle of fifths, and chord construction.",
    accent: "var(--color-copper)",
  },
  {
    href: "/progressions",
    title: "Progression Builder",
    eyebrow: "Writing",
    description: "Experiment with chord structures, roman numeral analysis, and discover new harmony paths.",
    accent: "var(--color-mint)",
  },
];

export default function Home() {
  return (
    <AppShell
      title="Music Tool"
      eyebrow="Studio Hub"
      description="A private workspace for prompt building, lyrics and partiture management, raw song editing, browser DAW workflows, and Guitar Pro-like notation work."
    >
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {dashboardItems.map((item) => (
          <DashboardCard key={item.href} {...item} />
        ))}
      </section>
    </AppShell>
  );
}
