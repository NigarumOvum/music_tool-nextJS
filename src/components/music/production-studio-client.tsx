"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Spinner } from "@heroui/react";

import type { ProductionStudioTabId } from "@/lib/hub-access";

const tabLoaders = {
  lyrics: () => import("@/components/music/lyrics-library-client").then((module) => module.LyricsLibraryClient),
  song: () => import("@/components/music/song-studio-client").then((module) => module.SongStudioClient),
  audio: () => import("@/components/music/daw-client").then((module) => module.DawClient),
  notation: () => import("@/components/music/tab-studio-client").then((module) => module.TabStudioClient),
} as const;

const tabPanels: Record<ProductionStudioTabId, ReturnType<typeof dynamic>> = {
  lyrics: dynamic(() => tabLoaders.lyrics().then((Component) => ({ default: Component })), { ssr: false }),
  song: dynamic(() => tabLoaders.song().then((Component) => ({ default: Component })), { ssr: false }),
  audio: dynamic(() => tabLoaders.audio().then((Component) => ({ default: Component })), { ssr: false }),
  notation: dynamic(() => tabLoaders.notation().then((Component) => ({ default: Component })), { ssr: false }),
};

type ProductionStudioTab = {
  id: ProductionStudioTabId;
  label: string;
};

type ProductionStudioClientProps = {
  allowedTabs: ProductionStudioTab[];
  initialTab: ProductionStudioTabId;
};

function TabSpinner() {
  return (
    <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6">
      <Spinner color="warning" />
    </div>
  );
}

function ProductionStudioInner({ allowedTabs, initialTab }: ProductionStudioClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || undefined;

  const activeTab = useMemo(() => {
    if (tabParam && allowedTabs.some((tab) => tab.id === tabParam)) {
      return tabParam as ProductionStudioTabId;
    }

    if (allowedTabs.some((tab) => tab.id === initialTab)) {
      return initialTab;
    }

    return allowedTabs[0]?.id || initialTab;
  }, [allowedTabs, initialTab, tabParam]);

  const ActivePanel = tabPanels[activeTab];

  function selectTab(tabId: ProductionStudioTabId) {
    router.replace(`/production-studio?tab=${tabId}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === tab.id
                ? "border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-foreground)]"
                : "text-[var(--color-sand-2)] hover:-translate-y-0.5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabSpinner />}>
        {ActivePanel ? <ActivePanel /> : null}
      </Suspense>
    </div>
  );
}

export function ProductionStudioClient(props: ProductionStudioClientProps) {
  return (
    <Suspense fallback={<TabSpinner />}>
      <ProductionStudioInner {...props} />
    </Suspense>
  );
}
