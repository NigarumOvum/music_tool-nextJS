"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";

import { Spinner } from "@heroui/react";

import { useI18n } from "@/components/language-provider";
import type { MusicToolkitTabId } from "@/lib/hub-access";

// ── Lazy-load tab panels (no tuner — it lives inside harmony) ──────────────
const tabLoaders = {
  harmony: () =>
    import("@/components/music/theory-lab-client").then((m) => m.TheoryLabClient),
  progressions: () =>
    import("@/components/music/progression-client").then((m) => m.ProgressionClient),
} as const;

type LoadableTabId = keyof typeof tabLoaders;

const tabPanels: Record<LoadableTabId, ReturnType<typeof dynamic>> = {
  harmony: dynamic(
    () => tabLoaders.harmony().then((Component) => ({ default: Component })),
    { ssr: false },
  ),
  progressions: dynamic(
    () => tabLoaders.progressions().then((Component) => ({ default: Component })),
    { ssr: false },
  ),
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

// ── Fullscreen button — rendered inline with the page title ────────────────
// Uses local state hoisted to MusicToolkitInner via props.
export function FullscreenButton({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isFullscreen ? "Exit Fullscreen (⌘F)" : "Fullscreen (⌘F)"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  );
}

// ── Inner component ────────────────────────────────────────────────────────
function MusicToolkitInner({ allowedTabs, initialTab }: MusicToolkitClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t: _t } = useI18n(); // kept for potential future use

  const tabParam = searchParams.get("tab") ?? undefined;

  const activeTab = (() => {
    if (tabParam && allowedTabs.some((tab) => tab.id === tabParam)) {
      return tabParam as MusicToolkitTabId;
    }
    if (allowedTabs.some((tab) => tab.id === initialTab)) {
      return initialTab;
    }
    return allowedTabs[0]?.id ?? initialTab;
  })();

  // Only render tabs that have a panel loader (excludes tuner)
  const loadableTab: LoadableTabId =
    activeTab in tabPanels ? (activeTab as LoadableTabId) : "harmony";

  const ActivePanel = tabPanels[loadableTab];

  // Navigation is now done via the navbar toolkit links; no tab bar here.

  return (
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
  );
}

export function MusicToolkitClient(props: MusicToolkitClientProps) {
  return (
    <Suspense fallback={<TabSpinner />}>
      <MusicToolkitInner {...props} />
    </Suspense>
  );
}
