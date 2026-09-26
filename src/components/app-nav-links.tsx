"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Disc3, ScrollText, type LucideIcon } from "lucide-react";

import { useI18n } from "@/components/language-provider";

export type AppNavIconId = "production" | "prompt-library";

const NAV_ICONS: Record<AppNavIconId, LucideIcon> = {
  production: Disc3,
  "prompt-library": ScrollText,
};

type NavItem = {
  href: string;
  label: string;
  icon: AppNavIconId;
};

type AppNavLinksProps = {
  items: NavItem[];
};

export function AppNavLinks({ items }: AppNavLinksProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex min-w-max items-center gap-2 px-0.5 xl:justify-center">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const label =
          item.icon === "production"
            ? t("nav.production")
            : item.icon === "prompt-library"
              ? t("nav.prompts")
              : item.label;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 transition ${
              active
                ? "glass-pill-active text-[var(--color-foreground)]"
                : "text-[var(--color-foreground)] hover:-translate-y-0.5 hover:border-[var(--color-info-border)]"
            }`}
            title={label}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em]">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
