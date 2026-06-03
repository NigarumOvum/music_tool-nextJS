import { AppShell } from "@/components/app-shell";
import { DashboardCard } from "@/components/dashboard-card";

const dashboardItems = [
  {
    href: "/prompt-library",
    title: "Prompt Library",
    eyebrow: "Prompting",
    description: "Curated music prompt recipes for song drafts, rewrite passes, arrangement cleanups, and mix prep.",
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
    description: "Direct database-backed editing for song metadata, JSON payloads, sections, and layers.",
    accent: "var(--color-copper)",
  },
  {
    href: "/ai-studio",
    title: "AI Studio",
    eyebrow: "Generation",
    description: "Generate structured drafts, preview field enhancements, and apply accepted AI rewrites.",
    accent: "var(--color-mint)",
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
    href: "/snapshots",
    title: "Snapshots",
    eyebrow: "Safety",
    description: "Create manual checkpoints and restore an earlier song state when an experiment goes sideways.",
    accent: "var(--color-berry)",
  },
  {
    href: "/templates",
    title: "Templates",
    eyebrow: "Workflow",
    description: "Manage reusable enhancement templates for lyrics, structure, production notes, sections, and layers.",
    accent: "var(--color-copper)",
  },
];

export default function Home() {
  return (
    <AppShell
      title="Music Tool"
      eyebrow="Studio Hub"
      description="A standalone home for songwriting, arrangement editing, lyrics management, browser DAW workflows, and Guitar Pro-like notation work."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardItems.map((item) => (
          <DashboardCard key={item.href} {...item} />
        ))}
      </section>
    </AppShell>
  );
}
