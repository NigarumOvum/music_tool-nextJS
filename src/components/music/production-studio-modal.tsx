"use client";

import { useEffect, useState, Suspense, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Music2,
  Sliders,
  FileCode2,
  Maximize2,
  Minimize2,
  ChevronRight,
  Disc3,
  Layers,
  Columns,
  Pin,
  PinOff,
} from "lucide-react";
import { Spinner } from "@heroui/react";

import { useProductionSong } from "@/components/music/production-song-context";
import { useCurrentUserId, usePersistentState, userKey, writeStored } from "@/lib/persist";
import { useI18n } from "@/components/language-provider";
import type { DictKey } from "@/lib/i18n/dictionaries";
import type { MusicSongSummary, MusicProjectRecord } from "@/lib/music/types";

const tabLoaders = {
  lyrics: () => import("@/components/music/lyrics-library-client").then((module) => module.LyricsLibraryClient),
  audio: () => import("@/components/music/daw-client").then((module) => module.DawClient),
  notation: () => import("@/components/music/tab-studio-client").then((module) => module.TabStudioClient),
} as const;

const tabPanels: Record<string, ReturnType<typeof dynamic>> = {
  lyrics: dynamic(() => tabLoaders.lyrics().then((Component) => ({ default: Component })), { ssr: false }),
  audio: dynamic(() => tabLoaders.audio().then((Component) => ({ default: Component })), { ssr: false }),
  notation: dynamic(() => tabLoaders.notation().then((Component) => ({ default: Component })), { ssr: false }),
} as const;

const STUDIO_TABS: Array<{ id: string; label: string; icon: typeof Music2; description: string }> = [
  { id: "lyrics", label: "Lyrics & Rhymes", icon: FileText, description: "Lyrics editor, rhyming & syllables" },
  { id: "audio", label: "Audio DAW", icon: Sliders, description: "Multitrack synth, sequencer & audio recorder" },
  { id: "notation", label: "Notation & Tabs", icon: FileCode2, description: "Fretboard tabs, partitures & playback" },
];

type ProductionStudioModalProps = {
  isOpen: boolean;
  initialTab?: string;
  songs: MusicSongSummary[];
  projects: MusicProjectRecord[];
  onClose: () => void;
};

