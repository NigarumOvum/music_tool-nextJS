"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type AppNavLinksProps = {
  items: NavItem[];
};

export function AppNavLinks({ items }: AppNavLinksProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-w-max items-center gap-2 px-0.5 xl:justify-center">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glass-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition sm:px-4 ${
              active
                ? "glass-pill-active text-[var(--color-foreground)]"
                : "text-[var(--color-foreground)] hover:-translate-y-0.5 hover:border-[var(--color-info-border)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
