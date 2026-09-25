"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import { Spinner } from "@heroui/react";

import { SplitViewFullScreen } from "@/components/split-view-fullscreen";
import type { MusicToolkitTabId } from "@/lib/hub-access";

const tabLoaders = {
  harmony: () => import("@/components/music/theory-lab-client").then((module) => module.TheoryLabClient),
  progressions: () => import("@/components/music/progression-client").then((module) => module.ProgressionClient),
  practice: () => import("@/components/music/helpers-client").then((module) => module.HelpersClient),
} as const;

const tabPanels: Record<MusicToolkitTabId, ReturnType<typeof dynamic>> = {
  harmony: dynamic(() => tabLoaders.harmony().then((Component) => ({ default: Component })), { ssr: false }),
  progressions: dynamic(() => tabLoaders.progressions().then((Component) => ({ default: Component })), { ssr: false }),
  practice: dynamic(() => tabLoaders.practice().then((Component) => ({ default: Component })), { ssr: false }),
};

type MusicToolkitTab = {
  id: MusicToolkitTabId;
  label: string;
};

type MusicToolkitClientProps = {
  allowedTabs: MusicToolkitTab[];
  initialTab: MusicToolkitTabId;
};

function TabSpinner() {
  return (
    <div className="panel flex min-h-[320px] items-center justify-center rounded-[1.75rem] p-6">
      <Spinner color="warning" />
    </div>
  );
}

function MusicToolkitInner({ allowedTabs, initialTab }: MusicToolkitClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || undefined;
  const [secondaryTab, setSecondaryTab] = useState<MusicToolkitTabId | null>(null);

  const activeTab = useMemo(() => {
    if (tabParam && allowedTabs.some((tab) => tab.id === tabParam)) {
      return tabParam as MusicToolkitTabId;
    }

    if (allowedTabs.some((tab) => tab.id === initialTab)) {
      return initialTab;
    }

    return allowedTabs[0]?.id || initialTab;
  }, [allowedTabs, initialTab, tabParam]);

  const ActivePanel = tabPanels[activeTab];
  const SecondaryPanel = secondaryTab ? tabPanels[secondaryTab] : null;

  function selectTab(tabId: MusicToolkitTabId) {
    router.replace(`/?tab=${tabId}`, { scroll: false });
  }

  const handleTabClick = useCallback((tabId: MusicToolkitTabId) => {
    if (secondaryTab === null) {
      setSecondaryTab(tabId);
    } else if (secondaryTab === tabId) {
      setSecondaryTab(null);
    } else {
      setSecondaryTab(tabId);
    }
  }, [secondaryTab]);

  return (
    <SplitViewFullScreen
      secondaryContent={SecondaryPanel ? <SecondaryPanel /> : undefined}
      allowSplitView={allowedTabs.length > 1}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-2">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleTabClick(tab.id);
            }}
            className={`glass-pill px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
              activeTab === tab.id
                ? "glass-pill-active text-[var(--color-foreground)]"
                : secondaryTab === tab.id
                  ? "bg-[var(--color-copper)]/10 text-[var(--color-copper)] border border-[var(--color-copper)]/30"
                  : "text-[var(--color-sand-2)] hover:-translate-y-0.5"
            }`}
            title={secondaryTab === tab.id ? "Remove from split view" : "Right-click to add to split view"}
          >
            {tab.label}
            {secondaryTab === tab.id && <span className="ml-1 text-[10px]">(2nd)</span>}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24 }}
      >
        <Suspense fallback={<TabSpinner />}>
          {ActivePanel ? <ActivePanel /> : null}
        </Suspense>
      </motion.div>
    </SplitViewFullScreen>
  );
}

export function MusicToolkitClient(props: MusicToolkitClientProps) {
  return (
    <Suspense fallback={<TabSpinner />}>
      <MusicToolkitInner {...props} />
    </Suspense>
  );
}