export function ProductionStudioModal({
  isOpen,
  initialTab = "song",
  songs,
  projects,
  onClose,
}: ProductionStudioModalProps) {
  const { selectedSongId, setSelectedSongId } = useProductionSong();
  const userId = useCurrentUserId();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [secondaryTab, setSecondaryTab] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [pinnedTabIds, setPinnedTabIds] = usePersistentState<string[]>("studio_pinned_tabs", [], { userId });
  const pinnedTabs = useMemo(() => new Set(pinnedTabIds), [pinnedTabIds]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Pinned tabs persist automatically per user via usePersistentState.

  const toggleSplitView = useCallback(() => {
    setIsSplitView(!isSplitView);
    if (!isSplitView && !secondaryTab) {
      setSecondaryTab("lyrics");
    } else if (isSplitView) {
      setSecondaryTab(null);
    }
  }, [isSplitView, secondaryTab]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const togglePinTab = useCallback((tabId: string) => {
    setPinnedTabIds((prev) =>
      prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId],
    );
  }, [setPinnedTabIds]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOpen) setShowExitConfirm(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const confirmExit = useCallback((save: boolean) => {
    if (save) {
      try {
        window.dispatchEvent(new CustomEvent("production-studio:save-request"));
        writeStored(
          userId ? userKey(userId, "studio_last_session") : "studio_last_session",
          { songId: selectedSongId, tab: activeTab, at: Date.now() },
        );
      } catch {
        // storage unavailable — still exit
      }
    }
    setShowExitConfirm(false);
    onClose();
  }, [activeTab, onClose, selectedSongId, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Escape: ask to save progress before closing
      if (e.key === "Escape") {
        if (showExitConfirm) {
          setShowExitConfirm(false);
        } else {
          requestClose();
        }
        return;
      }

      // Cmd/Ctrl + \: Toggle split view
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSplitView();
        return;
      }

      // Cmd/Ctrl + F: Toggle fullscreen
      if ((e.metaKey || e.ctrlKey) && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // 1-3: Switch tabs
      if (e.key >= '1' && e.key <= '3') {
        const tabIndex = parseInt(e.key) - 1;
        const tabId = STUDIO_TABS[tabIndex]?.id;
        if (tabId) {
          if (isSplitView && secondaryTab === null) {
            setSecondaryTab(tabId);
          } else {
            setActiveTab(tabId);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSplitView, secondaryTab, toggleSplitView, toggleFullscreen, setActiveTab, togglePinTab, activeTab, pinnedTabs, requestClose, showExitConfirm]);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId]
  );

  const activeProject = useMemo(() => {
    if (!activeSong?.project_slug) return null;
    return projects.find((p) => p.slug === activeSong.project_slug) || null;
  }, [projects, activeSong]);

  const ActiveComponent = tabPanels[activeTab];
  const SecondaryComponent = secondaryTab ? tabPanels[secondaryTab] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={requestClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`studio-modal-shell relative z-10 flex flex-col overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] shadow-2xl transition-all duration-200 ${
              isFullscreen ? "h-[98vh] w-[99vw] max-w-none rounded-2xl" : "h-[92vh] w-full max-w-7xl"
            }`}
          >
            {/* Sticky Studio Header */}
            <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-stroke)] bg-[var(--color-surface-strong)] px-5 py-3.5 backdrop-blur-xl">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] text-[var(--color-brass)] shadow-xs">
                  <Disc3 className="h-5 w-5 animate-[spin_8s_linear_infinite]" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="eyebrow text-[0.62rem]">Studio Workspace</span>
                    {activeProject && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: activeProject.color || "#f59e0b" }}
                      >
                        <Layers className="h-3 w-3" />
                        {activeProject.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSongId}
                      onChange={(e) => setSelectedSongId(e.target.value)}
                      className="max-w-[240px] truncate rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-sm font-bold text-[var(--color-foreground)] outline-none transition hover:border-[var(--color-copper)]"
                    >
                      {songs.map((song) => (
                        <option key={song.id} value={song.id}>
                          {song.title} {song.musical_key ? `(${song.musical_key})` : ""}
                        </option>
                      ))}
                    </select>

                    {activeSong?.bpm && (
                      <span className="glass-pill px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-brass)]">
                        {activeSong.bpm} BPM
                      </span>
                    )}

                    {activeSong?.musical_key && (
                      <span className="glass-pill px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-copper)]">
                        {activeSong.musical_key}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Studio Workspace Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-soft)] p-1">
                {STUDIO_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isSecondaryActive = secondaryTab === tab.id;
                  const isPinned = pinnedTabs.has(tab.id);
                  const label = t(`tabs.${tab.id}` as DictKey);
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        if (isSplitView) {
                          if (isSecondaryActive) {
                            setSecondaryTab(null);
                            setIsSplitView(false);
                          } else if (tab.id !== activeTab) {
                            setSecondaryTab(tab.id);
                          } else {
                            setActiveTab(tab.id);
                          }
                        } else {
                          setActiveTab(tab.id);
                        }
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        togglePinTab(tab.id);
                      }}
                      className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                        isActive
                          ? "bg-[var(--color-surface-strong)] text-[var(--color-foreground)] shadow-md border border-[var(--color-border)]"
                          : isSecondaryActive
                          ? "bg-[var(--color-copper)]/10 text-[var(--color-copper)] border border-[var(--color-copper)]/30"
                          : "text-[var(--color-sand-2)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-surface)]/60"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${
                          isActive ? "text-[var(--color-brass)]" : isSecondaryActive ? "text-[var(--color-copper)]" : "text-[var(--color-sand-2)]"
                        }`}
                      />
                      <span>{label}</span>
                      {isPinned && <Pin className="h-3 w-3 text-[var(--color-brass)]" />}
                      {isActive && (
                        <motion.div
                          layoutId="activeStudioTab"
                          className="absolute -bottom-1 left-3 right-3 h-0.5 rounded-full bg-[var(--color-brass)]"
                        />
                      )}
                    </button>
                  );
                })}

                {/* Pin Toggle Button */}
                <button
                  type="button"
                  onClick={() => togglePinTab(activeTab)}
                  title={pinnedTabs.has(activeTab) ? "Unpin current tab" : "Pin current tab"}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                    pinnedTabs.has(activeTab)
                      ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  {pinnedTabs.has(activeTab) ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Actions: Split View, Fullscreen & Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSplitView}
                  title={isSplitView ? "Exit Split View (⌘\\)" : "Split View (⌘\\)"}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                    isSplitView
                      ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  <Columns className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen (⌘F)" : "Fullscreen Studio (⌘F)"}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={requestClose}
                  title="Close Studio (Esc)"
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body Container */}
            <div className={`flex-1 overflow-hidden ${isSplitView ? 'flex gap-4' : 'overflow-y-auto'} p-4 sm:p-6`}>
              <Suspense
                fallback={
                  <div className="flex min-h-[380px] items-center justify-center">
                    <Spinner size="lg" color="warning" />
                  </div>
                }
              >
                <div className={isSplitView ? 'flex-1 overflow-y-auto' : ''}>
                  {ActiveComponent ? <ActiveComponent /> : null}
                </div>

                {isSplitView && SecondaryComponent && (
                  <div className="flex-1 overflow-y-auto border-l border-[var(--color-stroke)] pl-4">
                    <Suspense
                      fallback={
                        <div className="flex min-h-[380px] items-center justify-center">
                          <Spinner size="lg" color="warning" />
                        </div>
                      }
                    >
                      <SecondaryComponent />
                    </Suspense>
                  </div>
                )}
              </Suspense>
            </div>

            {/* Exit confirmation: save progress before leaving Notation & Tabs / Studio */}
            <AnimatePresence>
              {showExitConfirm && (
                <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowExitConfirm(false)}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    role="alertdialog"
                    aria-modal="true"
                    aria-label="Save progress before exiting"
                    className="relative z-10 w-full max-w-sm rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-modal-surface)] p-5 shadow-2xl"
                  >
                    <h3 className="text-base font-black text-[var(--color-foreground)]">
                      {t("common.saveProgressTitle")}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--color-sand-2)]">
                      Your Notation &amp; Tabs grid is kept as a local draft, and the DAW
                      session autosaves. Save a snapshot so you can resume right here.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => confirmExit(true)}
                        className="w-full rounded-xl bg-[var(--color-mint)] px-4 py-2 text-xs font-black uppercase tracking-widest text-black transition hover:brightness-110"
                      >
                        {t("common.saveExit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmExit(false)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-black uppercase tracking-widest text-[var(--color-foreground)] transition hover:border-red-500/40 hover:text-red-400"
                      >
                        {t("common.exitWithoutSaving")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowExitConfirm(false)}
                        className="w-full rounded-xl px-4 py-2 text-xs font-bold text-[var(--color-sand-2)] transition hover:text-[var(--color-foreground)]"
                      >
                        {t("common.keepEditing")}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
