"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ListMusic, Timer, type LucideIcon } from "lucide-react";

import { useI18n } from "@/components/language-provider";
import type { MusicToolkitTabId } from "@/lib/hub-access";
import type { DictKey } from "@/lib/i18n/dictionaries";

const TAB_ICONS: Record<MusicToolkitTabId, LucideIcon> = {
  harmony: Timer,
  progressions: ListMusic,
  tuner: Timer, // tuner is now merged into harmony, kept for type completeness
};

type ToolkitTab = { id: MusicToolkitTabId; label: string };

type ToolkitNavLinksInnerProps = {
  tabs: ToolkitTab[];
};

function ToolkitNavLinksInner({ tabs }: ToolkitNavLinksInnerProps) {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const activeTab = searchParams.get("tab") ?? "harmony";

  return (
    <>
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id] ?? Timer;
        const isActive = activeTab === tab.id;
        const label = (t(`tabs.${tab.id}` as DictKey) as string) || tab.label;
        return (
          <a
            key={tab.id}
            href={`/?tab=${tab.id}`}
            className={`glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
              isActive
                ? "glass-pill-active text-[var(--color-foreground)]"
                : "text-[var(--color-sand-2)] hover:-translate-y-0.5 hover:text-[var(--color-foreground)]"
            }`}
            title={label}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </a>
        );
      })}
    </>
  );
}

export function ToolkitNavLinks({ tabs }: ToolkitNavLinksInnerProps) {
  return (
    <Suspense fallback={null}>
      <ToolkitNavLinksInner tabs={tabs} />
    </Suspense>
  );
}
