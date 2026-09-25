"use client";

import Link from "next/link";

import { useI18n } from "@/components/language-provider";

export function HeaderAccountLink({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <Link
      href="/account"
      className="glass-pill inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface-strong)] transition-colors"
      title={t("nav.manageAccount")}
    >
      {name}
    </Link>
  );
}

export function FreeAccessBanner() {
  const { t } = useI18n();
  const message = t("free.message");
  const highlight = t("free.freeAccess");
  const parts = message.split(highlight);
  return (
    <div className="panel glass-shine flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] p-4">
      <p className="text-xs text-[var(--color-sand-1)]">
        {parts.length === 2 ? (
          <>
            {parts[0]}
            <span className="font-black text-[var(--color-brass)]">{highlight}</span>
            {parts[1]}
          </>
        ) : (
          message
        )}
      </p>
      <div className="flex gap-2">
        <Link
          href="/membership"
          className="glass-pill px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-brass)] transition hover:brightness-110"
        >
          {t("free.viewPlans")}
        </Link>
        <Link
          href="/account"
          className="glass-pill px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition hover:text-[var(--color-foreground)]"
        >
          {t("free.requestAccess")}
        </Link>
      </div>
    </div>
  );
}
