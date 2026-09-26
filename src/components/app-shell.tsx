import type { ReactNode } from "react";

import Link from "next/link";
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
import { Music2 } from "lucide-react";

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

type AppShellProps = {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
  pageKey?: ManagedPageKey;
};

export async function AppShell({ title, eyebrow, description, children, aside, pageKey }: AppShellProps) {
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
    <div className="grain min-h-screen px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="panel glass-shine sticky top-3 z-20 rounded-[1.25rem] p-3 sm:p-4 animate-fade-up">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-3 xl:min-w-[220px] xl:justify-start">
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <div className="glass-pill flex h-11 w-11 items-center justify-center text-[var(--color-copper)]">
                  <Music2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="eyebrow">Studio Hub</div>
                  <div className="truncate text-lg font-black tracking-tight text-[var(--color-foreground)]">BandsChamber Studio</div>
                </div>
              </Link>
              <div className="flex items-center gap-2 xl:hidden">
                <PWAInstallButton />
                <LanguageSwitcher compact />
                <ThemeToggle />
              </div>
            </div>

            <nav className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-1">
              <AppNavLinks items={navLinks} />
            </nav>

            <div className="hidden items-center gap-2 xl:flex">
              <PWAInstallButton />
              <LanguageSwitcher />
              <HeaderAccountLink name={user.name || user.email} />
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 xl:hidden">
              <HeaderAccountLink name={user.name || user.email} />
              <LanguageSwitcher />
          </div>
        </header>

        <main className={aside ? "page-grid" : "space-y-4"}>
          {aside ? <aside className="panel rounded-[1.25rem] p-3">{aside}</aside> : null}
          <section className="space-y-4">
            <div className="flex flex-col gap-1 px-2 sm:px-4">
              <div className="flex items-baseline gap-3">
                <span className="eyebrow text-[0.65rem] opacity-60 uppercase tracking-[0.2em]">{eyebrow}</span>
                <h1 className="text-xl font-black tracking-tight text-[var(--color-foreground)]">{title}</h1>
              </div>
              <p className="text-xs text-[var(--color-sand-2)] opacity-80">{description}</p>
            </div>
            {children}
          </section>
        </main>

        <AppFooter />
      </div>
    </div>
  );
}