"use client";

import { useState, useCallback, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Columns, X } from "lucide-react";
import { useFullscreen } from "@/components/fullscreen-context";

type SplitViewFullScreenProps = {
  children: ReactNode;
  secondaryContent?: ReactNode;
  defaultSplitView?: boolean;
  defaultFullscreen?: boolean;
  allowSplitView?: boolean;
  showControls?: boolean;
  className?: string;
};

export function SplitViewFullScreen({
  children,
  secondaryContent,
  defaultSplitView = false,
  defaultFullscreen = false,
  allowSplitView = true,
  showControls = true,
  className = "",
}: SplitViewFullScreenProps) {
  // Fullscreen state is driven by the shared FullscreenContext so the
  // FullscreenTitleButton (rendered next to the page h1) stays in sync.
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const closeFullscreen = useCallback(() => {
    if (isFullscreen) toggleFullscreen();
  }, [isFullscreen, toggleFullscreen]);

  const [isSplitView, setIsSplitView] = useState(defaultSplitView);
  const [showSecondaryPanel, setShowSecondaryPanel] = useState(defaultSplitView);

  const toggleSplitView = useCallback(() => {
    setIsSplitView(!isSplitView);
    setShowSecondaryPanel(!isSplitView);
  }, [isSplitView]);

  // Keyboard shortcut: Cmd/Ctrl + \ for split view (fullscreen is handled in FullscreenContext)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        if (allowSplitView) toggleSplitView();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allowSplitView, toggleSplitView]);

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 m-0 h-screen w-screen rounded-none"
    : className;

  const content = (
    <div className={`flex flex-col ${containerClasses}`}>
      {showControls && (
        <div className="flex items-center justify-end gap-2 p-2">
          {allowSplitView && secondaryContent && (
            <button
              type="button"
              onClick={toggleSplitView}
              title={isSplitView ? "Exit Split View (⌘\\)" : "Split View (⌘\\)"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                isSplitView
                  ? "border-[var(--color-brass)] bg-[var(--color-brass)]/10 text-[var(--color-brass)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <Columns className="h-4 w-4" />
            </button>
          )}
          {isFullscreen && (
            <button
              type="button"
              onClick={closeFullscreen}
              title="Close Fullscreen (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-sand-2)] transition hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className={`flex-1 ${isSplitView && showSecondaryPanel ? 'flex gap-4' : ''}`}>
        <div className={isSplitView && showSecondaryPanel ? 'flex-1 overflow-y-auto' : ''}>
          {children}
        </div>
        {isSplitView && showSecondaryPanel && secondaryContent && (
          <div className="flex-1 overflow-y-auto border-l border-[var(--color-stroke)] pl-4">
            {secondaryContent}
          </div>
        )}
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[var(--color-background)]"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    );
  }

  return content;
}
