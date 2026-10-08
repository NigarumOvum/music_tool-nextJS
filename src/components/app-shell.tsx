import type { ReactNode } from "react";

import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { AppNavLinks, type AppNavIconId } from "@/components/app-nav-links";
import { AppFooter } from "@/components/app-footer";
import { HeaderAccountLink } from "@/components/header-bits";
import { LanguageSwitcher } from "@/components/language-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { PWAInstallButton } from "@/components/pwa/pwa-install-button";
import { ensureUserCanAccessPage, requireCurrentUser } from "@/lib/auth";
import type { ManagedPageKey } from "@/lib/access";
import { canAccessProductionStudio } from "@/lib/hub-access";

type NavItemConfig = {
  href: string;
  label: string;
  icon: AppNavIconId;
  hub?: "production";
  pageKey?: ManagedPageKey;
};

const navItems: NavItemConfig[] = [
  { href: "/production-studio", label: "Production Studio", icon: "production", hub: "production" },
  { href: "/prompt-library", label: "Prompt Library", icon: "prompt-library", pageKey: "prompt-library" },
];

export type ToolkitNavLink = {
  href: string;
  label: string;
  /** i18n key used by AppNavLinks to translate the label */
  icon: AppNavIconId;
};

type AppShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
  pageKey?: ManagedPageKey;
  /** Extra nav links injected between the main nav links and the right controls (e.g. harmony, progressions) */
  toolkitLinks?: ReactNode;
  /** Slot rendered inline with the page title — used for the fullscreen toggle */
  titleSlot?: ReactNode;
};

export async function AppShell({
  title,
  eyebrow,
  description,
  children,
  aside,
  pageKey,
  toolkitLinks,
  titleSlot,
}: AppShellProps) {
  const user = await requireCurrentUser();

  if (pageKey && !(await ensureUserCanAccessPage(user, pageKey))) {
    redirect(`/account?denied=${encodeURIComponent(pageKey)}`);
  }

  const visibleNavItems = (
    await Promise.all(
      navItems.map(async (item) => {
        if ("pageKey" in item && item.pageKey) {
          return (await ensureUserCanAccessPage(user, item.pageKey)) ? item : null;
        }

        if (item.hub === "production") {
          return (await canAccessProductionStudio(user)) ? item : null;
        }

        return item;
      }),
    )
  ).filter((item): item is NavItemConfig => Boolean(item));

  const navLinks = visibleNavItems.map(({ href, label, icon }) => ({ href, label, icon }));

  return (
    <div className="grain min-h-screen flex flex-col">
      {/* ── Sticky top navbar ─────────────────────────────────── */}
      <header className="panel glass-shine sticky top-0 z-20 w-full animate-fade-up border-b border-[var(--color-border)]/50 px-3 sm:px-5 lg:px-6">
        <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-3">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5 min-w-0">
            <Image
              src="/icons/icon-192x192.png"
              alt="BandsChamber Studio logo"
              width={32}
              height={32}
              priority
              className="h-8 w-8 shrink-0 rounded-lg shadow-xs"
            />
            <div className="hidden min-w-0 sm:block">
              <div className="eyebrow text-[0.55rem] leading-none">Studio Hub</div>
              <div className="truncate text-sm font-black tracking-tight text-[var(--color-foreground)]">
                BandsChamber Studio
              </div>
            </div>
          </Link>

          {/* Divider */}
          <div className="hidden h-5 w-px shrink-0 bg-[var(--color-border)] sm:block" />

          {/* Nav links: toolkit first (harmony, progressions), then app (Production Studio, Prompt Library) */}
          <nav className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 px-0.5">
              {toolkitLinks}
              <AppNavLinks items={navLinks} />
            </div>
          </nav>

          {/* Right controls — compact icon cluster */}
          <div className="flex shrink-0 items-center gap-1">
            <PWAInstallButton />
            <LanguageSwitcher />
            <HeaderAccountLink name={user.name || user.email} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col px-3 py-4 sm:px-5 lg:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">

          <main className={aside ? "page-grid" : "space-y-4"}>
            {aside ? <aside className="panel rounded-[1.25rem] p-3">{aside}</aside> : null}
            <section className="space-y-4">
              {/* Title row — eyebrow + h1 + optional fullscreen button */}
              <div className="flex items-center justify-between gap-3 px-2 sm:px-4">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-3">
                    <span className="eyebrow text-[0.65rem] opacity-60 uppercase tracking-[0.2em]">{eyebrow}</span>
                    <h1 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">{title}</h1>
                  </div>
                  <p className="text-xs text-[var(--color-sand-2)] opacity-80">{description}</p>
                </div>
                {titleSlot ? (
                  <div className="shrink-0">{titleSlot}</div>
                ) : null}
              </div>
              {children}
            </section>
          </main>

          <AppFooter />
        </div>
      </div>
    </div>
  );
}
