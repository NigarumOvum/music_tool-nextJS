import type { ReactNode } from "react";

import Link from "next/link";

import { requireCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";
import { Music2, NotebookPen, PanelTop, RadioTower, ScrollText, Sparkles, Waves, Wrench } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Music2 },
  { href: "/song-studio", label: "Song Studio", icon: PanelTop },
  { href: "/lyrics-library", label: "Lyrics Library", icon: ScrollText },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/daw", label: "DAW", icon: Waves },
  { href: "/tab-studio", label: "Tab Studio", icon: RadioTower },
  { href: "/templates", label: "Templates", icon: Wrench },
  { href: "/prompt-library", label: "Prompt Library", icon: NotebookPen },
];

type AppShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
};

export async function AppShell({ title, eyebrow, description, children, aside }: AppShellProps) {
  const user = await requireCurrentUser();

  return (
    <div className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="eyebrow">{eyebrow}</div>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-6">
                <h1 className="text-4xl font-black tracking-tight text-[var(--color-sand-1)] sm:text-5xl">{title}</h1>
                <span className="inline-flex rounded-full border border-white/10 bg-[rgba(217,179,108,0.12)] px-4 py-2 font-mono text-[0.72rem] uppercase tracking-[0.22em] text-[var(--color-brass)]">
                  Spec-driven build
                </span>
              </div>
              <p className="max-w-3xl text-sm leading-7 text-[var(--color-sand-2)] sm:text-base">{description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-2)]">
                {user.name || user.email}
              </span>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-1)] transition hover:border-[var(--color-copper)] hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="page-grid">
          {aside ? <aside className="panel rounded-[1.75rem] p-4">{aside}</aside> : null}
          <section className="space-y-6">{children}</section>
        </main>
      </div>
    </div>
  );
}