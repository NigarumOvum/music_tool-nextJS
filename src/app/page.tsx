import { AppShell } from "@/components/app-shell";
import { DashboardCard } from "@/components/dashboard-card";
import { ensureUserCanAccessPage, requireCurrentUser } from "@/lib/auth";
import { canAccessMusicToolkit, canAccessProductionStudio } from "@/lib/hub-access";
import type { ManagedPageKey } from "@/lib/access";

const dashboardItems = [
  {
    href: "/production-studio",
    title: "Production Studio",
    eyebrow: "Song workspace",
    description: "Lyrics library, raw song editing, browser DAW sessions, and tab notation in one unified workspace.",
    accent: "var(--color-copper)",
    hub: "production" as const,
  },
  {
    href: "/music-toolkit",
    title: "Music Toolkit",
    eyebrow: "Theory and practice",
    description: "Scales and chords, progression building, metronome, tuner, and other musician utilities together.",
    accent: "var(--color-mint)",
    hub: "toolkit" as const,
  },
  {
    href: "/prompt-library",
    title: "Prompt Library",
    eyebrow: "Prompting",
    description: "Create, edit, and organize reusable prompts for songwriting passes, arrangement cleanups, and production prep.",
    accent: "var(--color-brass)",
    pageKey: "prompt-library" as ManagedPageKey,
  },
];

export default async function Home() {
  const user = await requireCurrentUser();

  const visibleItems = (await Promise.all(
    dashboardItems.map(async (item) => {
      if ("pageKey" in item && item.pageKey) {
        return (await ensureUserCanAccessPage(user, item.pageKey)) ? item : null;
      }

      if (item.hub === "production") {
        return (await canAccessProductionStudio(user)) ? item : null;
      }

      if (item.hub === "toolkit") {
        return (await canAccessMusicToolkit(user)) ? item : null;
      }

      return item;
    }),
  )).filter((item): item is (typeof dashboardItems)[number] => item !== null);

  return (
    <AppShell
      title="Music Tool"
      eyebrow="Studio Hub"
      description="A private workspace for production, theory tools, and reusable AI prompt workflows."
    >
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item) => (
          <DashboardCard key={item.href} {...item} />
        ))}
      </section>
    </AppShell>
  );
}
